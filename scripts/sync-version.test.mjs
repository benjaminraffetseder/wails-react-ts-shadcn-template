import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const repository = fileURLToPath(new URL("../", import.meta.url))
const targets = {
  "frontend/package-lock.json":
    '{"version":"0.1.0","packages":{"":{"version":"0.1.0"}}}\n',
  "build/config.yml":
    'version: "3"\ninfo:\n  productName: "Custom Desk"\n  version: "0.1.0" # preserve this\ndev_mode:\n  root_path: .\n',
  "internal/buildinfo/version.txt": "0.1.0\n",
  "build/windows/info.json":
    '{"fixed":{"file_version":"0.1.0","product_version":"0.1.0"},"info":{"0409":{"FileVersion":"0.1.0","ProductVersion":"0.1.0","ProductName":"Custom Desk"}}}',
  "build/windows/wails.exe.manifest":
    '<assembly manifestVersion="1.0">\n<assemblyIdentity name="org.example.custom" version="0.1.0"/><dependency><assemblyIdentity name="Common-Controls" version="6.0.0.0"/></dependency></assembly>',
  "build/windows/nsis/wails_tools.nsh":
    '!define INFO_PRODUCTVERSION "0.1.0"\n!define INFO_PRODUCTNAME "Custom Desk"\n',
  "build/windows/msix/app_manifest.xml":
    '<Package><Identity Name="org.example.custom" Version="0.1.0.0"/></Package>',
  "build/windows/msix/template.xml":
    '<Template><PackageInformation PackageName="Custom Desk" Version="0.1.0.0"/></Template>',
  "build/darwin/Info.plist":
    "<plist><dict>\n  <key>CFBundleShortVersionString</key><string>0.1.0</string>\n</dict></plist>",
  "build/darwin/Info.dev.plist":
    "<plist><dict><key>CFBundleVersion</key><string>0.1.0</string>\n  <key>CFBundleShortVersionString</key><string>0.1.0</string></dict></plist>",
  "build/linux/nfpm/nfpm.yaml":
    'name: "custom-desk"\nversion: "0.1.0"\nrelease: "1"\n',
}

function fixture(t, version = "1.2.3") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starter-version-"))
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
  // In a generated project exercise the actual Wails 3.1 packaging output.
  for (const [file, content] of Object.entries(targets)) {
    write(
      file,
      fs.existsSync(path.join(repository, file))
        ? fs.readFileSync(path.join(repository, file))
        : content,
    )
  }
  write(
    "scripts/sync-version.mjs",
    fs.readFileSync(path.join(repository, "scripts/sync-version.mjs")),
  )
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repository, "frontend/package.json"), "utf8"),
  )
  write("frontend/package.json", JSON.stringify({ ...pkg, version }))
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
  const run = (...args) =>
    spawnSync(process.execPath, ["scripts/sync-version.mjs", ...args], {
      cwd: root,
      encoding: "utf8",
    })
  const snapshot = () =>
    Object.fromEntries(
      Object.keys(targets)
        .filter((file) => fs.existsSync(path.join(root, file)))
        .map((file) => [file, read(file)]),
    )
  return { root, read, write, run, snapshot }
}

test("check detects drift without writing; update is idempotent and preserves metadata", (t) => {
  const f = fixture(t)
  const before = f.snapshot()
  const check = f.run("--check")
  assert.equal(check.status, 1)
  assert.match(check.stderr, /build\/config.yml/)
  assert.deepEqual(f.snapshot(), before)
  const updated = f.run()
  assert.equal(updated.status, 0, updated.stderr)
  assert.equal(f.run("--check").status, 0)
  assert.match(f.read("build/config.yml"), /version: ['"]3['"]/)
  assert.match(f.read("build/windows/wails.exe.manifest"), /version="6.0.0.0"/)
  assert.match(
    f.read("build/windows/msix/app_manifest.xml"),
    /Version="1.2.3.0"/,
  )
  const timestamps = Object.keys(targets).map(
    (file) => fs.statSync(path.join(f.root, file)).mtimeMs,
  )
  assert.equal(f.run().status, 0)
  assert.deepEqual(
    Object.keys(targets).map(
      (file) => fs.statSync(path.join(f.root, file)).mtimeMs,
    ),
    timestamps,
  )
})

for (const version of [
  "01.2.3",
  "1.2",
  "1.2.3-beta",
  "1.2.3+build",
  "65536.0.0",
  "-1.0.0",
]) {
  test(`rejects invalid version ${version} before writing`, (t) => {
    const f = fixture(t, version)
    const before = f.snapshot()
    assert.notEqual(f.run().status, 0)
    assert.deepEqual(f.snapshot(), before)
  })
}

for (const file of Object.keys(targets)) {
  test(`missing required target ${file} fails before writing`, (t) => {
    const f = fixture(t)
    fs.unlinkSync(path.join(f.root, file))
    const before = f.snapshot()
    assert.notEqual(f.run().status, 0)
    assert.deepEqual(f.snapshot(), before)
  })
}

test("unexpected late target schema fails without any writes", (t) => {
  const f = fixture(t)
  f.write(
    "build/linux/nfpm/nfpm.yaml",
    'name: "custom"\nrenamed_version: "0.1.0"\n',
  )
  const before = f.snapshot()
  assert.notEqual(f.run().status, 0)
  assert.deepEqual(f.snapshot(), before)
})

test("entire removed platform is optional; CRLF is retained", (t) => {
  const f = fixture(t, "65535.0.65535")
  const platform = path.resolve(f.root, "build/windows")
  assert.equal(path.dirname(platform), path.join(f.root, "build"))
  fs.rmSync(platform, { recursive: true })
  f.write(
    "build/config.yml",
    f.read("build/config.yml").replace(/\r?\n/g, "\r\n"),
  )
  assert.equal(f.run().status, 0)
  assert.ok(f.read("build/config.yml").includes("\r\n"))
  assert.equal(f.run("--check").status, 0)
})

test("npm version lifecycle synchronizes all targets", (t) => {
  const f = fixture(t, "1.0.0")
  const result = spawnSync(
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm",
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          "npm version patch --no-git-tag-version --ignore-scripts=false",
        ]
      : ["version", "patch", "--no-git-tag-version", "--ignore-scripts=false"],
    {
      cwd: path.join(f.root, "frontend"),
      encoding: "utf8",
    },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(f.read("frontend/package.json")).version, "1.0.1")
  assert.equal(f.run("--check").status, 0)
})

for (const [file, content] of [
  [
    "build/config.yml",
    'version: "3"\ninfo:\n  version:\n  productName: "Keep me"\ndev_mode:\n  root_path: .\n',
  ],
  ["build/linux/nfpm/nfpm.yaml", 'version:\nname: "keep-me"\n'],
  [
    "build/config.yml",
    'version: "3"\ninfo:\n  version: "0.1.0\n  productName: "Keep me"\n',
  ],
]) {
  test(`malformed version field in ${file} fails before any writes (${JSON.stringify(content)})`, (t) => {
    const f = fixture(t)
    f.write(file, content)
    const before = f.snapshot()
    assert.notEqual(f.run().status, 0)
    assert.deepEqual(f.snapshot(), before)
  })
}

test("preserves YAML quotes/comments and handles a final line without a newline", (t) => {
  const f = fixture(t)
  f.write(
    "build/config.yml",
    'version: "3"\ninfo: # native metadata\n  productName: "Custom Desk"\n# keep this comment\n  version: \'0.0.1\' # app version',
  )
  f.write(
    "build/linux/nfpm/nfpm.yaml",
    'name: "custom-desk"\nversion: 0.0.1 # package version\n',
  )
  const result = f.run()
  assert.equal(result.status, 0, result.stderr)
  assert.match(f.read("build/config.yml"), /  version: '1.2.3' # app version$/)
  assert.match(
    f.read("build/linux/nfpm/nfpm.yaml"),
    /version: 1.2.3 # package version/,
  )
})
