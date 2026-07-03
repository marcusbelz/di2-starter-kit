#requires -version 5
<#
.SYNOPSIS
  Create a new project from the DI2 Starter Kit (local copy + fresh git repo).
.DESCRIPTION
  Copies the template (excluding this repo's .git and dependency/build dirs) into -Target,
  initializes a fresh git repository, makes an initial commit, and reminds you to run /init.
.PARAMETER Target
  Destination directory for the new project. Must not already exist (or must be empty).
.EXAMPLE
  .\scripts\new-project.ps1 -Target c:\sandbox\github\my-new-project
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $Target
)

$ErrorActionPreference = 'Stop'

# Repo root = parent of the scripts/ dir this file lives in.
$Source = Split-Path -Parent $PSScriptRoot

if (Test-Path -LiteralPath $Target) {
  $existing = Get-ChildItem -LiteralPath $Target -Force | Where-Object { $_.Name -ne '.git' }
  if ($existing) { throw "Target '$Target' already exists and is not empty." }
} else {
  New-Item -ItemType Directory -Path $Target -Force | Out-Null
}

Write-Host "Copying template -> $Target ..."
# robocopy: /E recurse incl. empty dirs, /XD exclude dirs. Exit codes 0-7 are success.
$null = robocopy $Source $Target /E /XD '.git' 'node_modules' '.venv' 'dist' 'build' '.next' /XF '*.log' /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)." }

Push-Location $Target
try {
  git init -q
  git add -A
  git commit -q -m "chore: initialize from di2-starter-kit"
  Write-Host ""
  Write-Host "Done. New project created at: $Target" -ForegroundColor Green
  Write-Host "Next: open it in Claude Code and run  /init" -ForegroundColor Cyan
} finally {
  Pop-Location
}
