param(
	[string]$OutputDirectory = (Join-Path $PSScriptRoot '..\dist')
)

$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceDirectory = Join-Path $projectDirectory 'deckclipboard'
$version = ([xml](Get-Content -LiteralPath (Join-Path $sourceDirectory 'appinfo\info.xml') -Raw)).info.version
$outputDirectoryPath = [System.IO.Path]::GetFullPath($OutputDirectory)
$archivePath = Join-Path $outputDirectoryPath "deckclipboard-$version.zip"
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("deckclipboard-build-" + [guid]::NewGuid().ToString('N'))

try {
	New-Item -ItemType Directory -Path $outputDirectoryPath -Force | Out-Null
	New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null
	Copy-Item -LiteralPath $sourceDirectory -Destination $temporaryDirectory -Recurse
	if (Test-Path -LiteralPath $archivePath) {
		Remove-Item -LiteralPath $archivePath -Force
	}
	Compress-Archive -LiteralPath (Join-Path $temporaryDirectory 'deckclipboard') -DestinationPath $archivePath -CompressionLevel Optimal
	$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
	Write-Output "Package: $archivePath"
	Write-Output "SHA-256: $hash"
} finally {
	if (Test-Path -LiteralPath $temporaryDirectory) {
		Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
	}
}
