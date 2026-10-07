package lspserver

import "testing"

// TestLSPResidentInvalidationBroadcastsProgramInputOverlap verifies an input's
// supplied ownership does not suppress extension-based broadcast queueing.
//
// A TypeScript source or resolveJsonModule JSON file can be declared by one
// producer while qualifying for broadcast by the routing policy. This unit
// inspects queued values on two empty resident records; no actual Program
// membership, daemon receipt or content delta is executed.
//
//  1. Install two resident entries with distinct producer keys.
//  2. Attribute one shared-Program URI to the first producer only.
//  3. Assert both residents receive the changed and external deltas.
//
// @evidence contracts/testing.md#behavioral-verification Each supplied .ts/.json URI is queued once in both changed and external lists on both resident records despite a first-owner-only map. This observes extension-policy queueing, not native receipt or actual shared Program membership.
// @evidence contracts/testing.md#independent-expectations Both records must contain exactly the authored URI in each list; those literal values are not derived from the routing result. Generated transport keys populate the input records, not the expected URI queues.
// @evidence contracts/testing.md#distinguishing-cases Named .ts and .json subtests cover two extension-based broadcasts; the separate owner-only .md case distinguishes non-Program data. Ordinary changes, missing owner lists, duplicate batches and a full-invalidated record are not exercised here.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit calls actual NativePluginSource.InvalidateResidentProgramsForOwnedWatchedChanges and its queueing helper on owned empty resident records. Binary names and URIs are opaque routing inputs; no filesystem, native child, installed consumer or product host is created.
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
