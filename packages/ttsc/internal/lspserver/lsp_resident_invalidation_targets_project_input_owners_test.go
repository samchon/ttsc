package lspserver

import "testing"

// TestLSPResidentInvalidationTargetsProjectInputOwners verifies external data
// changes reach only resident binaries whose producer declared the input.
//
//  1. Install two resident entries with distinct producer keys.
//  2. Attribute one external URI to the first producer.
//  3. Assert only the first resident receives changed/external deltas.
func TestLSPResidentInvalidationTargetsProjectInputOwners(t *testing.T) {
  first := NativeLSPPluginEntry{Binary: "first", Name: "@ttsc/first"}
  second := NativeLSPPluginEntry{Binary: "second", Name: "@ttsc/second"}
  firstResident := &residentSidecar{}
  secondResident := &residentSidecar{}
  source := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first, second},
    residents: map[string]*residentSidecar{
      first.Binary:  firstResident,
      second.Binary: secondResident,
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
