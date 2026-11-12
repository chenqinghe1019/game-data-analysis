$ErrorActionPreference = 'Stop'

$taskName = 'GravityWeComReport'
$account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$script = Join-Path $PSScriptRoot 'panel.ps1'
$powershell = (Get-Command pwsh.exe -CommandType Application).Source
$action = New-ScheduledTaskAction -Execute $powershell `
    -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -File "'+$script+'" -Managed') `
    -WorkingDirectory $PSScriptRoot
$logon = New-ScheduledTaskTrigger -AtLogOn -User $account
$periodic = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $logon,$periodic `
    -Principal $principal -Settings $settings -Description 'Keep the local Gravity WeCom report panel running.' -Force
Start-ScheduledTask -TaskName $taskName
