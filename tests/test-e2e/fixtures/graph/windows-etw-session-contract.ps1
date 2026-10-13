# Pure interop contract checks call no Win32 tracing function. The native
# connection remains owned by the optional cold Graph E2E observation.
$ErrorActionPreference = 'Stop'
if ($null -eq ('TtscEtwSession' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'windows-etw-session.cs') }
$original = [TtscEtwSession+Receipt]::new()
$original.api = 'StartTraceW'; $original.code = 0
$original.id = '9007199254740993'; $original.guid = '638156b3-af24-4c69-9831-a8d28779c388'
$original.file = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'original.etl'))
$copy = {
  $value = [TtscEtwSession+Receipt]::new()
  $value.api = 'ControlTraceW_QUERY'; $value.code = 0
  $value.id = $original.id; $value.guid = $original.guid; $value.file = $original.file
  return $value
}
$matching = & $copy
if (-not [TtscEtwSession]::Matches($original, $matching)) { throw 'Exact native output/ID/GUID must match' }
$differentPaths = @(
  ($original.file + '.bak')
  ('prefix-' + $original.file)
  ($original.file + '-suffix')
  'another.etl'
)
foreach ($path in $differentPaths) {
  $different = & $copy
  $different.file = $path
  # Another field's exact occurrence must not confer output-file authority.
  $different.metadataFailure = $original.file
  if ([TtscEtwSession]::Matches($original, $different)) { throw 'A different native output path was authorized' }
}
foreach ($field in @('id','guid','file')) {
  $missing = & $copy; $missing.$field = $null
  if ([TtscEtwSession]::Matches($original, $missing)) { throw ('Missing identity was authorized: ' + $field) }
}
$reused = & $copy; $reused.id = '9007199254740992'
if ([TtscEtwSession]::Matches($original, $reused)) { throw 'Adjacent 64-bit identities were conflated' }
$reused = & $copy; $reused.guid = [Guid]::NewGuid().ToString('D')
if ([TtscEtwSession]::Matches($original, $reused)) { throw 'A different session generation was authorized' }
$denied = & $copy; $denied.code = 5
if ([TtscEtwSession]::Matches($original, $denied)) { throw 'A failed native query was authorized' }
if ([TtscEtwSession]::Matches($null, $matching)) { throw 'Missing original admission was authorized' }
# SDK evntrace.h/wmistr.h use an eight-byte aligned WNODE_HEADER and a
# pointer-sized LoggerThreadId. Compare managed ABI without invoking ETW.
$size = [Runtime.InteropServices.Marshal]::SizeOf([type][TtscEtwSession+Properties])
$wnode = [Runtime.InteropServices.Marshal]::SizeOf([type][TtscEtwSession+Wnode])
$thread = [Runtime.InteropServices.Marshal]::OffsetOf([type][TtscEtwSession+Properties], 'LoggerThreadId').ToInt32()
$file = [Runtime.InteropServices.Marshal]::OffsetOf([type][TtscEtwSession+Properties], 'LogFileNameOffset').ToInt32()
if ($wnode -ne 48 -or $size -ne 120 -or $thread -ne 104 -or $file -ne (104 + [IntPtr]::Size)) { throw 'Managed ETW ABI differs from the Windows SDK declaration' }
# Inspect the actual private allocator without widening its API or calling ETW.
# The documented name-first order and UTF-16 bytes must survive Unicode paths,
# a filename filling its capacity and query storage with no input filename.
$allocate = [TtscEtwSession].GetMethod('Allocate', ([Reflection.BindingFlags]::NonPublic -bor [Reflection.BindingFlags]::Static))
$unicodeFile = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ('source-' + [char]0xd55c + [char]0xae00 + [char]0xd83d + [char]0xde80 + '.etl')))
$capacityFile = 'a' * 1019 + '.etl'
foreach ($inputFile in @($unicodeFile, $capacityFile, $null)) {
  $buffer = [IntPtr]::Zero
  try {
    $buffer = $allocate.Invoke($null, [object[]]@([Guid]::NewGuid(), $inputFile, [uint32]4))
    $properties = [Runtime.InteropServices.Marshal]::PtrToStructure($buffer, [type][TtscEtwSession+Properties])
    $loggerOffset = [int]$properties.LoggerNameOffset
    $fileOffset = [int]$properties.LogFileNameOffset
    $total = [int]$properties.Wnode.BufferSize
    if ($loggerOffset -lt $size -or $fileOffset -le $loggerOffset -or $fileOffset -ge $total -or ($loggerOffset % 2) -ne 0 -or ($fileOffset % 2) -ne 0) { throw 'Native name/file string slots are out of order or range' }
    $actual = [byte[]]::new($total)
    [Runtime.InteropServices.Marshal]::Copy($buffer, $actual, 0, $total)
    for ($index = $loggerOffset; $index -lt $fileOffset; $index++) {
      if ($actual[$index] -ne 0) { throw 'Filename bytes overwrote the empty session-name slot' }
    }
    $expected = [Text.Encoding]::Unicode.GetBytes(([string]$inputFile) + [char]0)
    if ($fileOffset + $expected.Length -gt $total) { throw 'Encoded filename exceeds its actual allocation' }
    for ($index = 0; $index -lt $expected.Length; $index++) {
      if ($actual[$fileOffset + $index] -ne $expected[$index]) { throw 'Allocated UTF-16 filename or termination differs from input' }
    }
    for ($index = $fileOffset + $expected.Length; $index -lt $total; $index++) {
      if ($actual[$index] -ne 0) { throw 'File-name query storage contains trailing uninitialized bytes' }
    }
    if ([Runtime.InteropServices.Marshal]::PtrToStringUni([IntPtr]::Add($buffer, $fileOffset)) -cne ([string]$inputFile)) { throw 'Native filename does not round-trip its Unicode path' }
  } finally {
    if ($buffer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer) }
  }
}
