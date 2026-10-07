package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreambleKeepsGenColAfterSameLineDrop Verifies that
// dropping a preamble-region segment that shares a generated line with a kept
// segment does not corrupt the kept segment's generated column or source column.
//
// genCol is a per-generated-line delta; when an earlier segment on the same line
// is dropped, the re-encoder must NOT advance its output genCol cumulant over the
// drop, or the surviving segment's genCol delta is wrong. Only a mid-line
// dropped sibling reaches this branch; whole dropped generated lines do not.
//
//  1. Build a map whose generated line 0 has two segments: the first inside the
//     preamble region (dropped), the second real code.
//  2. Run AdjustSourceMapForPreamble with dropLines 3.
//  3. Assert the survivor keeps genCol 10 and srcCol 8 and shifts to source line 2.
//
// The dropped segment sits at genCol 3, not 0, so a re-encoder that advanced its
// output genCol cumulant over the drop would encode the survivor's genCol delta
// as 7 instead of 10.
//
// @evidence contracts/testing.md#behavioral-verification AdjustSourceMapForPreamble drops one segment and keeps generated column 10, source column 8 and shifted line 2.
// @evidence contracts/testing.md#independent-expectations The separate test VLQ codec decodes authored absolute coordinates; three-line subtraction establishes line 2.
// @evidence contracts/testing.md#distinguishing-cases Dropped column 3 and kept column 10 share a generated line, exposing incorrect column accumulation.
// @evidence contracts/testing.md#execution-ownership Go test/driver discovers this direct AdjustSourceMapForPreamble unit. Authored JSON and separate test-local VLQ helpers run in process without filesystem inputs, shim calls, compiler preparation or a host artifact.
func TestAdjustSourceMapForPreambleKeepsGenColAfterSameLineDrop(t *testing.T) {
  const dropLines = 3
  input := makeMapJSON([]string{"src/a.ts"}, buildMappings([]absSeg{
    {genLine: 0, genCol: 3, srcIdx: 0, srcLine: 1, srcCol: 4},  // preamble region -> dropped
    {genLine: 0, genCol: 10, srcIdx: 0, srcLine: 5, srcCol: 8}, // real code -> kept, srcLine 2
  }))

  out, ok := driver.AdjustSourceMapForPreamble(input, dropLines)
  if !ok {
    t.Fatal("expected the map to change")
  }
  segs := parseMappings(mappingsOf(out))
  if len(segs) != 1 {
    t.Fatalf("want exactly one surviving segment, got %#v", segs)
  }
  s := segs[0]
  if s.genLine != 0 || s.genCol != 10 || s.srcLine != 2 || s.srcCol != 8 {
    t.Fatalf("survivor corrupted by the same-line drop: want genLine 0 genCol 10 srcLine 2 srcCol 8, got %#v", s)
  }
}
