package driver

import (
  "encoding/json"
  "strings"
)

// AdjustSourceMapForPreamble corrects a source map after a source preamble was
// injected ahead of the parsed source.
//
// ttsc injects a plugin's source preamble (e.g. @ttsc/banner's copyright block)
// at the SOURCE level: sourcePreambleFS prepends it before TypeScript-Go parses,
// so the preamble participates in comment emission, removeComments, JSDoc
// association, and `.d.ts` emit naturally. The side effect is that every source
// coordinate the emitter records is shifted down by the preamble's line count —
// but the on-disk source file the map points at has no preamble. Left unpatched,
// every mapping for real code lands `dropLines` lines too far down (on blank or
// nonexistent lines), so a debugger jumps to the wrong place.
//
// This rewrites the map's `mappings` to undo that shift: segments whose source
// line falls inside the injected preamble region (line < dropLines) are dropped
// (those generated lines are the emitted preamble comment, which has no
// real-source counterpart and is left unmapped), and every remaining segment's
// source line is moved up by dropLines so it points at the real file. The
// generated side is untouched — the preamble is emitted into the same generated
// positions in both worlds, so only the source axis needs correcting.
//
// dropLines is the number of newlines the preamble adds (strings.Count(preamble,
// "\n")). Returns (rewritten, true) on success, or (input, false) when there is
// nothing to do or the map cannot be parsed (the caller then writes it as-is).
func AdjustSourceMapForPreamble(mapText string, dropLines int) (string, bool) {
  if dropLines <= 0 || strings.TrimSpace(mapText) == "" {
    return mapText, false
  }
  var doc map[string]json.RawMessage
  if err := json.Unmarshal([]byte(mapText), &doc); err != nil {
    return mapText, false
  }
  rawMappings, ok := doc["mappings"]
  if !ok {
    return mapText, false
  }
  var mappings string
  if err := json.Unmarshal(rawMappings, &mappings); err != nil {
    return mapText, false
  }
  rewritten, changed := shiftMappingSources(mappings, dropLines)
  if !changed {
    return mapText, false
  }
  encoded, err := json.Marshal(rewritten)
  if err != nil {
    return mapText, false
  }
  doc["mappings"] = encoded
  out, err := json.Marshal(doc)
  if err != nil {
    return mapText, false
  }
  return string(out), true
}

// shiftMappingSources decodes a source map `mappings` string, drops every
// segment whose absolute source line is below dropLines, subtracts dropLines
// from the rest, and re-encodes. genCol resets per generated line; sourceIndex,
// sourceLine, sourceColumn, and nameIndex are cumulative across the whole string
// (Base64 VLQ deltas), so the absolute state must be tracked and the deltas
// recomputed from scratch after the edit.
func shiftMappingSources(mappings string, dropLines int) (string, bool) {
  var srcIdx, srcLine, srcCol, nameIdx int // running absolute decode state
  // Re-encode state mirrors the decode cumulants but only advances over kept
  // segments, so dropped segments do not leave a delta gap.
  var outSrcIdx, outSrcLine, outSrcCol, outNameIdx int
  changed := false

  lines := strings.Split(mappings, ";")
  outLines := make([]string, len(lines))
  for li, line := range lines {
    if line == "" {
      outLines[li] = ""
      continue
    }
    var genCol int    // resets each generated line (decode)
    var outGenCol int // resets each generated line (encode)
    segments := strings.Split(line, ",")
    kept := make([]string, 0, len(segments))
    for _, seg := range segments {
      if seg == "" {
        continue
      }
      fields := decodeVLQ(seg)
      if len(fields) == 0 {
        continue
      }
      genCol += fields[0]
      if len(fields) < 4 {
        // Generated-column-only segment: no source position to shift. Keep it,
        // encoding the genCol delta against the running output genCol.
        kept = append(kept, encodeVLQ([]int{genCol - outGenCol}))
        outGenCol = genCol
        continue
      }
      srcIdx += fields[1]
      srcLine += fields[2]
      srcCol += fields[3]
      hasName := len(fields) >= 5
      if hasName {
        nameIdx += fields[4]
      }
      if srcLine < dropLines {
        // Inside the injected preamble region: drop the mapping. The decode
        // cumulants already advanced above, so deltas for later kept segments
        // stay correct relative to the real source position.
        changed = true
        continue
      }
      newSrcLine := srcLine - dropLines
      changed = changed || newSrcLine != srcLine
      out := []int{
        genCol - outGenCol,
        srcIdx - outSrcIdx,
        newSrcLine - outSrcLine,
        srcCol - outSrcCol,
      }
      if hasName {
        out = append(out, nameIdx-outNameIdx)
        outNameIdx = nameIdx
      }
      kept = append(kept, encodeVLQ(out))
      outGenCol = genCol
      outSrcIdx = srcIdx
      outSrcLine = newSrcLine
      outSrcCol = srcCol
    }
    outLines[li] = strings.Join(kept, ",")
  }
  return strings.Join(outLines, ";"), changed
}

const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

// decodeVLQ decodes a Base64 VLQ-encoded source-map segment into its signed
// integer fields.
func decodeVLQ(segment string) []int {
  var out []int
  shift := 0
  value := 0
  for i := 0; i < len(segment); i++ {
    digit := strings.IndexByte(base64Chars, segment[i])
    if digit < 0 {
      return nil
    }
    cont := digit&32 != 0
    value += (digit & 31) << shift
    if cont {
      shift += 5
      continue
    }
    negative := value&1 != 0
    value >>= 1
    if negative {
      value = -value
    }
    out = append(out, value)
    shift = 0
    value = 0
  }
  return out
}

// encodeVLQ encodes signed integer fields as a Base64 VLQ source-map segment.
func encodeVLQ(fields []int) string {
  var b strings.Builder
  for _, field := range fields {
    var value int
    if field < 0 {
      value = (-field << 1) | 1
    } else {
      value = field << 1
    }
    for {
      digit := value & 31
      value >>= 5
      if value > 0 {
        digit |= 32
      }
      b.WriteByte(base64Chars[digit])
      if value == 0 {
        break
      }
    }
  }
  return b.String()
}
