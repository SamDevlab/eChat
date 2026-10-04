$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$environment = Read-LabEnvironment
$database = $null
try { $database = Assert-LabDatabaseTarget $environment } catch { }
$health = $false; $ready = $false
try { $health = [bool](Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/health" -TimeoutSec 3 -ErrorAction Stop).ok } catch { }
try { $ready = [bool](Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/ready" -TimeoutSec 3 -ErrorAction Stop).ok } catch { }
$dbVersion = "UNAVAILABLE"
if ($database) {
  try {
    $dbVersion = Invoke-LabDatabaseQuery $database "show server_version"
  } catch { }
}
$chatwootStatus = @()
try { $chatwootRawStatus = Invoke-ChatwootLab "status"; $chatwootStatus = @($chatwootRawStatus -split "`r?`n") } catch { $chatwootStatus = @("Chatwoot LAB status unavailable") }
$origin = $null
if ($environment["PUBLIC_APP_URL"]) { try { $origin = [Uri]$environment["PUBLIC_APP_URL"] } catch { } }
$publicHealth = $false
if ($origin) { $publicHealth = Test-LabHttp ($origin.GetLeftPart([UriPartial]::Authority) + "/api/health") }
$persistent = $environment["PUBLIC_URL_PERSISTENT"] -eq "1"
$allowlistEmpty = [string]::IsNullOrWhiteSpace($environment["ECHAT_OUTBOUND_PILOT_CONVERSATIONS"])
$migrations = @(Get-ChildItem (Join-Path $script:LabRepoRoot "packages\db\drizzle") -Filter "*.sql" -File | Sort-Object Name | Select-Object -ExpandProperty Name)
$gitHead = (& git -C $script:LabRepoRoot rev-parse --short HEAD 2>$null | Select-Object -First 1)
$nodeVersion = (& node --version 2>$null | Select-Object -First 1)
$package = Get-Content -LiteralPath (Join-Path $script:LabRepoRoot "package.json") -Raw | ConvertFrom-Json

$bundle = [ordered]@{
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  app = [ordered]@{ version = $package.version; gitHead = $gitHead; nodeVersion = $nodeVersion }
  database = [ordered]@{ environment = if ($database) { Get-LabDatabaseEnvironment $environment $database } else { "UNCLASSIFIED" }; name = if ($database) { $database.Database } else { "UNAVAILABLE" }; serverVersion = $dbVersion; migrations = $migrations }
  health = [ordered]@{ liveness = $health; readiness = $ready }
  chatwootLab = $chatwootStatus
  integrationDiagnostics = "Available to an authenticated Owner/Admin in Channels; this bundle does not include integration identifiers, credentials, webhook secrets, or message contents."
  callback = [ordered]@{ configured = [bool]$origin; reachable = $publicHealth; persistentDeclared = $persistent }
  outbound = [ordered]@{ mode = if ($environment["ECHAT_OUTBOUND_MODE"]) { $environment["ECHAT_OUTBOUND_MODE"] } else { "UNCONFIGURED" }; allowlistEmpty = $allowlistEmpty }
  includedSecrets = @()
}

New-Item -ItemType Directory -Force -Path $script:LabRuntimeDirectory | Out-Null
$bundlePath = Join-Path $script:LabRuntimeDirectory ("support-bundle-{0}.json" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
$bundle | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $bundlePath -Encoding utf8
Write-Output "Redacted support bundle created: $bundlePath"
