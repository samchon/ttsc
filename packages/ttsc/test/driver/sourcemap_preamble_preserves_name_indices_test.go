package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreamblePreservesNameIndices Verifies that 5-field
// (name-bearing) segments keep their correct absolute name index after the
// preamble shift, including across a dropped name-bearing segment.
//
// nameIndex is cumulative across the whole mappings string. When a name-bearing
// segment is dropped (it fell inside the preamble region), the re-encoder must
// NOT advance its output name cumulant past the drop, or every later segment's
// decoded name index is wrong. Only a map with 5-field segments
// reaches this branch.
//
//  1. Build a single-source map with three name-bearing segments, the middle one
//     inside the preamble region (dropLines 2).
//  2. Run AdjustSourceMapForPreamble.
//  3. Assert the surviving segments shifted by -2 and kept their absolute name
//     indices (0 and 2), proving the dropped segment's name index 1 did not skew
//     the running cumulant.
//
// @evidence contracts/testing.md#behavioral-verification AdjustSourceMapForPreamble preserves name indices 0 and 2 around a dropped middle segment.
// @evidence contracts/testing.md#independent-expectations A separate test VLQ codec decodes independently authored name indices and source-line shifts.
// @evidence contracts/testing.md#distinguishing-cases A dropped name index 1 must not skew later cumulative state; extra survivor count is not asserted.
// @evidence contracts/testing.md#execution-ownership Go unit TestAdjustSourceMapForPreamblePreservesNameIndices is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestAdjustSourceMapForPreamblePreservesNameIndices(t *testing.T) {
  const dropLines = 2
  sources := []string{"src/a.ts"}
  input := makeMapJSON(sources, buildMappings([]absSeg{
    {genLine: 0, genCol: 0, srcIdx: 0, srcLine: 3, srcCol: 4, nameIdx: 0, hasName: true}, // kept -> srcLine 1, name 0
    {genLine: 1, genCol: 0, srcIdx: 0, srcLine: 1, srcCol: 0, nameIdx: 1, hasName: true}, // dropped (srcLine 1 < 2)
    {genLine: 2, genCol: 0, srcIdx: 0, srcLine: 5, srcCol: 2, nameIdx: 2, hasName: true}, // kept -> srcLine 3, name 2
  }))

  out, ok := driver.AdjustSourceMapForPreamble(input, dropLines)
  if !ok {
    t.Fatal("expected the map to change")
  }
  segs := parseMappings(mappingsOf(out))

  byGenLine := map[int]absSeg{}
  for _, s := range segs {
    byGenLine[s.genLine] = s
  }
  if _, present := byGenLine[1]; present {
    t.Fatal("the name-bearing segment inside the preamble region should be dropped")
  }
  if s := byGenLine[0]; !s.hasName || s.srcLine != 1 || s.nameIdx != 0 {
    t.Fatalf("first segment: want srcLine 1 nameIdx 0, got srcLine %d nameIdx %d hasName %v", s.srcLine, s.nameIdx, s.hasName)
  }
  if s := byGenLine[2]; !s.hasName || s.srcLine != 3 || s.nameIdx != 2 {
    t.Fatalf("third segment: want srcLine 3 nameIdx 2, got srcLine %d nameIdx %d hasName %v", s.srcLine, s.nameIdx, s.hasName)
  }
}
