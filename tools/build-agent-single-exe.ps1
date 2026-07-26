$ErrorActionPreference = "Stop"

$versionText = node --version
$major = [int]($versionText.TrimStart('v').Split('.')[0])
if ($major -lt 26) {
    throw "Node.js 26+ is required by this script because it uses the current built-in --build-sea workflow. Current: $versionText"
}

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repo
New-Item -ItemType Directory -Force -Path dist | Out-Null

$config = @{
    main = (Join-Path $repo "agent/index.js")
    output = (Join-Path $repo "dist/CaYaAgent.exe")
    disableExperimentalSEAWarning = $true
    useCodeCache = $false
} | ConvertTo-Json

$configPath = Join-Path $repo "dist/sea-config.json"
Set-Content -Path $configPath -Value $config -Encoding UTF8

node --build-sea $configPath
Write-Host "Built: $repo\dist\CaYaAgent.exe"
Write-Host "The executable is unsigned unless you sign it separately with your own code-signing certificate."
