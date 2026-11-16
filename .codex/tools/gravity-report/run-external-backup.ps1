param(
    [Parameter(Mandatory=$true)][string]$MediaReportUrl,
    [string]$OutputPath,
    [switch]$AppendToHistory
)

$ErrorActionPreference = 'Stop'
$node = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (!(Test-Path -LiteralPath $node)) { throw '找不到 Codex 的 Node.js 运行环境。' }
$arguments = @((Join-Path $PSScriptRoot 'run.mjs'), '--backup', $MediaReportUrl)
if ($AppendToHistory -and $OutputPath) { throw '写入累计小时报时不能另指定输出路径。' }
if ($AppendToHistory) { $arguments += '--append-to-history' }
if ($OutputPath) { $arguments += $OutputPath }
$previousKind = $env:GRAVITY_REPORT_KIND
try {
    $env:GRAVITY_REPORT_KIND = 'external'
    & $node @arguments
    $exitCode = $LASTEXITCODE
} finally {
    $env:GRAVITY_REPORT_KIND = $previousKind
}
exit $exitCode
