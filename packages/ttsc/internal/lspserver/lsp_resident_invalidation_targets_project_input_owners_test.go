package lspserver

import "testing"

// TestLSPResidentInvalidationTargetsProjectInputOwners verifies external data
// queueing selects only the record named by the supplied owner map.
//
//  1. Install two resident entries with distinct producer keys.
//  2. Attribute one external URI to the first producer.
//  3. Assert only the first resident receives changed/external deltas.
//
// @evidence contracts/testing.md#behavioral-verification The authored .md URI is queued once in both changed and external lists on the first record and in neither list on the second. The supplied owner map is not derived from actual producer declarations, and no daemon receives an update here.
// @evidence contracts/testing.md#independent-expectations Exact authored URI values/count one on the first record and count zero on the second are independent queue observations. Transport keys construct the fixture inputs; they do not generate the expected URI lists.
// @evidence contracts/testing.md#distinguishing-cases One supplied owner and one non-owner distinguish scoped external data from broadcast; the separate overlap test owns .ts/.json broadcast. Missing owner lists, malformed URIs and subsequent queue consumption are outside this case.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls actual NativePluginSource.InvalidateResidentProgramsForOwnedWatchedChanges on two owned empty resident records. It creates no native process or filesystem fixture, installs no consumer or host and substitutes no routing operation.
func TestLSPResidentInvalidationTargetsProjectInputOwners(t *testing.T) {
  first := NativeLSPPluginEntry{Binary: "first", Name: "@ttsc/first"}
  second := NativeLSPPluginEntry{Binary: "second", Name: "@ttsc/second"}
  firstResident := &residentSidecar{}
  secondResident := &residentSidecar{}
  source := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first, second},
    residents: map[string]*residentSidecar{
      pluginKey(first):  firstResident,
      pluginKey(second): secondResident,
    },
  }
  const externalURI = "file:///project/docs/spec.md"

  source.InvalidateResidentProgramsForOwnedWatchedChanges(
    []string{externalURI},
    []string{externalURI},
    map[string][]string{
      externalURI: {pluginKey(first)},
    },
  )

  if len(firstResident.changed) != 1 ||
    firstResident.changed[0] != externalURI ||
    len(firstResident.external) != 1 ||
    firstResident.external[0] != externalURI {
    t.Fatalf(
      "owned resident deltas = changed %#v, external %#v",
      firstResident.changed,
      firstResident.external,
    )
  }
  if len(secondResident.changed) != 0 ||
    len(secondResident.external) != 0 {
    t.Fatalf(
      "unrelated resident received deltas = changed %#v, external %#v",
      secondResident.changed,
      secondResident.external,
    )
  }
}
