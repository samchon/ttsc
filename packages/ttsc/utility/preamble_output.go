package utility

import (
  "bytes"
  "encoding/base64"
  "encoding/json"
  "fmt"
  "strings"
  "sync"
  "unicode/utf16"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// preambleInsertion describes generated coordinates only. Source coordinates
// and sourcesContent have already been corrected by the driver.
type preambleInsertion struct {
  line   int
  lines  int
  column int
}

// newPreambleOutputWriter couples a compiler-selected external map with the
// carrier text whose final preamble decision it describes. Native emit writes
// maps first, while plugin emit writes carriers first. Only earlier maps wait;
// ordinary carriers still write at their callback. Each map is delivered once.
// The returned finish operation rejects undelivered paired maps rather than
// silently publishing a map with unknown generated coordinates. Write failures
// can leave partial disk output, as with the underlying compiler writer.
func newPreambleOutputWriter(prog *driver.Program) (shimcompiler.WriteFile, func() error) {
  if shouldRemoveComments(prog) {
    return func(name, text string, _ *shimcompiler.WriteFileData) error {
      return driver.DefaultWriteFile(name, text)
    }, func() error { return nil }
  }
  program := prog.TSProgram
  key := func(name string) shimtspath.Path {
    return shimtspath.ToPath(name, program.GetCurrentDirectory(), program.UseCaseSensitiveFileNames())
  }
  pairs := map[shimtspath.Path]shimtspath.Path{}
  for _, source := range shimcompiler.GetSourceFilesToEmit(program, nil, false) {
    paths := shimcompiler.GetOutputPathsFor(source, program.Options(), program, false)
    if paths.SourceMapFilePath() != "" && paths.JsFilePath() != "" {
      pairs[key(paths.SourceMapFilePath())] = key(paths.JsFilePath())
    }
    if paths.DeclarationMapPath() != "" && paths.DeclarationFilePath() != "" {
      pairs[key(paths.DeclarationMapPath())] = key(paths.DeclarationFilePath())
    }
  }
  type pendingMap struct {
    name string
    text string
  }
  pending := map[shimtspath.Path]pendingMap{}
  decisions := map[shimtspath.Path]preambleInsertion{}
  var mutex sync.Mutex
  writeMap := func(name, text string, insertion preambleInsertion) error {
    shifted, err := shiftPreambleMap(text, insertion)
    if err != nil {
      return fmt.Errorf("ttsc utility: generated source map %s: %w", name, err)
    }
    return driver.DefaultWriteFile(name, shifted)
  }
  writer := func(name, text string, _ *shimcompiler.WriteFileData) error {
    mutex.Lock()
    defer mutex.Unlock()
    output := key(name)
    if carrier, paired := pairs[output]; paired {
      if insertion, seen := decisions[carrier]; seen {
        return writeMap(name, text, insertion)
      }
      pending[output] = pendingMap{name: name, text: text}
      return nil
    }
    insertion := preambleInsertion{}
    if shouldEnsureSourcePreamble(name, text, prog.SourcePreamble) {
      insertion = preambleInsertionFor(text, prog.SourcePreamble)
      var err error
      text, err = shiftPreambleInlineMap(text, insertion)
      if err != nil {
        return fmt.Errorf("ttsc utility: generated inline source map %s: %w", name, err)
      }
      text = driver.ApplySourcePreamble(text, prog.SourcePreamble)
    }
    decisions[output] = insertion
    for mapKey, mapping := range pending {
      if pairs[mapKey] == output {
        delete(pending, mapKey)
        if err := writeMap(mapping.name, mapping.text, insertion); err != nil {
          return err
        }
      }
    }
    return driver.DefaultWriteFile(name, text)
  }
  finish := func() error {
    mutex.Lock()
    defer mutex.Unlock()
    if len(pending) != 0 {
      return fmt.Errorf("ttsc utility: %d source maps have no emitted carrier", len(pending))
    }
    return nil
  }
  return writer, finish
}

// preambleInsertionFor mirrors ApplySourcePreamble's BOM/hashbang position.
// Map columns are UTF-16 units and CRLF is one line break. A newline added to
// an unterminated hashbang has no following original code to relocate.
func preambleInsertionFor(text, preamble string) preambleInsertion {
  insertion := preambleInsertion{}
  rest := strings.TrimPrefix(text, "\ufeff")
  if strings.HasPrefix(rest, "#!") {
    insertion.line = 1
  }
  previousCR := false
  for _, character := range preamble {
    if character == '\n' && previousCR {
      previousCR = false
      continue
    }
    previousCR = character == '\r'
    if character == '\r' || character == '\n' || character == '\u2028' || character == '\u2029' {
      insertion.lines++
      insertion.column = 0
    } else {
      insertion.column += utf16.RuneLen(character)
    }
  }
  return insertion
}

const preambleInlineMarker = "//# sourceMappingURL=data:application/json;base64,"

// shiftPreambleInlineMap changes only an emitted compiler trailer. Absent maps
// need no action; a present but undecodable map refuses misleading publication.
func shiftPreambleInlineMap(text string, insertion preambleInsertion) (string, error) {
  start := strings.LastIndex(text, preambleInlineMarker)
  if start < 0 {
    return text, nil
  }
  start += len(preambleInlineMarker)
  end := start
  for end < len(text) && text[end] != '\r' && text[end] != '\n' {
    end++
  }
  decoded, err := base64.StdEncoding.DecodeString(strings.TrimRight(text[start:end], " \t"))
  if err != nil {
    return "", err
  }
  shifted, err := shiftPreambleMap(string(decoded), insertion)
  if err != nil {
    return "", err
  }
  return text[:start] + base64.StdEncoding.EncodeToString([]byte(shifted)) + text[end:], nil
}

// shiftPreambleMap relocates generated lines and the insertion line's first
// column delta in native flat maps. Original/name/source deltas and embedded
// source text remain unchanged. Native emit supplies flat version-3 maps.
func shiftPreambleMap(text string, insertion preambleInsertion) (string, error) {
  if insertion.lines == 0 && insertion.column == 0 {
    return text, nil
  }
  var document map[string]json.RawMessage
  if err := json.Unmarshal([]byte(text), &document); err != nil {
    return "", err
  }
  var version int
  if err := json.Unmarshal(document["version"], &version); err != nil || version != 3 {
    return "", fmt.Errorf("expected a version-3 map")
  }
  var mappings string
  if err := json.Unmarshal(document["mappings"], &mappings); err != nil {
    return "", err
  }
  rows := strings.Split(mappings, ";")
  if insertion.line < len(rows) {
    if rows[insertion.line] != "" && insertion.column != 0 {
      shifted, err := shiftPreambleColumn(rows[insertion.line], insertion.column)
      if err != nil {
        return "", err
      }
      rows[insertion.line] = shifted
    }
    moved := make([]string, len(rows)+insertion.lines)
    copy(moved, rows[:insertion.line])
    copy(moved[insertion.line+insertion.lines:], rows[insertion.line:])
    rows = moved
  }
  document["mappings"], _ = json.Marshal(strings.Join(rows, ";"))
  var buffer bytes.Buffer
  encoder := json.NewEncoder(&buffer)
  encoder.SetEscapeHTML(false)
  if err := encoder.Encode(document); err != nil {
    return "", err
  }
  return strings.TrimSuffix(buffer.String(), "\n"), nil
}

// shiftPreambleColumn modifies the first generated-column delta alone; later
// segment deltas on that line are relative to their preceding segment.
func shiftPreambleColumn(row string, amount int) (string, error) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  value, power, end := 0, 1, 0
  for {
    if end >= len(row) {
      return "", fmt.Errorf("unterminated generated column")
    }
    digit := strings.IndexByte(alphabet, row[end])
    end++
    maximum := int(^uint(0) >> 1)
    if digit < 0 || power > maximum/32 || (digit&31) > (maximum-value)/power {
      return "", fmt.Errorf("invalid generated column")
    }
    value += (digit & 31) * power
    if digit < 32 {
      break
    }
    power *= 32
  }
  if value&1 != 0 {
    return "", fmt.Errorf("negative generated column")
  }
  if amount > int(^uint(0)>>1)/2-value/2 {
    return "", fmt.Errorf("generated column overflow")
  }
  value = (value/2 + amount) * 2
  var encoded strings.Builder
  for {
    digit := value & 31
    value >>= 5
    if value != 0 {
      digit |= 32
    }
    encoded.WriteByte(alphabet[digit])
    if value == 0 {
      break
    }
  }
  return encoded.String() + row[end:], nil
}
