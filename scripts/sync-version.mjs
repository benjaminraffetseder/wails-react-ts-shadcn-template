import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const args = process.argv.slice(2)
if (args.some((arg) => arg !== "--check")) {
  throw new Error("Usage: node scripts/sync-version.mjs [--check]")
}
const { version } = JSON.parse(read("frontend/package.json"))
if (
  typeof version !== "string" ||
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
  version.split(".").some((part) => Number(part) > 65535)
) {
  throw new Error(
    "App version must be MAJOR.MINOR.PATCH, with no leading zeroes and each segment <= 65535.",
  )
}

// Prepare and validate EVERY target before the first write. Platform directories
// may be removed deliberately; a present directory must contain all its targets.
const updates = []
function update(file, transform) {
  const before = read(file)
  const after = transform(before)
  if (before !== after) updates.push({ file, after })
}
function replace(content, file, pattern, value, expected = 1) {
  let matches = 0
  const result = content.replace(pattern, (_, prefix, suffix) => {
    matches++
    return prefix + value + suffix
  })
  if (matches !== expected) {
    throw new Error(
      `${file}: expected ${expected} version fields, found ${matches}; no files were changed.`,
    )
  }
  return result
}
function field(file, pattern, value = version, expected = 1) {
  update(file, (content) => replace(content, file, pattern, value, expected))
}
function yamlVersion(content, file, indentation = "") {
  // Match one complete scalar on its own line. Whitespace must never consume
  // the next metadata key when the version is blank or has a broken quote.
  const pattern = new RegExp(
    `^(${indentation}version:[ \\t]*)("[^"\\r\\n]*"|'[^'\\r\\n]*'|[^\\s"'#]+)([ \\t]*(?:#[^\\r\\n]*)?\\r?)$`,
    "gm",
  )
  let matches = 0
  const result = content.replace(pattern, (_, prefix, previous, suffix) => {
    matches++
    const quote =
      previous.startsWith('"') || previous.startsWith("'") ? previous[0] : ""
    return `${prefix}${quote}${version}${quote}${suffix}`
  })
  if (matches !== 1)
    throw new Error(
      `${file}: expected one valid version scalar; no files were changed.`,
    )
  return result
}
update("frontend/package-lock.json", (content) => {
  const lock = JSON.parse(content)
  if (
    typeof lock.version !== "string" ||
    typeof lock.packages?.[""]?.version !== "string"
  ) {
    throw new Error(
      "package-lock.json: expected lockfile root and root package versions.",
    )
  }
  lock.version = version
  lock.packages[""].version = version
  const output = JSON.stringify(lock, null, 2) + "\n"
  return content.includes("\r\n") ? output.replace(/\n/g, "\r\n") : output
})
update("build/config.yml", (content) => {
  let sections = 0
  const result = content.replace(
    /^info:[ \t]*(?:#[^\r\n]*)?\r?\n(?:[ \t]+[^\n]*(?:\n|$)|[ \t]*\r?\n|#[^\n]*(?:\n|$))*/gm,
    (section) => {
      sections++
      return yamlVersion(section, "build/config.yml info", "  ")
    },
  )
  if (sections !== 1)
    throw new Error("build/config.yml: expected exactly one info section.")
  return result
})
field("internal/buildinfo/version.txt", /^()[^\r\n]+(\r?\n?)$/, version)
if (fs.existsSync(path.join(root, "build/windows"))) {
  update("build/windows/info.json", (content) => {
    const info = JSON.parse(content)
    if (
      typeof info.fixed?.file_version !== "string" ||
      typeof info.fixed?.product_version !== "string" ||
      !info.info ||
      Object.keys(info.info).length === 0
    ) {
      throw new Error(
        "build/windows/info.json: unexpected version resource schema.",
      )
    }
    for (const locale of Object.values(info.info)) {
      if (
        typeof locale.FileVersion !== "string" ||
        typeof locale.ProductVersion !== "string"
      ) {
        throw new Error(
          "build/windows/info.json: missing localized version fields.",
        )
      }
    }
    return replace(
      content,
      "build/windows/info.json",
      /("(?:file_version|product_version|FileVersion|ProductVersion)"\s*:\s*")[^"]*(")/g,
      version,
      2 + 2 * Object.keys(info.info).length,
    )
  })
  // Only the application's direct child identity, never Common-Controls.
  field(
    "build/windows/wails.exe.manifest",
    /(<assembly\b[^>]*>\s*<assemblyIdentity\b[^>]*\bversion=")[^"]*(")/g,
  )
  field(
    "build/windows/nsis/wails_tools.nsh",
    /(^[ \t]*!define INFO_PRODUCTVERSION ")[^"]*("[^\r\n]*\r?$)/gm,
  )
  field(
    "build/windows/msix/app_manifest.xml",
    /(<Identity\b[^>]*\bVersion=")[^"]*(")/g,
    `${version}.0`,
  )
  field(
    "build/windows/msix/template.xml",
    /(<PackageInformation\b[^>]*\bVersion=")[^"]*(")/g,
    `${version}.0`,
  )
}
if (fs.existsSync(path.join(root, "build/darwin"))) {
  for (const file of [
    "build/darwin/Info.plist",
    "build/darwin/Info.dev.plist",
  ]) {
    // Wails 3.1's release plist only has ShortVersionString. Add BundleVersion
    // once, next to it; fail if either existing key has an unexpected structure.
    update(file, (content) => {
      let result = replace(
        content,
        file,
        /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/g,
        version,
      )
      if (result.includes("<key>CFBundleVersion</key>")) {
        result = replace(
          result,
          file,
          /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/g,
          version,
        )
      } else {
        const newline = result.includes("\r\n") ? "\r\n" : "\n"
        result = result.replace(
          /(^[ \t]*)(<key>CFBundleShortVersionString<\/key>)/m,
          `$1<key>CFBundleVersion</key>${newline}$1    <string>${version}</string>${newline}$1$2`,
        )
        if (!result.includes("<key>CFBundleVersion</key>")) {
          throw new Error(
            `${file}: cannot locate a separate bundle version key; no files were changed.`,
          )
        }
      }
      return result
    })
  }
}
if (fs.existsSync(path.join(root, "build/linux"))) {
  update("build/linux/nfpm/nfpm.yaml", (content) =>
    yamlVersion(content, "build/linux/nfpm/nfpm.yaml"),
  )
}
if (args.includes("--check")) {
  if (updates.length) {
    console.error(
      `Version drift (${version}):\n${updates.map(({ file }) => `  ${file}`).join("\n")}`,
    )
    process.exitCode = 1
  }
} else {
  for (const { file, after } of updates)
    fs.writeFileSync(path.join(root, file), after)
  if (updates.length)
    console.log(`Synchronized ${updates.length} files to ${version}.`)
}
