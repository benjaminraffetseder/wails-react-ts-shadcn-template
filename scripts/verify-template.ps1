[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter()][string[]]$Arguments = @()
    )
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE."
    }
}

$taskTemplate = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not (Test-Path -LiteralPath (Join-Path $taskTemplate 'template.yaml'))) {
    throw 'Run this maintenance script from a template checkout, not a generated app.'
}

foreach ($taskRelative in @('frontend/node_modules', 'frontend/dist', 'frontend/bindings', 'bin', '.task')) {
    if (Test-Path -LiteralPath (Join-Path $taskTemplate $taskRelative)) {
        throw "Remove generated output from the template before verification: $taskRelative"
    }
}

$taskConfig = Get-Content -LiteralPath (Join-Path $taskTemplate 'frontend/components.json') -Raw | ConvertFrom-Json -AsHashtable
if (-not $taskConfig.style.StartsWith('base-')) { throw 'shadcn must use a Base UI style.' }

$taskPackage = Get-Content -LiteralPath (Join-Path $taskTemplate 'frontend/package.json') -Raw | ConvertFrom-Json -AsHashtable
if (-not $taskPackage.dependencies.ContainsKey('@base-ui/react')) { throw 'Base UI dependency is missing.' }
if ($taskPackage.dependencies['@wailsio/runtime'] -ne '3.0.0') { throw 'The Wails runtime must match the pinned Go dependency.' }

$taskLock = Get-Content -LiteralPath (Join-Path $taskTemplate 'frontend/package-lock.json') -Raw | ConvertFrom-Json -AsHashtable
if (@($taskLock.packages.Keys | Where-Object { $_ -match 'radix-ui' }).Count -gt 0) {
    throw 'Radix dependencies must not be present in this Base UI template.'
}

$taskScratch = Join-Path ([System.IO.Path]::GetTempPath()) ('wails-template-verify-' + [guid]::NewGuid().ToString('N'))
$taskApp = Join-Path $taskScratch 'template-check-app'
New-Item -ItemType Directory -Path $taskScratch | Out-Null

# Keep the generated app for inspection, including when a check fails.
Write-Output "Generated app: $taskApp"
Invoke-Checked 'wails3' @('init', '-n', 'template-check-app', '-d', $taskScratch, '-t', $taskTemplate, '-mod', 'example.com/template-check-app')

foreach ($taskRelative in @('main.go', 'app.go', 'go.mod', 'Taskfile.yml', 'build/config.yml', '.gitignore', 'frontend/vite.config.ts', 'frontend/tsconfig.json', 'frontend/tsconfig.app.json', 'frontend/src/hooks/use-desktop.ts', 'frontend/src/pages/home-page.tsx', 'LICENSE', 'THIRD_PARTY_NOTICES.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskApp $taskRelative))) {
        throw "Generated app is missing $taskRelative"
    }
}
foreach ($taskRelative in @('template.yaml', 'template.json', 'wails.json', 'wails.tmpl.json', 'frontend/src/lib/backend.ts', 'frontend/src/pages/home-page.tsx.tmpl', 'frontend/vite.config.ts.tmpl', 'frontend/tsconfig.json.tmpl', 'frontend/tsconfig.app.json.tmpl')) {
    if (Test-Path -LiteralPath (Join-Path $taskApp $taskRelative)) {
        throw "Unexpected template metadata, obsolete file, or unprocessed template: $taskRelative"
    }
}
$taskViteConfig = Get-Content -LiteralPath (Join-Path $taskApp 'frontend/vite.config.ts') -Raw
if (-not $taskViteConfig.Contains('const goModule = "example.com/template-check-app"')) {
    throw 'The Vite binding alias must follow the selected Go module path.'
}
foreach ($taskRelative in @('frontend/tsconfig.json', 'frontend/tsconfig.app.json')) {
    $taskTsConfig = Get-Content -LiteralPath (Join-Path $taskApp $taskRelative) -Raw | ConvertFrom-Json -AsHashtable
    if ($taskTsConfig.compilerOptions.paths['@wails/*'][0] -ne './bindings/example.com/template-check-app/*') {
        throw "The TypeScript binding alias must follow the selected Go module path: $taskRelative"
    }
}

Push-Location $taskApp
try {
    Invoke-Checked 'npm' @('ci', '--prefix', 'frontend')
    Invoke-Checked 'wails3' @('build')
    Invoke-Checked 'go' @('vet', './...')
    Invoke-Checked 'npm' @('run', 'typecheck', '--prefix', 'frontend')
    Invoke-Checked 'npm' @('run', 'lint', '--prefix', 'frontend')
    Invoke-Checked 'npm' @('run', 'format:check', '--prefix', 'frontend')
    $taskExecutable = Join-Path $taskApp 'bin/template-check-app.exe'
    if (-not (Test-Path -LiteralPath $taskExecutable)) { throw 'Windows executable was not generated.' }
} finally {
    Pop-Location
}

Write-Output 'Template generation, Base UI dependencies, TypeScript, ESLint, Prettier, Go vet, and Windows build passed.'
