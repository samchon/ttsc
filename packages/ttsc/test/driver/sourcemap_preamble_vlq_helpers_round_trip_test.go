package driver_test

import (
  "reflect"
  "testing"
)

// TestVLQHelpersRoundTrip verifies the independent test-only VLQ codec
// (buildMappings/parseMappings) is internally self-consistent.
//
// Every preamble source-map unit test trusts this helper pair as its oracle, so
// a compensating bug in the pair (e.g. both mishandling a multi-byte VLQ field
// or the sign bit) could let a production test pass vacuously. This pins the
// pair's own round-trip over the boundary cases the production rewrite must also
// survive: multi-digit (continuation) deltas, a negative delta (a later mapping
// pointing at an earlier source line), and a 5-field name-bearing segment.
//
//  1. Build a mappings string from known absolute segments covering those cases.
//  2. Decode it back.
//  3. Assert the decoded segments equal the originals.
func TestVLQHelpersRoundTrip(t *testing.T) {
  segs := []absSeg{
    {genLine: 0, genCol: 0, srcIdx: 0, srcLine: 0, srcCol: 0},
    {genLine: 0, genCol: 5, srcIdx: 0, srcLine: 0, srcCol: 1000},                          // multi-byte VLQ (continuation)
    {genLine: 1, genCol: 0, srcIdx: 1, srcLine: 42, srcCol: 7, nameIdx: 3, hasName: true}, // 5-field
    {genLine: 2, genCol: 2, srcIdx: 0, srcLine: 5, srcCol: 0},                             // srcIdx & srcLine decrease: negative deltas / sign bit
  }
  got := parseMappings(buildMappings(segs))
  if !reflect.DeepEqual(got, segs) {
    t.Fatalf("round-trip mismatch:\n want %#v\n  got %#v", segs, got)
  }
}
