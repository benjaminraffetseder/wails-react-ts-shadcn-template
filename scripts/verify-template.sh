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
[[ -f "$task_template/template.json" ]] || fail 'Run this maintenance script from a template checkout, not a generated app.'

for task_command in node npm go wails mktemp; do
  command -v "$task_command" >/dev/null 2>&1 || fail "Missing prerequisite: $task_command. See the README."
done

for task_relative in frontend/node_modules frontend/dist frontend/wailsjs build/bin; do
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
if (Object.keys(lock.packages).some((name) => name.includes("radix-ui"))) {
  throw new Error("Radix dependencies must not be present in this Base UI template.")
}
NODE

task_tags="${WAILS_BUILD_TAGS:-}"
if [[ "$task_platform" == Linux ]]; then
  command -v pkg-config >/dev/null 2>&1 || fail 'Install pkg-config and the native Wails dependencies; see the README.'
  pkg-config --exists gtk+-3.0 || fail 'GTK 3 development libraries are missing. Run wails doctor for installation guidance.'
  if [[ -z "$task_tags" ]]; then
    if pkg-config --exists webkit2gtk-4.1; then
      task_tags=webkit2_41
    elif ! pkg-config --exists webkit2gtk-4.0; then
      fail 'WebKitGTK 4.0 or 4.1 development libraries are missing. Run wails doctor for installation guidance.'
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
wails init -n template-check-app -d "$task_app" -t "$task_template"

for task_relative in main.go app.go go.mod wails.json LICENSE THIRD_PARTY_NOTICES.md; do
  [[ -f "$task_app/$task_relative" ]] || fail "Generated app is missing $task_relative"
done
[[ ! -e "$task_app/template.json" ]] || fail 'Template metadata should not be copied into generated apps.'

cd "$task_app"
if [[ -n "$task_tags" ]]; then
  wails build -clean -tags "$task_tags"
  go vet -tags "$task_tags" ./...
else
  wails build -clean
  go vet ./...
fi
npm run typecheck --prefix frontend
npm run lint --prefix frontend
npm run format:check --prefix frontend

if [[ "$task_platform" == Darwin ]]; then
  task_executable="$task_app/build/bin/template-check-app.app/Contents/MacOS/template-check-app"
else
  task_executable="$task_app/build/bin/template-check-app"
fi
[[ -x "$task_executable" ]] || fail "Native executable was not generated: $task_executable"
printf 'Native executable: %s\n' "$task_executable"
printf 'Template generation, Base UI dependencies, TypeScript, ESLint, Prettier, Go vet, and %s build passed.\n' "$task_platform"
