package lspserver

import "testing"

// TestLSPResidentInvalidationBroadcastsProgramInputOverlap verifies an input's
// contributor ownership never hides its second role as a shared Program input.
//
// A TypeScript source or resolveJsonModule JSON file can be declared by one
// producer while belonging to every resident Program. All residents must see
// the content delta; the daemon itself skips an external path when its Program
// does not contain it.
//
//  1. Install two resident entries with distinct producer keys.
//  2. Attribute one shared-Program URI to the first producer only.
//  3. Assert both residents receive the changed and external deltas.
func TestLSPResidentInvalidationBroadcastsProgramInputOverlap(t *testing.T) {
  for _, externalURI := range []string{
    "file:///project/src/shared.ts",
    "file:///project/src/shared.json",
  } {
    t.Run(externalURI, func(t *testing.T) {
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

      source.InvalidateResidentProgramsForOwnedWatchedChanges(
        []string{externalURI},
        []string{externalURI},
        map[string][]string{
          externalURI: {pluginKey(first)},
        },
      )

      for label, resident := range map[string]*residentSidecar{
        "owner":     firstResident,
        "non-owner": secondResident,
      } {
        if len(resident.changed) != 1 ||
          resident.changed[0] != externalURI ||
          len(resident.external) != 1 ||
          resident.external[0] != externalURI {
          t.Fatalf(
            "%s resident deltas = changed %#v, external %#v",
            label,
            resident.changed,
            resident.external,
          )
        }
      }
    })
  }
}
