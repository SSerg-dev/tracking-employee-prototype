$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot 'data'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stdout = Join-Path $logDir 'server-out.log'
$stderr = Join-Path $logDir 'server-err.log'

Start-Process `
  -FilePath 'node' `
  -ArgumentList @('server.js') `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr `
  -WindowStyle Hidden

Start-Sleep -Seconds 2

$response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing
Write-Output "tracking-employee-prototype is running: $($response.StatusCode)"
