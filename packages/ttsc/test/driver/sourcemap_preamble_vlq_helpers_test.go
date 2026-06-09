package driver_test

import (
  "encoding/json"
  "strings"
)

// This file holds an INDEPENDENT Base64-VLQ source-map codec used only by the
// preamble source-map tests. It is intentionally a separate implementation from
// the production codec in driver/sourcemap_preamble.go so a transcription bug in
// the production encoder/decoder cannot be masked by a shared helper. Tests build
// inputs from absolute coordinates, run the production rewrite, then decode the
// output back to absolute coordinates and assert.

// absSeg is one source-map segment in absolute (non-delta) coordinates.
type absSeg struct {
  genLine int
  genCol  int
  srcIdx  int
  srcLine int
  srcCol  int
  nameIdx int
  hasName bool
}

const vlqBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

// encodeVLQField encodes one signed integer as Base64 VLQ.
func encodeVLQField(field int) string {
  var v int
  if field < 0 {
    v = (-field << 1) | 1
  } else {
    v = field << 1
  }
  var b strings.Builder
  for {
    digit := v & 31
    v >>= 5
    if v > 0 {
      digit |= 32
    }
    b.WriteByte(vlqBase64[digit])
    if v == 0 {
      break
    }
  }
  return b.String()
}

// buildMappings encodes absolute segments into a source-map `mappings` string.
// Segments must be sorted by (genLine, genCol). genCol resets per generated
// line; sourceIndex/sourceLine/sourceColumn/nameIndex are cumulative across the
// whole string.
func buildMappings(segs []absSeg) string {
  maxLine := 0
  for _, s := range segs {
    if s.genLine > maxLine {
      maxLine = s.genLine
    }
  }
  lines := make([][]string, maxLine+1)
  var pGenCol, pSrcIdx, pSrcLine, pSrcCol, pNameIdx int
  curLine := -1
  for _, s := range segs {
    if s.genLine != curLine {
      curLine = s.genLine
      pGenCol = 0
    }
    fields := []int{
      s.genCol - pGenCol,
      s.srcIdx - pSrcIdx,
      s.srcLine - pSrcLine,
      s.srcCol - pSrcCol,
    }
    if s.hasName {
      fields = append(fields, s.nameIdx-pNameIdx)
      pNameIdx = s.nameIdx
    }
    var seg strings.Builder
    for _, f := range fields {
      seg.WriteString(encodeVLQField(f))
    }
    lines[s.genLine] = append(lines[s.genLine], seg.String())
    pGenCol = s.genCol
    pSrcIdx = s.srcIdx
    pSrcLine = s.srcLine
    pSrcCol = s.srcCol
  }
  parts := make([]string, len(lines))
  for i, segs := range lines {
    parts[i] = strings.Join(segs, ",")
  }
  return strings.Join(parts, ";")
}

// parseMappings decodes a source-map `mappings` string back to absolute
// segments (4- and 5-field segments only; ignores generated-column-only ones).
func parseMappings(mappings string) []absSeg {
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
  var result []absSeg
  var srcIdx, srcLine, srcCol, nameIdx int
  for li, line := range strings.Split(mappings, ";") {
    if line == "" {
      continue
    }
    genCol := 0
    for _, seg := range strings.Split(line, ",") {
      if seg == "" {
        continue
      }
      f := decode(seg)
      genCol += f[0]
      if len(f) < 4 {
        continue
      }
      srcIdx += f[1]
      srcLine += f[2]
      srcCol += f[3]
      s := absSeg{genLine: li, genCol: genCol, srcIdx: srcIdx, srcLine: srcLine, srcCol: srcCol}
      if len(f) >= 5 {
        nameIdx += f[4]
        s.nameIdx = nameIdx
        s.hasName = true
      }
      result = append(result, s)
    }
  }
  return result
}

// makeMapJSON wraps a mappings string and sources list into a minimal v3 map.
func makeMapJSON(sources []string, mappings string) string {
  doc := map[string]any{
    "version":  3,
    "file":     "out.js",
    "sources":  sources,
    "names":    []string{},
    "mappings": mappings,
  }
  b, _ := json.Marshal(doc)
  return string(b)
}

// mappingsOf extracts the `mappings` field from a source-map JSON string.
func mappingsOf(mapJSON string) string {
  var doc struct {
    Mappings string `json:"mappings"`
  }
  _ = json.Unmarshal([]byte(mapJSON), &doc)
  return doc.Mappings
}
