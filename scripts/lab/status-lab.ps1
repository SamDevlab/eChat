$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$environment = Read-LabEnvironment
$database = $null
try { $database = Assert-LabDatabaseTarget $environment } catch { }
$apiOnline = Test-LabHttp "http://127.0.0.1:3001/api/health"
$webOnline = Test-LabHttp "http://127.0.0.1:5173/"
Write-Output ("eChat API: " + $(if ($apiOnline) { "ONLINE" } else { "OFFLINE" }))
Write-Output ("eChat Web: " + $(if ($webOnline) { "ONLINE" } else { "OFFLINE" }))
Write-Output ("Database environment: " + $(if ($database) { Get-LabDatabaseEnvironment $environment $database } else { "UNCLASSIFIED" }))
Write-Output ("eChat PostgreSQL (echat_test): " + $(if ($database -and (Test-LabDatabase $database)) { "ONLINE" } else { "OFFLINE OR UNSAFE TARGET" }))

try { Write-Output (Invoke-ChatwootLab "status") } catch { Write-Output "Chatwoot LAB: STATUS UNAVAILABLE" }

$outboundMode = if ($environment.ContainsKey("ECHAT_OUTBOUND_MODE")) { $environment["ECHAT_OUTBOUND_MODE"] } else { "not configured" }
$allowlist = if ([string]::IsNullOrWhiteSpace($environment["ECHAT_OUTBOUND_PILOT_CONVERSATIONS"])) { "EMPTY" } else { "SET" }
Write-Output "Outbound mode: $outboundMode"
Write-Output "Outbound allowlist: $allowlist"

$publicUrl = $environment["PUBLIC_APP_URL"]
if ([string]::IsNullOrWhiteSpace($publicUrl)) {
  Write-Output "Webhook public URL: UNCONFIGURED"
} else {
  $persistent = $environment["PUBLIC_URL_PERSISTENT"] -eq "1"
  $reachable = Test-LabHttp ($publicUrl.TrimEnd('/') + "/api/health")
  Write-Output ("Webhook public URL: " + $(if ($reachable) { "REACHABLE" } else { "OFFLINE" }) + $(if ($persistent) { " (persistent declared)" } else { " (temporary or stability unconfirmed)" }))
}
