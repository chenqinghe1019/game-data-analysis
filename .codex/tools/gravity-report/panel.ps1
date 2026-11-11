$ErrorActionPreference = 'Stop'
$node = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (!(Test-Path -LiteralPath $node)) { throw '找不到 Codex 的 Node.js 运行环境。' }
& $node (Join-Path $PSScriptRoot 'panel.mjs')
exit $LASTEXITCODE
