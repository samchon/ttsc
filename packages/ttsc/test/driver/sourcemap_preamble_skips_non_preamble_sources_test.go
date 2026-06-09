package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreambleSkipsNonPreambleSources verifies the per-source
// guard: only segments whose source file was preamble-injected are shifted.
//
// The preamble is injected into TypeScript/JavaScript sources but NOT into
// `.json` sources (isSourcePreambleTarget excludes them). A bundled map (outFile)
// can list both; blindly subtracting the preamble line count from every segment
// would corrupt the `.json` segments, which were never shifted. This pins that
// `.ts` segments move and `.json` segments stay put.
//
//  1. Build a 2-source map (`a.ts` shifted in the source, `b.json` not) with a
//     dropLines of 3, including an `a.ts` segment inside the preamble region.
//  2. Run AdjustSourceMapForPreamble.
//  3. Assert `a.ts` segments dropped/-3, `b.json` segments unchanged.
func TestAdjustSourceMapForPreambleSkipsNonPreambleSources(t *testing.T) {
  const dropLines = 3
  sources := []string{"src/a.ts", "data/b.json"}
  input := makeMapJSON(sources, buildMappings([]absSeg{
    {genLine: 0, genCol: 0, srcIdx: 0, srcLine: 5, srcCol: 0}, // a.ts real code -> 2
    {genLine: 1, genCol: 0, srcIdx: 0, srcLine: 1, srcCol: 0}, // a.ts preamble region -> dropped
    {genLine: 2, genCol: 0, srcIdx: 1, srcLine: 5, srcCol: 0}, // b.json -> unchanged
    {genLine: 3, genCol: 0, srcIdx: 1, srcLine: 1, srcCol: 0}, // b.json low line -> unchanged (not dropped)
  }))

  out, ok := driver.AdjustSourceMapForPreamble(input, dropLines)
  if !ok {
    t.Fatal("expected the map to change")
  }
  segs := parseMappings(mappingsOf(out))

  // Index surviving segments by generated line for assertions.
  byGenLine := map[int]absSeg{}
  for _, s := range segs {
    byGenLine[s.genLine] = s
  }

  if s, present := byGenLine[1]; present {
    t.Fatalf("a.ts segment inside the preamble region should be dropped, got %#v", s)
  }
  if s := byGenLine[0]; s.srcIdx != 0 || s.srcLine != 2 {
    t.Fatalf("a.ts segment: want srcIdx 0 srcLine 2, got srcIdx %d srcLine %d", s.srcIdx, s.srcLine)
  }
  if s := byGenLine[2]; s.srcIdx != 1 || s.srcLine != 5 {
    t.Fatalf("b.json segment must be unshifted: want srcIdx 1 srcLine 5, got srcIdx %d srcLine %d", s.srcIdx, s.srcLine)
  }
  if s, present := byGenLine[3]; !present || s.srcLine != 1 {
    t.Fatalf("b.json low-line segment must be kept and unshifted at srcLine 1, got %#v present=%v", s, present)
  }
}
