# Own two named ETW sessions with a total 64 MiB circular-file budget.
# Installed provider templates define named fields; unsupported schemas reject
# diagnostics without changing the original Graph operation or its cleanup.
param(
  [Parameter(Mandatory=$true)][ValidateSet('start','stop','decode')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$Manifest
)
$ErrorActionPreference = 'Stop'
$owner = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
if ($owner.version -ne 1 -or $owner.nonce -notmatch '^[0-9a-f-]{36}$') { throw 'Invalid recorder ownership' }
$private = [IO.Path]::GetFullPath($owner.private)
$temporary = [IO.Path]::GetFullPath($env:RUNNER_TEMP)
if (-not $private.StartsWith($temporary + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Recorder storage is outside runner temporary ownership' }
if ([IO.Path]::GetFileName($private) -ne ('ttsc-graph-etw-' + $owner.nonce)) { throw 'Recorder storage identity mismatch' }
$sessions = @(
  @{ name=('ttsc-graph-process-' + $owner.nonce); provider='Microsoft-Windows-Kernel-Process'; keywords='0x30'; size=4; file=(Join-Path $private 'process.etl') },
  @{ name=('ttsc-graph-file-' + $owner.nonce); provider='Microsoft-Windows-Kernel-File'; keywords='0x4f0'; size=60; file=(Join-Path $private 'file.etl') }
)
function Write-PrivateJson($Name, $Value) {
  [IO.File]::WriteAllText((Join-Path $private $Name), (ConvertTo-Json -InputObject $Value -Depth 12 -Compress), [Text.UTF8Encoding]::new($false))
}
function Write-OriginalAdmission($Session, $Receipt) {
  $path = Join-Path $private ($Session.provider + '-admitted.json')
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes((ConvertTo-Json -InputObject $Receipt -Depth 8 -Compress))
  $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
  try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush() } finally { $stream.Dispose() }
}
function Original-Receipt($Value) {
  if ($null -eq $Value -or $Value.api -ne 'StartTraceW' -or $Value.code -ne 0 -or [string]::IsNullOrEmpty($Value.id) -or $Value.id -eq '0' -or [string]::IsNullOrEmpty($Value.guid) -or [string]::IsNullOrEmpty($Value.file)) { throw 'Original native admission identity is unavailable' }
  $receipt = [TtscEtwSession+Receipt]::new()
  $receipt.api = $Value.api; $receipt.code = $Value.code; $receipt.id = $Value.id; $receipt.guid = $Value.guid; $receipt.file = $Value.file
  return $receipt
}
function Retire-Original($Original, $ExpectedFile) {
  if ($Original.file -cne $ExpectedFile) { throw 'Original admission output does not match the immutable recorder plan' }
  $result = [TtscEtwSession]::Stop($Original)
  foreach ($native in @($result.query, $result.stop)) {
    if ($null -ne $native -and $null -ne $native.file -and $native.file -cne $ExpectedFile) { $native.file = '[different output file]' }
  }
  return $result
}
function Read-Schema {
  $schemas = @()
  foreach ($session in $sessions) {
    $provider = Get-WinEvent -ListProvider $session.provider
    $requiredKeywords = if ($session.provider -eq 'Microsoft-Windows-Kernel-Process') { @('WINEVENT_KEYWORD_PROCESS','WINEVENT_KEYWORD_THREAD') } else { @('KERNEL_FILE_KEYWORD_FILENAME','KERNEL_FILE_KEYWORD_FILEIO','KERNEL_FILE_KEYWORD_OP_END','KERNEL_FILE_KEYWORD_CREATE','KERNEL_FILE_KEYWORD_DELETE_PATH') }
    $mask = [Convert]::ToInt64($session.keywords.Substring(2), 16)
    foreach ($name in $requiredKeywords) {
      $keyword = @($provider.Keywords | Where-Object { $_.Name -eq $name })
      if ($keyword.Count -ne 1 -or ($mask -band $keyword[0].Value) -ne $keyword[0].Value) { throw ('Installed keyword is not covered by the recorder mask: ' + $name) }
    }
    $ids = if ($session.provider -eq 'Microsoft-Windows-Kernel-Process') { @(1,2,3,4) } else { @(10,11,12,13,14,17,18,24,26) }
    $tasks = if ($session.provider -eq 'Microsoft-Windows-Kernel-Process') { @{1='ProcessStart';2='ProcessStop';3='ThreadStart';4='ThreadStop'} } else { @{10='NameCreate';11='NameDelete';12='Create';13='Cleanup';14='Close';17='SetInformation';18='SetDelete';24='OperationEnd';26='DeletePath'} }
    foreach ($id in @($provider.Events.Id | Select-Object -Unique)) {
      $templates = @($provider.Events | Where-Object { $_.Id -eq $id })
      if ($templates.Count -eq 0) { throw ('Installed provider lacks event ' + $id) }
      foreach ($event in $templates) {
        $template = [xml]$event.Template
        $names = @($template.template.data | ForEach-Object { [string]$_.name })
        if ($session.provider -eq 'Microsoft-Windows-Kernel-Process') {
          $required = if ($id -in @(1,2)) { @('ProcessID','CreateTime') } else { @('ProcessID','ThreadID') }
        } else {
          $required = switch ($id) {
            10 { @('FileKey','FileName') }; 11 { @('FileKey','FileName') }
            12 { @('Irp','FileObject','FileName','ShareAccess','CreateOptions','CreateAttributes') }
            24 { @('Irp','Status') }; 26 { @('Irp','FileObject','FilePath','InfoClass') }
            default { @('Irp','FileObject') }
          }
          if ($id -in @(12,13,14,17,18,26) -and -not ($names -contains 'ThreadId' -or $names -contains 'IssuingThreadId')) { throw 'Installed file event has no issuing thread field' }
        }
        if ($id -in $ids) {
          if ($event.Task.Name -ne $tasks[$id]) { throw ('Installed task semantics differ for event ' + $id) }
          foreach ($name in $required) { if (-not ($names -contains $name)) { throw ('Unsupported named event field ' + $name) } }
        }
        $schemas += @{ provider=$session.provider; id=$id; version=[int]$event.Version; task=$event.Task.Name; fields=$names; selectedKeywords=$session.keywords; keywords=@($provider.Keywords | Where-Object { $_.Name -in $requiredKeywords } | ForEach-Object { @{ name=$_.Name; value=[string]$_.Value } }) }
      }
    }
    foreach ($id in $ids) { if (-not (@($provider.Events.Id) -contains $id)) { throw ('Installed provider lacks required event ' + $id) } }
  }
  return $schemas
}
if ($Mode -in @('start','stop')) {
  Add-Type -Path (Join-Path $PSScriptRoot 'windows-etw-session.cs')
  & (Join-Path $PSScriptRoot 'windows-etw-session-contract.ps1')
}
if ($Mode -eq 'start') {
  $admission = @{ sessions=@($sessions | ForEach-Object { @{ name=$_.name; provider=$_.provider; file=$_.file; state='not-admitted'; attempted=$false } }) }
  Write-PrivateJson 'admission.json' $admission
  $started = @()
  try {
    $schemas = @(Read-Schema)
    Write-PrivateJson 'schema.json' $schemas
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    Write-PrivateJson 'capability.json' @{ at=[DateTime]::UtcNow.ToString('o'); administrator=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator); uacEnabled=(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System').EnableLUA; powershell=$PSVersionTable.PSVersion.ToString() }
    foreach ($session in $sessions) {
      $entry = @($admission.sessions | Where-Object { $_.name -eq $session.name })[0]
      $entry.attempted = $true
      $entry.state = 'start-unconfirmed'
      Write-PrivateJson 'admission.json' $admission
      $result = [TtscEtwSession]::Start($session.name, $session.file, [Guid]::NewGuid(), [uint32]$session.size)
      $entry.start = $result
      if ($result.code -ne 0) {
        throw ('StartTraceW refused admission with Win32 status ' + $result.code)
      }
      $started += $session.name
      $entry.state = 'started'
      # A mutable or interrupted journal cannot replace the original native ID.
      # If publication fails, this process still owns the in-memory receipt and
      # attempts its original-ID cleanup before reporting all refusals.
      Write-OriginalAdmission $session $result
      Write-PrivateJson 'admission.json' $admission
      $provider = Get-WinEvent -ListProvider $session.provider
      $entry.providerId = $provider.Id.ToString('D')
      $entry.enableTimeout = 0
      $entry.providerCallbacksComplete = $null
      $entry.enableCode = [TtscEtwSession]::Enable($result.id, $provider.Id, [Convert]::ToUInt64($session.keywords.Substring(2), 16))
      Write-PrivateJson 'admission.json' $admission
      if ($entry.enableCode -ne 0) { throw ('EnableTraceEx2 refused the original session with Win32 status ' + $entry.enableCode) }
      if ($session.provider -eq 'Microsoft-Windows-Kernel-Process') {
        $before = @{ at=[DateTime]::UtcNow.ToString('o'); processes=@(Get-CimInstance Win32_Process | ForEach-Object { @{ pid=[int]$_.ProcessId; birth=$_.CreationDate.ToUniversalTime().ToString('o'); name=$_.Name } }) }
        Write-PrivateJson 'before.json' $before
      }
    }
    Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices; public static class TtscEtwDevices { [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern uint QueryDosDevice(string name, StringBuilder target, int length); }'
    $devices = @()
    foreach ($drive in [IO.Directory]::GetLogicalDrives()) {
      $dos = $drive.TrimEnd('\')
      $buffer = [Text.StringBuilder]::new(32768)
      if ([TtscEtwDevices]::QueryDosDevice($dos, $buffer, $buffer.Capacity) -ne 0) { $devices += @{ dos=$dos; native=$buffer.ToString().Split([char]0)[0] } }
    }
    Write-PrivateJson 'started.json' @{ at=[DateTime]::UtcNow.ToString('o'); sessions=$started; devices=$devices }
  } catch {
    $original = $_.Exception
    $cleanup = @()
    foreach ($name in $started) {
      $entry = @($admission.sessions | Where-Object { $_.name -eq $name })[0]
      try {
        $session = @($sessions | Where-Object { $_.name -eq $name })[0]
        $result = Retire-Original (Original-Receipt $entry.start) $session.file
        $entry.stop = $result
        $entry.code = $result.code
        $entry.state = $result.state
        $cleanup += @{ name=$name; code=$result.code; query=$result.query; stop=$result.stop; reason=$result.reason }
      } catch {
        $entry.state = 'stop-unconfirmed'
        $entry.failure = $_.Exception.Message
        $cleanup += @{ name=$name; code=$null; failure=$_.Exception.Message }
      }
    }
    $secondary = @()
    try { Write-PrivateJson 'admission.json' $admission } catch { $secondary += $_.Exception }
    try { Write-PrivateJson 'start-failed.json' @{ at=[DateTime]::UtcNow.ToString('o'); started=$started; cleanup=$cleanup; failure=$original.Message } } catch { $secondary += $_.Exception }
    $refusals = @($cleanup | Where-Object { $_.code -ne 0 })
    if ($refusals.Count -ne 0) { $secondary += [Exception]::new((ConvertTo-Json -InputObject $refusals -Compress)) }
    if ($secondary.Count -ne 0) { throw ([AggregateException]::new(('ETW start and owned cleanup failed: ' + $original.Message + '; ' + (($secondary | ForEach-Object { $_.Message }) -join '; ')), @($original) + $secondary)) }
    throw $original
  }
} elseif ($Mode -eq 'stop') {
  $results = @()
  $previous = @()
  $readFailures = @()
  foreach ($receipt in @('stopped.json','admission.json')) {
    try {
      if (-not (Test-Path -LiteralPath (Join-Path $private $receipt))) { continue }
      $recorded = Get-Content -LiteralPath (Join-Path $private $receipt) -Raw | ConvertFrom-Json
      if ($null -eq $recorded -or $recorded.sessions -isnot [Array]) { throw ('Invalid original recorder receipt shape: ' + $receipt) }
      $previous += @($recorded.sessions)
    } catch {
      # A damaged receipt supplies no acknowledgment or no-attempt proof.
      # Siblings retain separate original native admission receipts.
      $readFailures += $_.Exception
    }
  }
  foreach ($session in $sessions) {
    $acknowledged = @($previous | Where-Object { $_.name -eq $session.name -and $_.state -eq 'stopped' -and $_.code -eq 0 })
    if ($acknowledged.Count -ge 1) { $results += $acknowledged[0]; continue }
    $unattempted = @($previous | Where-Object { $_.name -eq $session.name -and $_.state -eq 'not-admitted' -and $_.attempted -eq $false })
    if ($unattempted.Count -ge 1) { $results += $unattempted[0]; continue }
    try {
      $admitted = Get-Content -LiteralPath (Join-Path $private ($session.provider + '-admitted.json')) -Raw | ConvertFrom-Json
      $original = Original-Receipt $admitted
      $stop = Retire-Original $original $session.file
      # Only the API's exact original file/ID/GUID comparison authorizes STOP.
      # Redact a different session's path rather than publishing machine data.
      $results += @{ name=$session.name; state=$stop.state; code=$stop.code; query=$stop.query; stop=$stop.stop; reason=$stop.reason }
      if ($null -ne $stop.stop -and $null -ne $stop.stop.metadataFailure) { $readFailures += [Exception]::new($stop.stop.metadataFailure) }
    } catch { $readFailures += $_.Exception; $results += @{ name=$session.name; state='identity-unknown'; failure=$_.Exception.Message } }
  }
  try { Write-PrivateJson 'stopped.json' @{ at=[DateTime]::UtcNow.ToString('o'); sessions=$results; receiptFailures=@($readFailures | ForEach-Object { $_.Message }) } }
  catch { throw ([AggregateException]::new(('ETW receipt publication failed after native results: ' + (ConvertTo-Json -InputObject $results -Depth 6 -Compress) + '; ' + (($readFailures | ForEach-Object { $_.Message }) -join '; ')), @($readFailures) + @($_.Exception))) }
  if ($readFailures.Count -ne 0) { throw ([AggregateException]::new(('Original recorder receipt reads failed: ' + (($readFailures | ForEach-Object { $_.Message }) -join '; ')), @($readFailures))) }
  if (@($results | Where-Object { $_.state -notin @('stopped','not-admitted') }).Count -ne 0) { throw 'Original ETW retirement remains unknown' }
} else {
  $schemas = Get-Content -LiteralPath (Join-Path $private 'schema.json') -Raw | ConvertFrom-Json
  $writer = [IO.StreamWriter]::new((Join-Path $private 'events.jsonl'), $false, [Text.UTF8Encoding]::new($false))
  $failures = @()
  try {
    foreach ($session in $sessions) {
      try {
        Get-WinEvent -Path $session.file -Oldest | ForEach-Object {
          $event = $_
          if ($event.ProviderName -ne $session.provider) { return }
          $schema = @($schemas | Where-Object { $_.provider -eq $event.ProviderName -and $_.id -eq $event.Id -and $_.version -eq $event.Version })
          if ($schema.Count -ne 1) { throw 'Decoded event revision has no validated template' }
          $xml = [xml]$event.ToXml()
          $fields = @{}
          foreach ($data in $xml.Event.EventData.Data) {
            $name = [string]$data.Name
            if ($name -notin @('FileObject','FileKey','FileName','FilePath','Irp','ShareAccess','CreateOptions','CreateAttributes','InfoClass','ExtraInformation','Status','ThreadId','IssuingThreadId','ProcessID','CreateTime','ParentProcessID','ThreadID','ProcessSequenceNumber','ParentProcessSequenceNumber')) { continue }
            if (-not ($schema[0].fields -contains $name)) { throw 'Named event data disagrees with its template' }
            $value = [string]$data.'#text'
            if ($name -eq 'CreateTime') { $value = ([DateTime]$value).ToUniversalTime().ToString('o') }
            $fields[$name] = $value
          }
          $row = @{ provider=$(if ($event.ProviderName -eq 'Microsoft-Windows-Kernel-File') { 'file' } else { 'process' }); id=[int]$event.Id; version=[int]$event.Version; at=$event.TimeCreated.ToUniversalTime().ToString('o'); headerPid=[int]$event.ProcessId; fields=$fields }
          $writer.WriteLine((ConvertTo-Json -InputObject $row -Depth 6 -Compress))
        }
      } catch { $failures += $_.Exception.Message }
    }
  } finally { $writer.Dispose() }
  # Get-WinEvent does not supply a qualified total lost-event count here.
  Write-PrivateJson 'decoded.json' @{ at=[DateTime]::UtcNow.ToString('o'); eventsLost=$null; possibleWrap=$true; decodingFailed=($failures.Count -ne 0); failures=$failures }
}
