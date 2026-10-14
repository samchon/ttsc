# EventMetadata exposes Id as Int64 while PowerShell's numeric literal keys
# are Int32. Validate the documented 16-bit event-ID domain before lookup;
# Hashtable object keys do not perform comparison-operator numeric coercion.
function Get-CanonicalEtwEventId([object]$Value) {
  if (($Value -isnot [int32] -and $Value -isnot [int64]) -or $Value -lt 0 -or $Value -gt [uint16]::MaxValue) {
    throw 'Installed event identifier is not an integer in the documented 16-bit domain'
  }
  return [int32]$Value
}

# Canonical IDs preserve the existing task-name qualification; an unsupported
# or mismatched event remains a refusal rather than an unknown event to skip.
function Get-QualifiedEtwEventId([object]$Value, [Collections.IDictionary]$Tasks, [string]$TaskName) {
  $id = Get-CanonicalEtwEventId $Value
  if (-not $Tasks.Contains($id) -or $TaskName -ne $Tasks[$id]) { throw ('Installed task semantics differ for event ' + $id) }
  return $id
}
