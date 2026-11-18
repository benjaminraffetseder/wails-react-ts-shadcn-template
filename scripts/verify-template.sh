#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

task_platform="$(uname -s)"
case "$task_platform" in
  Darwin|Linux) ;;
  *) fail 'Use verify-template.ps1 on Windows; this script supports macOS and Linux.' ;;
esac

task_template="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
[[ -f "$task_template/template.yaml" ]] || fail 'Run this maintenance script from a template checkout, not a generated app.'

for task_command in node npm go wails3 mktemp; do
  command -v "$task_command" >/dev/null 2>&1 || fail "Missing prerequisite: $task_command. See the README."
done

for task_relative in frontend/node_modules frontend/dist frontend/bindings bin .task; do
  [[ ! -e "$task_template/$task_relative" ]] || fail "Remove generated output from the template before verification: $task_relative"
done

node - "$task_template" <<'NODE'
const fs = require("node:fs")
const path = require("node:path")
const root = process.argv[2]
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))
const config = read("frontend/components.json")
const pkg = read("frontend/package.json")
const lock = read("frontend/package-lock.json")
if (!config.style?.startsWith("base-")) throw new Error("shadcn must use a Base UI style.")
if (!pkg.dependencies?.["@base-ui/react"]) throw new Error("Base UI dependency is missing.")
if (pkg.dependencies?.["@wailsio/runtime"] !== "3.1.0") throw new Error("The Wails runtime must match the pinned Go dependency.")
if (Object.keys(pkg.dependencies).some((name) => name.includes("radix-ui"))) {
  throw new Error("Do not add direct Radix dependencies to this Base UI template. cmdk has transitive Radix dependencies.")
}
NODE

task_tags="${WAILS_BUILD_TAGS:-}"
if [[ "$task_platform" == Linux ]]; then
  command -v pkg-config >/dev/null 2>&1 || fail 'Install pkg-config and the native Wails dependencies; see the README.'
  if [[ -z "$task_tags" ]]; then
    if pkg-config --exists gtk4 webkitgtk-6.0; then
      task_tags=''
    else
      fail 'GTK4 + WebKitGTK 6.0 development libraries are missing. Run wails3 doctor. Wails 3.1 does not support gtk3.'
    fi
  fi
else
  command -v xcode-select >/dev/null 2>&1 || fail 'Install Xcode command-line tools with xcode-select --install.'
  xcode-select -p >/dev/null 2>&1 || fail 'Install Xcode command-line tools with xcode-select --install.'
fi

# Preserve the generated app for inspection, including when a check fails.
task_scratch="$(mktemp -d "${TMPDIR:-/tmp}/wails-template-verify.XXXXXX")"
task_app="$task_scratch/template-check-app"
printf 'Generated app: %s\n' "$task_app"
printf 'Build tags: %s\n' "${task_tags:-none}"
wails3 init -n template-check-app -d "$task_scratch" -t "$task_template" -mod example.com/template-check-app

for task_relative in main.go app.go settings_service.go items_service.go items_service_test.go internal/apppaths/paths.go internal/preferences/store.go internal/items/migrations/001_items.sql scripts/sync-version.mjs internal/buildinfo/version.txt go.mod Taskfile.yml build/config.yml .gitignore frontend/vite.config.ts frontend/vitest.config.ts frontend/tsconfig.json frontend/tsconfig.app.json frontend/src/hooks/use-desktop.ts frontend/src/pages/home-page.tsx frontend/src/components/window-titlebar.tsx LICENSE THIRD_PARTY_NOTICES.md; do
  [[ -f "$task_app/$task_relative" ]] || fail "Generated app is missing $task_relative"
done
for task_relative in template.yaml template.json wails.json wails.tmpl.json sqlite_enabled.go sqlite_disabled.go frontend/src/lib/backend.ts frontend/src/pages/home-page.tsx.tmpl frontend/vite.config.ts.tmpl frontend/tsconfig.json.tmpl frontend/tsconfig.app.json.tmpl; do
  [[ ! -e "$task_app/$task_relative" ]] || fail "Unexpected template metadata, obsolete file, or unprocessed template: $task_relative"
done
node - "$task_app" <<'NODE'
const fs = require("node:fs")
const path = require("node:path")
const read = (file) => fs.readFileSync(path.join(process.argv[2], file), "utf8")
if (!read("frontend/vite.config.ts").includes('const goModule = "example.com/template-check-app"')) {
  throw new Error("The Vite binding alias must follow the selected Go module path.")
}
for (const file of ["frontend/tsconfig.json", "frontend/tsconfig.app.json"]) {
  const config = JSON.parse(read(file))
  if (config.compilerOptions.paths["@wails/*"][0] !== "./bindings/example.com/template-check-app/*") {
    throw new Error(`The TypeScript binding alias must follow the selected Go module path: ${file}`)
  }
}
NODE

cd "$task_app"
npm ci --prefix frontend
if [[ -n "$task_tags" ]]; then
  wails3 build "EXTRA_TAGS=$task_tags"
  go vet -tags "$task_tags" ./...
  go test -tags "$task_tags" ./...
else
  wails3 build
  go vet ./...
  go test ./...
fi
npm run test:version --prefix frontend
npm run version:check --prefix frontend
npm run typecheck --prefix frontend
npm run lint --prefix frontend
npm run format:check --prefix frontend
npm test --prefix frontend
[[ -z "$(gofmt -l app.go main.go settings_service.go desktop_notifications.go items_service.go items_service_test.go internal)" ]] || fail 'Go files need formatting.'
task_default_dependencies="$(go list -deps .)"
if [[ $'\n'"$task_default_dependencies"$'\n' != *$'\nmodernc.org/sqlite\n'* ]]; then
  fail 'Default app must link the SQLite driver.'
fi

task_executable="$task_app/bin/template-check-app"
[[ -x "$task_executable" ]] || fail "Native executable was not generated: $task_executable"
printf 'Native executable: %s\n' "$task_executable"
printf 'Template generation, version fixtures, frontend tests, TypeScript, ESLint, Prettier, Go tests/vet, and the default %s build with SQLite passed.\n' "$task_platform"
