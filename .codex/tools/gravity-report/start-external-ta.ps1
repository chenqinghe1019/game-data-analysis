$ErrorActionPreference = 'Stop'
$profile = Join-Path $env:LOCALAPPDATA 'GravityWeComReport/TA-Chrome'
$chrome = Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'
if (!(Test-Path -LiteralPath $chrome)) { throw '找不到 Google Chrome' }
Start-Process -FilePath $chrome -ArgumentList '--remote-debugging-port=9223',
    ('--user-data-dir="'+$profile+'"'),'https://ta-data.feiyu.com'
