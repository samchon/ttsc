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

# Counts describe yielded records, not events written by ETW or lost events.
# One fixed record per admitted session survives an incomplete enumeration.
function New-EtwDecodeCounts([string]$Provider) {
  return @{ provider=$Provider; enumerated=[long]0; matchingProvider=[long]0; acceptedRevision=[long]0; projected=[long]0; completed=$false; failure=$null }
}

# This is the decoder's actual provider/revision gate. Later XML projection
# increments projected only after its original private write succeeds.
function Get-DecodedEtwSchema([string]$Provider, [object]$Id, [object]$Version, [string]$ExpectedProvider, [object[]]$Schemas, [hashtable]$Counts) {
  $Counts.enumerated++
  if ($Provider -ne $ExpectedProvider) { return $null }
  $Counts.matchingProvider++
  $schema = @($Schemas | Where-Object { $_.provider -eq $Provider -and $_.id -eq $Id -and $_.version -eq $Version })
  if ($schema.Count -ne 1) { throw 'Decoded event revision has no validated template' }
  $Counts.acceptedRevision++
  return $schema[0]
}
