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
if (-not (Test-Path -LiteralPath (Join-Path $taskTemplate 'template.json'))) {
    throw 'Run this maintenance script from a template checkout, not a generated app.'
}

foreach ($taskRelative in @('frontend/node_modules', 'frontend/dist', 'frontend/wailsjs', 'build/bin')) {
    if (Test-Path -LiteralPath (Join-Path $taskTemplate $taskRelative)) {
        throw "Remove generated output from the template before verification: $taskRelative"
    }
}

$taskConfig = Get-Content -LiteralPath (Join-Path $taskTemplate 'frontend/components.json') -Raw | ConvertFrom-Json -AsHashtable
if (-not $taskConfig.style.StartsWith('base-')) { throw 'shadcn must use a Base UI style.' }

$taskPackage = Get-Content -LiteralPath (Join-Path $taskTemplate 'frontend/package.json') -Raw | ConvertFrom-Json -AsHashtable
if (-not $taskPackage.dependencies.ContainsKey('@base-ui/react')) { throw 'Base UI dependency is missing.' }

$taskLock = Get-Content -LiteralPath (Join-Path $taskTemplate 'frontend/package-lock.json') -Raw | ConvertFrom-Json -AsHashtable
if (@($taskLock.packages.Keys | Where-Object { $_ -match 'radix-ui' }).Count -gt 0) {
    throw 'Radix dependencies must not be present in this Base UI template.'
}

$taskScratch = Join-Path ([System.IO.Path]::GetTempPath()) ('wails-template-verify-' + [guid]::NewGuid().ToString('N'))
$taskApp = Join-Path $taskScratch 'template-check-app'
New-Item -ItemType Directory -Path $taskScratch | Out-Null

# Keep the generated app for inspection, including when a check fails.
Write-Output "Generated app: $taskApp"
Invoke-Checked 'wails' @('init', '-n', 'template-check-app', '-d', $taskApp, '-t', $taskTemplate)

foreach ($taskRelative in @('main.go', 'app.go', 'go.mod', 'wails.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskApp $taskRelative))) {
        throw "Generated app is missing $taskRelative"
    }
}
if (Test-Path -LiteralPath (Join-Path $taskApp 'template.json')) {
    throw 'Template metadata should not be copied into generated apps.'
}

Push-Location $taskApp
try {
    Invoke-Checked 'wails' @('build', '-clean')
    Invoke-Checked 'go' @('vet', './...')
    Invoke-Checked 'npm' @('run', 'typecheck', '--prefix', 'frontend')
    Invoke-Checked 'npm' @('run', 'lint', '--prefix', 'frontend')
    Invoke-Checked 'npm' @('run', 'format:check', '--prefix', 'frontend')
    $taskExecutable = Join-Path $taskApp 'build/bin/template-check-app.exe'
    if (-not (Test-Path -LiteralPath $taskExecutable)) { throw 'Windows executable was not generated.' }
} finally {
    Pop-Location
}

Write-Output 'Template generation, Base UI dependencies, TypeScript, ESLint, Prettier, Go vet, and Windows build passed.'
