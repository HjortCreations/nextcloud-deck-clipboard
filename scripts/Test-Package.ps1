param(
	[string]$NextcloudSchema = ''
)

$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$appDirectory = Join-Path $projectDirectory 'deckclipboard'
$infoPath = Join-Path $appDirectory 'appinfo\info.xml'
$jsPath = Join-Path $appDirectory 'js\deck-clipboard.js'
$requiredFiles = @(
	$infoPath,
	(Join-Path $appDirectory 'lib\AppInfo\Application.php'),
	(Join-Path $appDirectory 'lib\Listener\BeforeTemplateRenderedListener.php'),
	(Join-Path $appDirectory 'css\deck-clipboard.css'),
	$jsPath
)

foreach ($file in $requiredFiles) {
	if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
		throw "Required file is missing: $file"
	}
}

[xml]$info = Get-Content -LiteralPath $infoPath -Raw
if ($info.info.id -ne 'deckclipboard') {
	throw 'Unexpected app id in info.xml'
}
if ($info.info.dependencies.nextcloud.'min-version' -ne '34' -or $info.info.dependencies.nextcloud.'max-version' -ne '34') {
	throw 'The package must remain version-locked to Nextcloud 34 until a later release is tested.'
}

if ($NextcloudSchema -and (Test-Path -LiteralPath $NextcloudSchema -PathType Leaf)) {
	$settings = [System.Xml.XmlReaderSettings]::new()
	$settings.ValidationType = [System.Xml.ValidationType]::Schema
	$settings.Schemas.Add($null, $NextcloudSchema) | Out-Null
	$settings.add_ValidationEventHandler({
		param($sender, $eventArgs)
		throw $eventArgs.Message
	})
	$reader = [System.Xml.XmlReader]::Create($infoPath, $settings)
	try {
		while ($reader.Read()) { }
	} finally {
		$reader.Dispose()
	}
}

& node --check $jsPath
if ($LASTEXITCODE -ne 0) {
	throw 'JavaScript syntax validation failed.'
}

& node (Join-Path $projectDirectory 'tests\deck-clipboard.test.cjs')
if ($LASTEXITCODE -ne 0) {
	throw 'JavaScript unit tests failed.'
}

$application = Get-Content -LiteralPath (Join-Path $appDirectory 'lib\AppInfo\Application.php') -Raw
$listener = Get-Content -LiteralPath (Join-Path $appDirectory 'lib\Listener\BeforeTemplateRenderedListener.php') -Raw
if ($application -notmatch 'registerEventListener' -or $listener -notmatch "getApp\(\) !== 'deck'" -or $listener -notmatch 'Util::addStyle') {
	throw 'Expected Deck-only event registration was not found.'
}

Write-Output 'Package validation: OK'
