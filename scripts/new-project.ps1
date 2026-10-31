#requires -version 5
<#
.SYNOPSIS
  Create a new project from the DI2 Starter Kit (local copy + fresh git repo).
.DESCRIPTION
  Copies the committed template (`git archive HEAD`) into -Target, initializes a fresh git
  repository, makes an initial commit, and reminds you to run /init.
  Only committed content is copied - untracked, ignored and uncommitted files never reach the
  new project (local settings, stray dumps); commit template edits first if you want them.
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

$null = git -C $Source rev-parse --verify -q HEAD
if ($LASTEXITCODE -ne 0) {
  throw "Template '$Source' is not a git checkout with a commit - the copy is taken from HEAD. Clone the template with git (or use GitHub's 'Use this template'), then retry."
}

if (Test-Path -LiteralPath $Target) {
  $existing = Get-ChildItem -LiteralPath $Target -Force | Where-Object { $_.Name -ne '.git' }
  if ($existing) { throw "Target '$Target' already exists and is not empty." }
} else {
  New-Item -ItemType Directory -Path $Target -Force | Out-Null
}

if (git -C $Source status --porcelain) {
  Write-Host "Note: the template has uncommitted or untracked changes - they are NOT copied (only the committed HEAD is)." -ForegroundColor Yellow
}

Write-Host "Copying template (committed HEAD) -> $Target ..."
# git archive: exactly the committed tree, checked out with the template's .gitattributes
# (eol=lf files arrive with LF) - no .git, no ignored or untracked files.
$zip = Join-Path ([System.IO.Path]::GetTempPath()) ("di2-starter-kit-" + [guid]::NewGuid().ToString('N') + '.zip')
try {
  git -C $Source archive --format=zip -o $zip HEAD
  if ($LASTEXITCODE -ne 0) { throw "git archive failed (exit $LASTEXITCODE)." }
  Expand-Archive -LiteralPath $zip -DestinationPath $Target -Force
} finally {
  if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
}

# Executable files of the template - Windows has no executable bit, so git add records 644.
$execPaths = @(git -C $Source ls-tree -r HEAD | Where-Object { $_ -match '^100755 ' } | ForEach-Object { ($_ -split "`t", 2)[1] })

Push-Location $Target
try {
  # -b main: deterministic initial branch regardless of the user's init.defaultBranch (git >= 2.28)
  git init -q -b main
  git add -A
  if ($execPaths.Count -gt 0) { git update-index --chmod=+x -- @execPaths }
  # Record which kit version the project starts from (git archive copies no tags; /init's project
  # README quotes this for its lineage line).
  $kitVersion = git -C $Source describe --tags --always
  if (-not $kitVersion) { $kitVersion = 'unknown' }
  git commit -q -m "chore: initialize from di2-starter-kit $kitVersion"
  Write-Host ""
  Write-Host "Done. New project created at: $Target" -ForegroundColor Green
  Write-Host "Next: open it in Claude Code and run  /init" -ForegroundColor Cyan
} finally {
  Pop-Location
}
