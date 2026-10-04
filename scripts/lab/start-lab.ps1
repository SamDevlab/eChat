$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$environment = Read-LabEnvironment
$database = Assert-LabDatabaseTarget $environment
if (-not (Test-LabDatabase $database)) { throw "Cannot connect to the configured echat_test database. Start the configured PostgreSQL service and retry." }

Write-Output "Preparing the isolated Chatwoot LAB services."
Write-Output (Invoke-ChatwootLab "start")

$migrationOutput = & npm run db:migrate 2>&1
if ($LASTEXITCODE -ne 0) {
  $migrationOutput | ForEach-Object { if ($_ -notmatch "postgres://|postgresql://|password|token|secret|credential") { Write-Output $_ } }
  throw "Database migration failed for echat_test. No alternate database was selected."
}

Write-Output ("eChat API: " + (Start-LabOwnedProcess "echat-api" "dev:api" 3001 "http://127.0.0.1:3001/api/health"))
Write-Output ("eChat Web: " + (Start-LabOwnedProcess "echat-web" "dev:web" 5173 "http://127.0.0.1:5173/"))
& (Join-Path $PSScriptRoot "status-lab.ps1")
