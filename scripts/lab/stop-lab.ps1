$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

Write-Output ("eChat Web: " + (Stop-LabOwnedProcess "echat-web"))
Write-Output ("eChat API: " + (Stop-LabOwnedProcess "echat-api"))
Write-Output (Invoke-ChatwootLab "stop")
Write-Output "The shared Windows PostgreSQL service is left running."
