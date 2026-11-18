# Desktop features

These examples run in a **generated app**, after `wails3 build` has generated
bindings. All source belongs to your project and can be edited or removed.

## Application settings

```tsx
import { useAppSettings } from "@/hooks/use-app-settings"

const { settings, status, isLoading, isSaving, error, updateSettings, resetSettings } = useAppSettings()
await updateSettings({ theme: "dark" })
await updateSettings({ language: "de" })
await resetSettings()
```

Actions reject on failure. Catch rejections in event handlers; the shared error
also appears in the app shell. State changes only after a successful write.
`source` is `native` or `preview`; preview writes save only in this browser.
`status` is `loading`, `ready`, `saving`, or `error`.

Go's `internal/preferences` owns schema version 1, defaults, validation, serialized
partial updates, and persistence. `SettingsService` exposes typed methods through
generated bindings. Native files live at `os.UserConfigDir()/AppID/settings.json`:

| Platform | Default configuration directory |
| --- | --- |
| Windows | `%APPDATA%/<app-name>/` |
| macOS | `~/Library/Application Support/<app-name>/` |
| Linux | `$XDG_CONFIG_HOME/<app-name>/` or `~/.config/<app-name>/` |

The app ID is generated in `internal/apppaths/paths.go`. Keep it stable after
release; renaming it changes the storage location. Paths never come from React.
Writes use a private temporary file in the same directory, sync and close it,
then rename it over the destination without deleting the old file first.
Filesystem guarantees for replacement vary by OS and filesystem. There is no
cross-process locking: supported windows in one Wails application share a service
and its mutex. Separate concurrent app processes are outside this starter's scope.

`GetSettings` creates persisted defaults on first launch: system theme and English.
Existing native settings remain authoritative, including values explicitly reset
to defaults. Corrupt or future schemas stop reads/updates and leave the file
intact. **Retry** reloads after you
fix the problem. **Reset to defaults** explicitly recovers an invalid file and
first preserves its bytes in `settings.json.backup-<timestamp>`. If a backup or
write is impossible, reset reports an error and leaves the original intact.

React bootstraps settings before mounting the shell, applies theme and language,
then follows system theme changes. `useTheme().setTheme()` also uses this settings
API. Use `updateSettings({ language })` for persistent language changes;
`i18n.changeLanguage()` alone is a presentation operation. Settings events carry a
revision so delayed replies cannot revert newer successful changes. Mounted
consumers and windows update through `settings:changed`; browser tabs use storage
events. There is no live watch for externally edited native files.

Late responses from a replaced settings adapter cannot change the current state;
pending actions reject if their adapter was superseded. A successful reload clears
read errors, while a failed save remains visible until a successful save or an
explicit retry. Superseded reads cannot report or clear errors or finish a newer
read's loading state. Starting a save or reset also supersedes older reads, and
native events protect newer settings from older read failures.
Native recovery keeps revisions increasing even if the settings
file was removed; revision values are bounded by JavaScript's exact integer range.

Browser preview reads/writes one `desktop-settings` localStorage record. Without a
saved record it uses system theme and the first supported browser language.
Restricted storage failures are visible; they are not reported as saved native
preferences.
Clearing or replacing browser storage is reflected on refresh and retry, even
when its revision restarts. Superseded preview reads cannot undo newer changes;
native settings continue to use Go's increasing revisions.

To extend preferences, add the field and default/validation/merge logic in Go and
the frontend settings types/validation. Add a schema migration before raising
`schemaVersion`; unknown versions currently fail safely. Regenerate bindings with
Wails. Preferences are public values: never put passwords, tokens, or keys here.

## Native hooks

The Overview screen has interactive dialogs, clipboard copy/read, window actions,
and notifications. Preview renders the examples with a clear explanation and
disabled native controls.

```tsx
const { openFile, openFiles, selectDirectory, saveFile, busy } = useFileDialog()
const { writeText, readText, canRead } = useClipboard()

try {
  const result = await openFile({
    Filters: [{ DisplayName: "Images", Pattern: "*.png;*.jpg" }],
  })
  if (result.status === "selected") await writeText(result.path)
} catch (error) {
  // DesktopError.code: unavailable | unsupported | permission | busy | operation
}
```

Import hooks from `@/hooks/use-file-dialog`, `use-clipboard`, `use-app-window`,
`use-notification`, `use-desktop`, and `use-wails-event` respectively. File dialog
options use Wails 3.1's names, including **capitalized** fields. The convenience
methods own file/directory and single/multiple-selection flags.

- Single selections: `{ status: "selected", path }` or `{ status: "cancelled" }`.
- Multiple selections: `{ status: "selected", paths }` or `{ status: "cancelled" }`.
- Choosing a save destination returns a path; it does not write a file.
- Clipboard: `writeText(text)`, `readText()`, `canRead`, `available`, `busy`, `error`.
- Window: `minimize()`, `maximize()`, `restore()`, `toggleMaximize()`, `close()`.
- Notifications: `notify({ title, body?, id?, silent? })`. Permission is requested
  only on an explicit call. macOS requires a properly bundled/signed application;
  Linux needs a notification daemon/D-Bus; Windows uses system toast support.
  OS delivery policies can suppress an accepted notification.

Actions return promises and reject with `DesktopError`; cancellation is a normal
dialog result. Hooks expose `available`, `busy`, and `error`, guard calls at
execution time, prevent overlapping operations on the same hook, and avoid state
updates after unmount. `available` means desktop runtime ready; platform policies
and notification permissions are resolved when an action is requested. Unsupported
capabilities fail explicitly. Errors that the runtime exposes only as general
failures retain their diagnostic message under `operation`.

Dialogs, clipboard, window controls and events use `@wailsio/runtime` directly.
Wails 3.1 notifications use its existing Go notifications service, wrapped only
to isolate startup failures and normalize permission errors. No browser-native
clipboard or web-notification fallback simulates desktop success.

```tsx
useWailsEvent("settings:changed", (event) => {
  console.log(event.data.theme)
})
```

Register custom data with `application.RegisterEvent[YourPayload]("feature:event")`
in Go, then regenerate bindings. Wails emits the event types automatically. The
hook retains the latest callback and unsubscribes on unmount or name/enable
changes, including React Strict Mode. Its optional third parameter enables or
disables the subscription. It never subscribes during SSR or browser preview.

## Command palette

Use **⌘K / Ctrl+K** or the sidebar launcher. Arrow keys select, Enter runs, and
Escape dismisses and returns focus. Navigation comes from `src/lib/routes.ts`;
add a route there and its screen in `app.tsx`. Built-in theme/language commands
call the same persisted settings API as Settings. English and German search
keywords work alongside current translated labels and groups.

Feature components can register commands without modifying the palette:

```tsx
import { useMemo } from "react"
import { useCommands } from "@/components/command-palette"
import type { AppCommand } from "@/lib/commands"

const commands = useMemo<AppCommand[]>(() => [{
  id: "notes.refresh",
  group: t("notes.group"),
  label: t("notes.refresh"),
  keywords: ["reload"],
  enabled: () => !loading,
  run: async () => { await refreshNotes() },
}], [t, loading, refreshNotes])
useCommands(commands)
```

Add those translation keys to both locale files. IDs must be unique. `icon`,
`shortcut`, `hidden`, and `disabledReason` are optional. `useCommands` cleans up
on unmount/dependency changes. For imperative integration,
`useCommandPalette().registerCommand(command)` returns an unregister function;
the caller owns that cleanup. Predicates run when rendering and again at execution;
keep reactive inputs in the memo dependencies. `shortcut` is a display label,
not another keyboard registration.

Only one command runs at a time. Failures remain visible in the open palette and
can be retried. Native commands should supply capability predicates/reasons or be
hidden in preview. The keyboard listener respects `event.defaultPrevented`, skips
key repeats, and is removed with the provider. The official `base-nova` Command
uses cmdk inside our Base UI Dialog. cmdk has transitive Radix dependencies;
application components do not import Radix primitives.

Commands return focus to the palette opener by default. A command that focuses
an inline editor or opens another dialog can set `restoreFocus: false`:

```tsx
{
  id: "notes.new",
  group: t("notes.group"),
  label: t("notes.new"),
  restoreFocus: false,
  run: () => openNoteEditor(),
}
```

The editor owns its initial focus. Failed commands keep the palette open and
restore normal focus handling; opening the palette again also restores the default.

## Optional custom title bar

Generated apps use the operating system's title bar by default. To use the bundled
React title bar, make these two changes in a generated app:

1. Add `Frameless: true` to `application.WebviewWindowOptions` in `main.go`.
2. Change the layout route in `frontend/src/app.tsx` to
   `<Route element={<AppLayout customTitlebar />}>`.

`WindowTitlebar` uses the translated `app.title`, replaces the sidebar branding,
and calls the existing `useAppWindow` minimize, maximize/restore, and close actions.
Its background is draggable through Wails' `--wails-draggable` CSS property;
buttons remain interactive. Native controls are disabled in browser preview and
errors appear below the bar. Closing follows the native window's normal lifecycle.
The custom title bar does not install tray behavior or change close into hide.

Keep native shadows, resize borders, and platform window defaults unless your app
needs a different treatment. Check dragging, resizing, double-click behavior,
window controls, and keyboard access on every target OS before shipping a frameless
window. Revert both edits to return to the native title bar.

Tray icons, global shortcuts, shortcut recording, and secondary picker windows
are application-specific opt-in extensions. Add their Wails lifecycle handling
when an app needs them; keep prompt data and picker workflows in that app.

## SQLite support

SQLite is enabled out of the box. Native startup opens the app-specific database
and applies migrations automatically. Use the normal commands from the generated
app root; no SQLite-specific build tag or environment variable is needed:

```sh
wails3 dev
# Stop development with Ctrl+C before building or packaging:
wails3 build
wails3 package
go test ./...
```

The Overview example lists, adds, edits, completes, and deletes records in native
mode. Browser preview shows an explanation and does not call the database.
All CRUD bindings are explicit business methods on `ItemsService`. SQL and paths
stay in Go. The module uses **modernc.org/sqlite**, the same pure-Go driver Wails'
SQLite service uses. The generic Wails SQLite service is deliberately not bound:
its arbitrary query/execute methods would cross this template's data boundary.
The driver is a normal Go dependency. Database files are created on the first
native launch; records survive development rebuilds and application restarts.

The database is `items.sqlite3` under the fixed application data directory:

| Platform | Default data directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%/<app-name>/` |
| macOS | `~/Library/Application Support/<app-name>/` |
| Linux | `$XDG_DATA_HOME/<app-name>/` or `~/.local/share/<app-name>/` |

`internal/items` embeds numbered `migrations/NNN_description.sql` files, applies
pending versions in numeric order in a transaction, and records applied versions.
Never edit an applied migration; add the next numbered file. A failed migration
rolls back that startup's migration changes, closes the connection, and makes all
dependent methods report `items:migration`. Initialization, constraint, and query
errors have distinct prefixes too. Existing databases are never deleted to recover.
The UI surfaces failures; fix the cause and restart after initialization failures.

Statements are parameterized. Each CRUD mutation is one atomic SQL statement;
migrations demonstrate multi-statement transaction rollback. The connection uses
WAL, a 5-second busy timeout, foreign keys, and one connection so connection-local
settings remain consistent. Wails service shutdown closes it. No server, account,
or external SQLite executable is needed after dependencies are installed.

To adapt the example, change the record type and parameterized operations in
`internal/items`, expose your business methods in `items_service.go`, and replace
`ItemsDemo` with your application UI. Wails regenerates the typed bindings during
development/build. Keep database access in Go.

To remove SQLite completely:

1. Remove the `ItemsDemo` import/render in `home-page.tsx`, its component, and its test.
2. Remove the `NewItemsService()` registration from `main.go`.
3. Remove `items_service.go`, `items_service_test.go`, and `internal/items/`.
4. Run `go mod tidy` and `wails3 build` to refresh dependencies and generated
   bindings. Remove SQLite-specific assertions/file checks from your verification script.

Settings and routing do not depend on the database. Removing source never deletes
existing user data; remove that data manually only when intended.

## One application version

`frontend/package.json` is authoritative. Use stable `MAJOR.MINOR.PATCH` with no
leading zeroes and each segment at most 65535. Prerelease/build metadata is rejected.

```sh
cd frontend
npm version patch --no-git-tag-version
npm run version:check
```

The npm `version` lifecycle synchronizes immediately. `predev`, `prebuild`, and
`prebuild:dev`, plus the root Wails build/package/dev tasks, run synchronization.
After editing JSON manually, run `node scripts/sync-version.mjs` at the app root.
`--check` lists drift, exits nonzero, and performs no writes.

Targets: both npm lockfile root versions; **info.version** in `build/config.yml`;
Windows version resources, application assembly identity, NSIS and both MSIX
manifests; macOS bundle/short versions in both plists; Linux nfpm version; and
`internal/buildinfo/version.txt`, embedded by Go and read in Settings/About.
MSIX uses a trailing `.0`. The release plist's missing `CFBundleVersion` is added
once. Wails' top-level config schema version and Windows Common-Controls dependency
version remain unchanged. No app name, executable name, or bundle ID is matched.

All targets and source values are validated before writing any changed files.
Missing core files or unexpected target fields fail without modifying anything.
Entire `build/windows`, `build/darwin`, or `build/linux` directories may deliberately
be removed to drop a platform; if a platform directory exists, every supported
target inside it is required. Individual missing platform files are errors.
No-op runs retain file timestamps. Custom packaging metadata and line endings are
preserved where feasible. Validation safety is not an all-files filesystem
transaction: an I/O failure during writing may require fixing permissions and
running sync again.

After `wails3 task common:update:build-assets`, run synchronization again because
Wails may regenerate metadata. Direct `go build` bypasses npm/Wails tasks: run sync
first, then build. Native builds display the embedded version; preview uses the
package version. This feature performs no network checks, updates, tags, or releases.

The approach follows [RoomDrop's version sync](https://github.com/benjaminraffetseder/roomdrop/blob/main/scripts/sync-version.mjs),
adapted to generated names and Wails 3.1 output. The fixture suite also runs against
actual platform files when executed in a freshly generated app.

## Verification

From template source, run the platform script in `scripts/verify-template.*`.
It generates a custom-name/custom-module app, builds with SQLite using ordinary commands,
checks version fixtures and drift, tests Go persistence/migrations and mocked
frontend hooks/palette/settings, and runs TypeScript, lint, formatting, and Go vet.
The generated app stays in its printed temporary directory for inspection.

From a generated app, run `npm test --prefix frontend`,
`npm run test:version --prefix frontend`, and `go test ./...` after a
build. Native OS dialogs, permissions, notifications, restart persistence, and
multi-window delivery still need manual checks on each target OS. Mocked hooks
and builds cannot establish those OS-specific behaviors.
