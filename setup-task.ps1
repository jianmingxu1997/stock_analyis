# Stock Data Update - Scheduled Task Setup
# Run as Administrator

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Stock Data Update - Task Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$TaskName = "StockDataUpdate"
$TaskPath = "\Stock\"
$NodePath = "C:\Program Files\nodejs\node.exe"
$ScriptPath = "C:\Users\Bob\.openclaw\workspace\stock-data\update-daily-data.js"
$WorkDir = "C:\Users\Bob\.openclaw\workspace\stock-data"

# Check Node.js
Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
if (Test-Path $NodePath) {
    Write-Host "   OK: $NodePath" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Node.js not found!" -ForegroundColor Red
    exit 1
}

# Check Script
Write-Host ""
Write-Host "[2/4] Checking Script..." -ForegroundColor Yellow
if (Test-Path $ScriptPath) {
    Write-Host "   OK: $ScriptPath" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Script not found!" -ForegroundColor Red
    exit 1
}

# Delete Old Task
Write-Host ""
Write-Host "[3/4] Removing Old Task..." -ForegroundColor Yellow
try {
    Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "   OK: Old task removed" -ForegroundColor Green
} catch {
    Write-Host "   OK: No old task" -ForegroundColor Cyan
}

# Create New Task
Write-Host ""
Write-Host "[4/4] Creating New Task..." -ForegroundColor Yellow

$action = New-ScheduledTaskAction -Execute $NodePath -Argument "`"$ScriptPath`"" -WorkingDirectory $WorkDir
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 4pm
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest

try {
    Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Auto update stock data at 16:00 on weekdays" -Force | Out-Null
    Write-Host "   OK: Task created!" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Verify
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$task = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "Task Name: $TaskName" -ForegroundColor White
    Write-Host "Schedule: Mon-Fri 16:00" -ForegroundColor White
    Write-Host "Node: $NodePath" -ForegroundColor White
    Write-Host "Script: $ScriptPath" -ForegroundColor White
    Write-Host "Status: $($task.State)" -ForegroundColor White
}

Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
Write-Host "  Status: Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath" -ForegroundColor Gray
Write-Host "  Run: Start-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath" -ForegroundColor Gray
Write-Host ""
