$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$metadata = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$releaseRoot = Join-Path $projectRoot 'release'
$stage = Join-Path $releaseRoot ('web-' + $metadata.version)
$archive = Join-Path $releaseRoot ('Cashflow-' + $metadata.version + '-web.zip')
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/index.html'))) {
  throw 'Run npm run build before packaging the web release.'
}
if ((Test-Path -LiteralPath $stage) -or (Test-Path -LiteralPath $archive)) {
  throw 'This web release already exists. Use a new version or choose a fresh output directory.'
}
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'dist') | Copy-Item -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'web/serve.cjs') -Destination $stage
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $stage
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs') -Destination $stage -Recurse
Get-ChildItem -LiteralPath $stage | Compress-Archive -DestinationPath $archive -CompressionLevel Optimal
Write-Output $archive
