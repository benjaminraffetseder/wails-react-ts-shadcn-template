# Contributing

Open an issue to report a bug or propose a change. For a bug, include your OS,
Go/Node/Wails versions, the exact generation or build command, and the error.
Remove credentials and private data from logs before sharing them.

Keep this starter small and use shadcn's Base UI components. Do not add app-specific
services or switch to Radix. Update the README when setup or extension steps change.

## Validate a change

Install the prerequisites listed in the README. From a clean template checkout,
run the script for your platform.

Windows with PowerShell 7:

```powershell
./scripts/verify-template.ps1
```

macOS or Linux with Bash:

```bash
./scripts/verify-template.sh
```

Each script generates an app in your temporary directory, validates the Base UI
configuration, builds a native executable, and runs TypeScript, ESLint, Prettier,
and Go checks.
It prints the generated app path and preserves it so you can inspect it. Linux
verification selects the WebKitGTK 4.1 build tag when those libraries are available.
For explicit tags, use `WAILS_BUILD_TAGS=webkit2_41 ./scripts/verify-template.sh`.

For UI changes, run `wails dev` in that generated app and check navigation,
the Go greeting form, dialog keyboard controls and focus return, and theme
persistence. If verification used build tags, pass the same tags to `wails dev`.
For localized UI changes, check both English and German, language persistence after
reload, dialog close labels, and the translated Go greeting. Update both locale
JSON files when adding a translation key.
Validation is manual, with no CI/CD workflows. Report which platform and tags you
verified when submitting a change; a successful build does not replace UI checks.

Do not commit `node_modules`, `dist`, generated bindings, app binaries, or
credentials to the template. Dependency changes must include the updated npm
lockfile. Keep the license and third-party notices with copied components.

In a generated app's `frontend` folder, use `npm run lint` and
`npm run format:check` to check your edits. Apply fixes with `npm run lint:fix`
and `npm run format`. Keep generated Wails bindings out of linting and formatting;
the supplied ignore patterns already exclude them.
