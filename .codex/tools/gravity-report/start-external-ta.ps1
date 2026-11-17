param([switch]$Background)

$ErrorActionPreference = 'Stop'
$profile = Join-Path $env:LOCALAPPDATA 'GravityWeComReport/TA-Chrome'
$chrome = Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'
if (!(Test-Path -LiteralPath $chrome)) { throw '找不到 Google Chrome' }
$launch = @{}
if ($Background) { $launch.WindowStyle = 'Hidden' }
Start-Process @launch -FilePath $chrome -ArgumentList '--no-first-run','--remote-debugging-port=9223',
    ('--user-data-dir="'+$profile+'"'),'https://ta-data.feiyu.com'
