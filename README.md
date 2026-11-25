# Wails + React + TypeScript + shadcn/ui

A reusable **Wails v3 custom template** for desktop apps. It includes React 19, TypeScript 6, Vite 8, React Router 8, Tailwind CSS 4, and shadcn/ui with Base UI primitives. The Go dependency and `@wailsio/runtime` are pinned to **3.1.0**.

Go-backed settings, desktop hooks, TanStack Query with development Devtools, an
extensible command palette, synchronized application versions, and a removable
SQLite example are included. See the
[feature guide](docs/features.md) for usage, storage paths, preview limitations,
and how to adapt or remove the SQLite example.

## Create a new desktop app

Install the [prerequisites](#requirements), then generate an app directly from the repository URL. The commands below work in PowerShell or a macOS/Linux shell:

```powershell
wails3 init -n my-desktop-app -t https://github.com/benjaminraffetseder/wails-react-ts-shadcn-template
cd my-desktop-app
wails3 dev
```

To use a local checkout, clone the repository with Git and generate an app from the local template. Run these commands from the folder where you want both directories:

```powershell
git clone https://github.com/benjaminraffetseder/wails-react-ts-shadcn-template.git
wails3 init -n my-desktop-app -t ./wails-react-ts-shadcn-template
cd my-desktop-app
wails3 dev
```

A folder containing `template.yaml` is template source. A generated app contains `Taskfile.yml` and `build/config.yml`; run development commands in that app folder. If you already have a checkout, skip `git clone` and run `wails3 init` from its parent folder.

You can also pass an absolute template path from anywhere:

```powershell
wails3 init -n my-desktop-app -t "C:/templates/wails-react-ts-shadcn-template"
```

Use a simple app name such as `my-desktop-app`. Wails sets the native window title, app name, and executable name during generation. Pass `-mod github.com/you/my-desktop-app` to select your Go module path; Wails otherwise defaults to `changeme`. The frontend binding import follows the selected module automatically. The sidebar and browser title use the bundled translations; see [customization](#project-layout).

The repository's files are Wails template source. GitHub's **Use this template** button copies that source; use `wails3 init` to generate a runnable app. Existing Wails v2 apps need the [v2-to-v3 migration steps](https://v3.wails.io/migration/v2-to-v3/); updating this template does not modify previously generated apps.

## Requirements

- Go **1.26 or newer**
- Node.js **26 or newer**, with npm (`.nvmrc` pins 26.13.0 LTS)
- Wails **v3 CLI 3.1.0**
- Your platform's native Wails dependencies

Install the matching Wails v3 CLI:

```powershell
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.1.0
```

Add Go's binary directory to your `PATH` if it is not already there. This is `GOBIN` when configured, otherwise the `bin` directory under `go env GOPATH` (normally `%USERPROFILE%\go\bin` on Windows or `~/go/bin` on macOS/Linux). Reopen your terminal after changing its persistent PATH, then run `wails3 doctor`.

Windows needs WebView2; macOS needs Xcode command-line tools; Linux needs a C compiler, `pkg-config`, GTK4, and WebKitGTK 6.0 development libraries. Follow the [Wails v3 installation guide](https://v3.wails.io/quick-start/installation/). This template targets Wails 3.1; the legacy `gtk3` build tag is not supported.

The template also requires a webview compatible with [Tailwind CSS 4's browser baseline](https://tailwindcss.com/docs/compatibility#browser-support): Chrome 111+, Safari 16.4+, or Firefox 128+ for browser previews. Use a current WebView2 runtime on Windows and a recent WebKit engine on macOS/Linux; Wails' minimum OS versions alone do not guarantee this CSS support.

## What is ready

- Shared app layout with active navigation and nested routes.
- Overview, settings, and a catch-all 404 screen.
- React Router `HashRouter`, which works with Wails asset serving.
- Official shadcn Button, Card, Input, Label, Badge, Dialog, and Separator source components using Base UI.
- Neutral design tokens with light, dark, and system themes. Native preferences persist through Go; system mode follows system changes.
- react-i18next localization with bundled English and German translations and a saved language selector.
- Browser preview with local preferences and clear limitations for native actions and SQLite.
- TypeScript and Vite aliases: `@/` for app source and `@wails/` for generated bindings in your Go module (for example, `@wails/internal/app/app`).
- A committed npm lockfile for repeatable frontend installs.
- ESLint with TypeScript and React Hooks rules, plus Prettier formatting.
- Versioned native settings with persisted first-launch defaults and shared React state with loading/save/error/recovery states.
- Typed hooks for file dialogs, clipboard, window controls, notifications, and events, with safe browser-preview behavior.
- Accessible Base UI command dialog with ⌘K / Ctrl+K, navigation, theme/language commands, and feature registration/cleanup.
- SQLite items CRUD works out of the box with embedded migrations and a pure-Go driver. Native startup opens an app-specific database automatically; the example is removable.
- TanStack Query v5 caches Go-backed items and refreshes them after mutations, with offline-safe local calls and a development-only Query Devtools panel.
- One package version synchronized to native packaging and embedded in Settings/About, with a no-write drift check.
- An optional draggable React title bar using the existing native window hooks; the OS title bar remains the default.
- Vitest tests for settings, mocked desktop hooks, command keyboard/focus behavior, and Node/Go persistence/migration tests.

## Develop and build a generated app

Run these from the **generated app folder**:

```powershell
wails3 dev
```

`wails3 dev` generates the Go bindings and runs Vite with hot reload on port 9245. Stop it with **Ctrl+C** before building:

```powershell
wails3 build
```

`wails3 build` builds the frontend and embeds it in a Go executable under `bin/` (`.exe` on Windows). Run `wails3 package` to create platform packages, including a macOS `.app` bundle. The root `Taskfile.yml` uses the platform build tasks Wails generates under `build/`; no separate Task installation is required.

SQLite is included in ordinary `wails3 dev`, `wails3 build`, and `wails3 package`
commands. See the [feature guide](docs/features.md#sqlite-support) to adapt or remove
the example. Browser preview displays an explanation; native mode runs the database.

After running `wails3 dev` or `wails3 build` at least once to generate bindings, stop any running Wails dev session before starting a separate Vite preview. Run frontend commands from the generated app:

```powershell
cd frontend
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run dev
```

The last command previews the frontend in a browser. Desktop integration actions and SQLite require `wails3 dev` or the packaged desktop app; plain Vite does not provide native methods. The `useDesktop` hook follows Wails' runtime initialization event, enabling native actions once the environment is ready. Checking for `window._wails` alone would also match browser previews.

Wails 3.1.0 selects JavaScript bindings for community template paths without a `-ts` suffix. Those bindings carry JSDoc types; `allowJs` lets TypeScript infer generated model and method signatures. You can also generate `.ts` bindings explicitly with `wails3 generate bindings -ts`. The frontend imports work with either format. The Vite plugin from `@wailsio/runtime/plugins/vite` loads generated event bindings.

Run `npm run lint:fix` to apply ESLint fixes and `npm run format` to format frontend source, configs, styles, and locale JSON. ESLint uses `eslint.config.js`; Prettier uses `.prettierrc.json` and `.prettierignore`. Generated Wails bindings, build output, and dependencies are excluded from both tools, and Prettier also skips the generated npm lockfile. ESLint reports code issues while Prettier owns formatting; `eslint-config-prettier` disables conflicting style rules. Lint warnings fail the check.

## Add shadcn components

Run inside the generated app's `frontend` folder:

```powershell
npm run ui:add -- switch dropdown-menu
```

This invokes the pinned shadcn CLI on demand and writes editable component source under `src/components/ui`. It requires internet access. The CLI is not installed as a permanent app dependency. Configuration lives in `components.json`; theme tokens live in `src/index.css`.

The `base-nova` style in `components.json` selects Base UI for newly added components. Compose primitives with Base UI's `render` prop, for example `<DialogTrigger render={<Button />}>Open</DialogTrigger>`. Style React Router links with `buttonVariants` so they retain link semantics.

## Project layout

In a generated app:

```text
main.go                         # Embeds frontend assets and starts internal/app
go.mod / go.sum                 # Independent Go module
Taskfile.yml                    # Wails v3 dev/build/package tasks
internal/
  app/                          # Service registration, events, window, app info
  apppaths/                     # Fixed per-user configuration and data paths
  buildinfo/                    # Embedded application version
  desktop/                      # Native notification service
  items/                        # Items service, SQLite store, migrations, tests
  preferences/                  # Settings service, schema, persistence, tests
build/                          # Generated platform icons, manifests, packaging
  config.yml                    # App metadata and development watcher
bin/                            # Built executables
frontend/
  components.json               # shadcn configuration
  eslint.config.js              # TypeScript and React Hooks lint rules
  .prettierrc.json / .prettierignore
  package.json / package-lock.json
  vite.config.ts
  src/
    app.tsx                     # Query provider/Devtools, HashRouter, and routes
    main.tsx                    # React entry
    i18n/                       # Initialization, typed keys, bundled locale JSON
    index.css                   # Tailwind and light/dark tokens
    components/
      app-layout.tsx            # App shell and navigation
      theme-provider.tsx        # Saved/system theme
      ui/                       # Editable shadcn components
    hooks/
      use-desktop.ts            # Native runtime readiness and browser preview
      use-items.ts              # SQLite queries, mutations, and invalidation
    lib/
      query-client.ts           # Query client factory and local-call options
      utils.ts                  # Shared class-name helper
    pages/                      # Overview (desktop and SQLite examples), settings, 404
  bindings/                     # Generated by Wails; do not edit
```

Add a screen under `src/pages`, register it in `src/app.tsx`, and add an entry in `src/lib/routes.ts`. Navigation and command-palette routes share those definitions. Add exported methods to Go's `App` service in `internal/app/service.go`, or create another internal service and register it with `application.NewService` in `internal/app/run.go`; Wails regenerates bindings during development/build. Adapt or remove the desktop and SQLite examples when adding your app's features.

Each Go service lives with its feature under `internal/`. Generated binding imports
follow that package, such as `@wails/internal/items/itemsservice` and
`@wails/internal/preferences/settingsservice`. After moving a service to another Go
package, regenerate bindings and update its frontend imports and test mocks.

Use TanStack Query for asynchronous application data; `use-items.ts` demonstrates
queries, mutations, and cache invalidation through generated Go bindings. The
shared client caches data for 30 seconds before considering it stale. Local
queries and mutations use `localQueryOptions` so they work without internet and
report failures without automatic retries. HTTP calls retain TanStack's network
and retry defaults. The Query Devtools toggle appears in development builds and
starts closed; production builds exclude the panel. See
[queries and mutations](docs/features.md#queries-and-mutations) for extension,
cache lifetime, and removal guidance.

Customize `build/config.yml`, the native window title in `internal/app/run.go`, and the icons under `build/` for each app. After changing product metadata, run `wails3 task common:update:build-assets`, then `node scripts/sync-version.mjs`. Bump versions from `frontend/` with `npm version patch --no-git-tag-version` and verify with `npm run version:check`. Set `app.title` in both `frontend/src/i18n/locales/en.json` and `de.json` to change the sidebar and browser title, and update the fallback `<title>` in `frontend/index.html`. The native window uses the standard system title bar and controls; its title is independent of the frontend language selector. The [optional custom title bar](docs/features.md#optional-custom-title-bar) uses the translated title and can be enabled with two source edits.

## Localization

Select **English** or **Deutsch** in Settings or the command palette. Native settings are authoritative; the first launch persists English and system theme as defaults. Browser preview stores its own preferences in localStorage and chooses the first supported browser language when no saved preference exists; regional variants such as `de-AT` use German. Storage failures are visible and failed changes are not presented as saved. Use `useAppSettings().updateSettings({ language: "de" })` for persistent changes.

Translations are bundled under `frontend/src/i18n/locales/` and work offline. `src/i18n/index.ts` initializes i18next before React renders and updates the HTML language, text direction, and document title. Translation keys are typed from the English resource in `src/i18n/i18next.d.ts`.

Use [react-i18next's](https://react.i18next.com/latest/using-with-hooks) `useTranslation` in components:

```tsx
import { useTranslation } from "react-i18next"

export function OverviewHeading() {
  const { t } = useTranslation()
  return <h1>{t("nav.overview")}</h1>
}
```

Add a locale JSON file with the same keys, import it into `src/i18n/index.ts`, register it in `resources`, and add its code and native display name to `languages`. Missing translations fall back to English. Go services return typed application data; React owns the localized user-facing messages.

## Maintain the template

Files with `.tmpl` in their names are processed by `wails3 init`, which removes `.tmpl` from the generated filenames; ordinary frontend files are copied. The Go templates under `internal/` interpolate imports and application metadata. The Vite and TypeScript config templates interpolate the Go module path into the `@wails/` alias, so pages remain ordinary `.tsx` files with direct imports such as `@wails/internal/app/app`. `gitignore.tmpl` supplies the generated app's `.gitignore`. Wails generates the platform build assets automatically during initialization.

Keep `frontend/package-lock.json` synchronized whenever dependencies change. Make dependency changes in a generated app, then copy its updated `package.json` and `package-lock.json` back to the template. Keep the Go Wails dependency, CLI, and npm runtime on the same version. TypeScript 6.0.3 is used because [typescript-eslint currently supports versions below 6.1](https://typescript-eslint.io/users/dependency-versions/#typescript); TypeScript 7 requires a compatible parser release first. Keep `node_modules`, `dist`, generated bindings, and built binaries out of the template source, since local template generation copies files even if Git ignores them.

The frontend has a scoped npm override for minimatch 10.x in the lint dependency chain, using patched 11.0.8 or newer within major 11. Remove it once ESLint and TypeScript-ESLint adopt the patched major themselves. Recheck lint discovery and rule execution before changing this override.

This repository has no CI/CD pipelines or GitHub Actions workflows. Builds, linting, formatting checks, and template verification run manually on your machine. From a clean checkout, run the script for your platform after installing the prerequisites:

Windows (PowerShell 7):

```powershell
./scripts/verify-template.ps1
```

macOS or Linux (Bash, including the Bash shipped with macOS):

```bash
./scripts/verify-template.sh
```

The scripts validate Base UI and Wails runtime dependencies, generate an app with a custom name and Go module path, install locked dependencies, and build the SQLite-enabled app using the standard command. They run frontend tests, version fixtures/drift checks, Go settings/SQLite tests and vet, TypeScript, ESLint, and formatting checks, and verify that the default app links SQLite. They preserve the generated app at its printed temporary path. Exercise native dialogs, clipboard/notification permissions, command focus/keyboard behavior, restart persistence, and multi-window settings with `wails3 dev` on each target OS; builds and mocks do not replace those checks.

On Linux, the Bash script checks GTK4 + WebKitGTK 6.0 with `pkg-config`. Install native dependencies as described in the [Wails v3 installation guide](https://v3.wails.io/quick-start/installation/). Optional extra build tags can be supplied with `WAILS_BUILD_TAGS`; `gtk3` is not supported by Wails 3.1. On macOS, install Xcode command-line tools with `xcode-select --install`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution and verification steps.

## License

MIT; see [LICENSE](LICENSE). Copied shadcn components retain their upstream copyright and MIT license in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Keep these notices with redistributed template code. For your own app, add your application's copyright and licensing without removing upstream notices.

References: [Wails v3 custom templates](https://v3.wails.io/guides/advanced/custom-templates/), [Wails v3 migration](https://v3.wails.io/migration/v2-to-v3/), [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite).
