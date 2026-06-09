package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreamblePreservesGeneratedColumnOnlySegment verifies
// that a generated-column-only (1-field) mapping segment survives the rewrite at
// its correct absolute generated column.
//
// A 1-field segment has a generated column but no source position; the rewrite
// keeps it and re-encodes its genCol delta against the running output column.
// buildMappings cannot express 1-field segments, so this branch had no coverage:
// a wrong impl that dropped it, or re-encoded its column as an absolute instead
// of a delta after a preceding real segment, would corrupt the generated column
// of everything after it on that line yet pass every other test.
//
//  1. Hand-encode one generated line: a 4-field real segment then a 1-field
//     generated-column-only segment.
//  2. Run AdjustSourceMapForPreamble (dropLines 3).
//  3. Decode and assert the real segment shifted to source line 2 and the
//     column-only segment is still present at absolute generated column 4 with no
//     source position.
func TestAdjustSourceMapForPreamblePreservesGeneratedColumnOnlySegment(t *testing.T) {
  const dropLines = 3
  realSeg := encodeVLQField(0) + encodeVLQField(0) + encodeVLQField(5) + encodeVLQField(0) // genCol 0, src 0, line 5, col 0
  colOnly := encodeVLQField(4)                                                             // +4 genCol, no source
  input := makeMapJSON([]string{"src/a.ts"}, realSeg+","+colOnly)

  out, ok := driver.AdjustSourceMapForPreamble(input, dropLines)
  if !ok {
    t.Fatal("expected the map to change")
  }

  segs := decodeAllSegments(mappingsOf(out))
  if len(segs) != 1 {
    t.Fatalf("expected one generated line, got %d", len(segs))
  }
  line := segs[0]
  if len(line) != 2 {
    t.Fatalf("expected two segments on the line (real + column-only), got %#v", line)
  }
  if !line[0].hasSource || line[0].srcLine != 2 || line[0].genCol != 0 {
    t.Fatalf("real segment: want genCol 0 srcLine 2 hasSource, got %#v", line[0])
  }
  if line[1].hasSource || line[1].genCol != 4 {
    t.Fatalf("column-only segment: want genCol 4 and no source, got %#v", line[1])
  }
}

// rawSeg is a decoded mapping segment that retains generated-column-only ones.
type rawSeg struct {
  genCol    int
  hasSource bool
  srcLine   int
}

// decodeAllSegments decodes a mappings string into per-generated-line segments,
// keeping 1-field (generated-column-only) segments that parseMappings drops.
func decodeAllSegments(mappings string) [][]rawSeg {
  decode := func(seg string) []int {
    var out []int
    shift, value := 0, 0
    for i := 0; i < len(seg); i++ {
      d := strings.IndexByte(vlqBase64, seg[i])
      cont := d&32 != 0
      value += (d & 31) << shift
      if cont {
        shift += 5
        continue
      }
      if value&1 != 0 {
        out = append(out, -(value >> 1))
      } else {
        out = append(out, value>>1)
      }
      shift, value = 0, 0
    }
    return out
  }
  var result [][]rawSeg
  var srcLine int
  for _, line := range strings.Split(mappings, ";") {
    if line == "" {
      continue
    }
    genCol := 0
    var segs []rawSeg
    for _, seg := range strings.Split(line, ",") {
      if seg == "" {
        continue
      }
      f := decode(seg)
      genCol += f[0]
      s := rawSeg{genCol: genCol}
      if len(f) >= 4 {
        srcLine += f[2]
        s.hasSource = true
        s.srcLine = srcLine
      }
      segs = append(segs, s)
    }
    result = append(result, segs)
  }
  return result
}
