param([switch]$Managed)

$ErrorActionPreference = 'Stop'
$node = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (!(Test-Path -LiteralPath $node)) { throw '找不到 Codex 的 Node.js 运行环境。' }
if ($Managed) {
    $env:GRAVITY_PANEL_PORT = '8732'
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    try {
        $null = Invoke-RestMethod 'http://127.0.0.1:8732/api/job' -TimeoutSec 3
        exit 0
    } catch {
        # A previously started panel may still own the port. The next trigger can try again.
        if (Get-NetTCPConnection -LocalPort 8732 -State Listen -ErrorAction SilentlyContinue) { exit 1 }
    }
    $logDirectory = Join-Path $env:LOCALAPPDATA 'GravityWeComReport/logs'
    $null = New-Item -ItemType Directory -Path $logDirectory -Force
    $launcherLog = Join-Path $logDirectory 'panel-launcher.log'
    "$(Get-Date -Format o) Starting panel on port 8732" | Add-Content -LiteralPath $launcherLog
    & $node (Join-Path $PSScriptRoot 'panel.mjs') >> $launcherLog 2>&1
    "$(Get-Date -Format o) Panel exited with code $LASTEXITCODE" | Add-Content -LiteralPath $launcherLog
    exit 1
}
& $node (Join-Path $PSScriptRoot 'panel.mjs')
exit $LASTEXITCODE
