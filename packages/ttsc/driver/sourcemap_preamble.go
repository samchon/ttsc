package driver

import (
  "encoding/base64"
  "encoding/json"
  "strings"
)

// inlineSourceMapMarker is the prefix tsgo writes before an inline (base64) JS
// source map, from sourcemap.Generator.Base64DataURL. The map JSON follows,
// StdEncoding-base64'd, up to the end of the line.
const inlineSourceMapMarker = "sourceMappingURL=data:application/json;base64,"

// AdjustEmittedSourceMap corrects a source map that a source-level preamble
// shifted, given one emitted output file's name and text. It dispatches on the
// shape: an external `.map` file carries the map JSON directly; any other output
// (a `.js`/`.d.ts` with `inlineSourceMap`) carries it base64-embedded in a
// `//# sourceMappingURL=data:...` trailer. Returns (text, false) when there is
// nothing to correct (no preamble, no map, or unparseable).
//
// This is the single entry point every map-emitting path funnels through so the
// preamble correction is applied uniformly — the utility host's WriteFile (tsgo
// native emit) and the driver's plugin-transform emit (EmitWithPluginTransformers,
// e.g. typia + @ttsc/banner) both call it, external and inline alike.
func AdjustEmittedSourceMap(fileName, text string, dropLines int) (string, bool) {
  if dropLines <= 0 {
    return text, false
  }
  if strings.HasSuffix(strings.ToLower(fileName), ".map") {
    return AdjustSourceMapForPreamble(text, dropLines)
  }
  return adjustInlineSourceMap(text, dropLines)
}

// adjustInlineSourceMap rewrites the base64 map embedded in a
// `//# sourceMappingURL=data:application/json;base64,<...>` trailer of an emitted
// JS/declaration file, leaving the rest of the text untouched.
func adjustInlineSourceMap(text string, dropLines int) (string, bool) {
  marker := strings.LastIndex(text, inlineSourceMapMarker)
  if marker < 0 {
    return text, false
  }
  start := marker + len(inlineSourceMapMarker)
  end := start
  for end < len(text) && text[end] != '\n' && text[end] != '\r' {
    end++
  }
  raw, err := base64.StdEncoding.DecodeString(text[start:end])
  if err != nil {
    return text, false
  }
  adjusted, ok := AdjustSourceMapForPreamble(string(raw), dropLines)
  if !ok {
    return text, false
  }
  return text[:start] + base64.StdEncoding.EncodeToString([]byte(adjusted)) + text[end:], true
}

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
// This rewrites the map's `mappings` to undo that shift, per source: a segment is
// only adjusted when its source file (`sources[sourceIndex]`) is one the preamble
// was injected into (`isSourcePreambleTarget`) — so a mixed map (e.g. a bundled
// `.js`/`.json` map under `outFile`) leaves `.json` segments alone. For an
// adjusted source, segments inside the preamble region (source line < dropLines)
// are dropped — those generated lines are the emitted preamble comment, which has
// no real-source counterpart and is left unmapped — and every remaining segment's
// source line is moved up by dropLines so it points at the real file. The
// generated side is untouched.
//
// dropLines is the number of newlines the preamble adds (strings.Count(preamble,
// "\n")). The drop region assumes the preamble occupies the leading source lines
// [0, dropLines); for a hashbang file ApplySourcePreamble inserts the preamble
// after the shebang line, so the region is nominally off by one — but shebang and
// preamble-comment lines never carry node mappings, so real-code correction is
// unaffected. Returns (rewritten, true) on success, or (input, false) when there
// is nothing to do or the map cannot be parsed (the caller then writes it as-is).
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
  rewritten, changed := shiftMappingSources(mappings, dropLines, preambleSourceMask(doc["sources"]))
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

// preambleSourceMask decodes a source map's `sources` array into a per-index flag
// of whether that source was preamble-injected (and therefore needs correcting).
// Returns nil when sources is absent or unparseable, which shiftMappingSources
// treats as "adjust every source" — the correct default for the common single
// `.ts`-source map.
func preambleSourceMask(rawSources json.RawMessage) []bool {
  if len(rawSources) == 0 {
    return nil
  }
  var sources []string
  if err := json.Unmarshal(rawSources, &sources); err != nil {
    return nil
  }
  mask := make([]bool, len(sources))
  for i, source := range sources {
    mask[i] = isSourcePreambleTarget(source)
  }
  return mask
}

// shiftMappingSources decodes a source map `mappings` string and, for every
// segment whose source was preamble-injected (per mask), drops it when its
// absolute source line is below dropLines and subtracts dropLines otherwise;
// segments on non-preamble sources pass through unchanged. It then re-encodes.
// genCol resets per generated line; sourceIndex, sourceLine, sourceColumn, and
// nameIndex are cumulative across the whole string (Base64 VLQ deltas), so the
// absolute state is tracked and the deltas recomputed from scratch after the edit.
// mask is nil to adjust every source.
func shiftMappingSources(mappings string, dropLines int, mask []bool) (string, bool) {
  var srcIdx, srcLine, srcCol, nameIdx int // running absolute decode state
  // Re-encode state mirrors the decode cumulants but only advances over kept
  // segments, so dropped segments do not leave a delta gap.
  var outSrcIdx, outSrcLine, outSrcCol, outNameIdx int
  changed := false

  shiftable := func(index int) bool {
    return mask == nil || index < 0 || index >= len(mask) || mask[index]
  }

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
      newSrcLine := srcLine
      if shiftable(srcIdx) {
        if srcLine < dropLines {
          // Inside the injected preamble region: drop the mapping. The decode
          // cumulants already advanced above, so deltas for later kept segments
          // stay correct relative to the real source position.
          changed = true
          continue
        }
        newSrcLine = srcLine - dropLines
        changed = changed || newSrcLine != srcLine
      }
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
