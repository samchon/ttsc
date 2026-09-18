package driver

import (
  "encoding/json"
  "path"
  "strings"
  "unicode/utf16"

  "github.com/microsoft/typescript-go/shim/ast"
)

// AuthoredSourceMap returns the text file was authored with, and sourceMap, a
// map printed from file's Program, corrected to describe that text
// (samchon/ttsc#1392).
//
// A source preamble is inserted into the text TypeScript-Go parses, so every
// position a printer records for a preamble-bearing file lies in that text
// rather than in the file its author wrote, and `sourcesContent` carries the
// preamble too. Each such source is remapped exactly: a position before the
// preamble is kept, one inside it is dropped, and one after it moves back by the
// preamble's extent, on its own line or across lines. This covers a BOM, a
// hashbang, and a preamble that does not end a line. Every corrected source's
// `sourcesContent` becomes its authored text. Without a preamble both values are
// returned as given. ok is false when sourceMap cannot be read, and the map
// must then be discarded rather than published uncorrected.
func (p *Program) AuthoredSourceMap(file *ast.SourceFile, sourceMap string) (authored string, corrected string, ok bool) {
  if p == nil || p.SourcePreamble == "" {
    return file.Text(), sourceMap, true
  }
  authored = file.Text()
  if start, length, found := sourcePreambleRegion(file.FileName(), authored, p.SourcePreamble); found {
    authored = authored[:start] + authored[start+length:]
  }
  var doc map[string]json.RawMessage
  if json.Unmarshal([]byte(sourceMap), &doc) != nil {
    return authored, "", false
  }
  var sources []string
  var mappings string
  if json.Unmarshal(doc["sources"], &sources) != nil || json.Unmarshal(doc["mappings"], &mappings) != nil {
    return authored, "", false
  }
  directory := path.Dir(file.FileName())
  regions := make([]*authoredRegion, len(sources))
  anyRegion := false
  for index, source := range sources {
    name := path.Join(directory, source)
    target := file
    if name != file.FileName() {
      target = p.SourceFile(name)
    }
    if target == nil {
      continue
    }
    if region := newAuthoredRegion(target.FileName(), target.Text(), p.SourcePreamble); region != nil {
      regions[index] = region
      anyRegion = true
    }
  }
  if !anyRegion {
    return authored, sourceMap, true
  }
  remapped, valid := remapSourcePositions(mappings, func(source, line, column int) (int, int, bool) {
    if source < 0 || source >= len(regions) || regions[source] == nil {
      return line, column, true
    }
    return regions[source].authoredPosition(line, column)
  })
  if !valid {
    return authored, "", false
  }
  encoded, err := marshalSourceMapJSON(remapped)
  if err != nil {
    return authored, "", false
  }
  doc["mappings"] = encoded
  if raw, present := doc["sourcesContent"]; present {
    var contents []*string
    if json.Unmarshal(raw, &contents) != nil {
      return authored, "", false
    }
    for index, region := range regions {
      if region != nil && index < len(contents) && contents[index] != nil {
        text := region.text
        contents[index] = &text
      }
    }
    if doc["sourcesContent"], err = marshalSourceMapJSON(contents); err != nil {
      return authored, "", false
    }
  }
  out, err := marshalSourceMapJSON(doc)
  if err != nil {
    return authored, "", false
  }
  return authored, string(out), true
}

// authoredRegion is where a source preamble sits in one parsed file, in the
// line and UTF-16 column coordinates a source map records, and that file's
// authored text.
type authoredRegion struct {
  // startLine and startColumn locate the preamble's first character.
  startLine, startColumn int
  // endLine and endColumn locate the first character after it.
  endLine, endColumn int
  // text is the file without the preamble.
  text string
}

// newAuthoredRegion locates preamble in the parsed text of fileName, or
// returns nil when the preamble was never injected into it.
func newAuthoredRegion(fileName, text, preamble string) *authoredRegion {
  start, length, found := sourcePreambleRegion(fileName, text, preamble)
  if !found {
    return nil
  }
  startLine, startColumn := sourceMapPosition(text[:start])
  preambleLines, lastColumn := sourceMapPosition(text[start : start+length])
  endColumn := lastColumn
  if preambleLines == 0 {
    endColumn += startColumn
  }
  return &authoredRegion{
    startLine:   startLine,
    startColumn: startColumn,
    endLine:     startLine + preambleLines,
    endColumn:   endColumn,
    text:        text[:start] + text[start+length:],
  }
}

// authoredPosition maps a parsed-text position to the authored text. ok is false
// for a position inside the preamble, which the author never wrote.
func (r *authoredRegion) authoredPosition(line, column int) (int, int, bool) {
  if line < r.startLine || line == r.startLine && column < r.startColumn {
    return line, column, true
  }
  if line < r.endLine || line == r.endLine && column < r.endColumn {
    return 0, 0, false
  }
  if line == r.endLine {
    return r.startLine, r.startColumn + column - r.endColumn, true
  }
  return line - (r.endLine - r.startLine), column, true
}

// sourceMapPosition returns the line and UTF-16 column reached at the end of
// text, counting line terminators the way ECMAScript does.
func sourceMapPosition(text string) (int, int) {
  line, lineStart := 0, 0
  for index := 0; index < len(text); {
    switch {
    case text[index] == '\r' && index+1 < len(text) && text[index+1] == '\n':
      index += 2
    case text[index] == '\r' || text[index] == '\n':
      index++
    case strings.HasPrefix(text[index:], " ") || strings.HasPrefix(text[index:], " "):
      index += len(" ")
    default:
      index++
      continue
    }
    line++
    lineStart = index
  }
  return line, len(utf16.Encode([]rune(text[lineStart:])))
}

// remapSourcePositions rewrites every source position of a `mappings` string
// through remap, dropping a segment remap rejects. valid is false when the
// string cannot be decoded.
func remapSourcePositions(mappings string, remap func(source, line, column int) (int, int, bool)) (string, bool) {
  var source, sourceLine, sourceColumn, name int
  var outSource, outSourceLine, outSourceColumn, outName int
  lines := strings.Split(mappings, ";")
  for lineIndex, line := range lines {
    if line == "" {
      continue
    }
    var column, outColumn int
    segments := strings.Split(line, ",")
    kept := make([]string, 0, len(segments))
    for _, segment := range segments {
      if segment == "" {
        continue
      }
      fields := decodeVLQ(segment)
      if len(fields) != 1 && len(fields) != 4 && len(fields) != 5 {
        return "", false
      }
      column += fields[0]
      if len(fields) == 1 {
        kept = append(kept, encodeVLQ([]int{column - outColumn}))
        outColumn = column
        continue
      }
      source += fields[1]
      sourceLine += fields[2]
      sourceColumn += fields[3]
      if len(fields) == 5 {
        name += fields[4]
      }
      mappedLine, mappedColumn, keep := remap(source, sourceLine, sourceColumn)
      if !keep {
        continue
      }
      out := []int{
        column - outColumn,
        source - outSource,
        mappedLine - outSourceLine,
        mappedColumn - outSourceColumn,
      }
      if len(fields) == 5 {
        out = append(out, name-outName)
        outName = name
      }
      kept = append(kept, encodeVLQ(out))
      outColumn = column
      outSource = source
      outSourceLine = mappedLine
      outSourceColumn = mappedColumn
    }
    lines[lineIndex] = strings.Join(kept, ",")
  }
  return strings.Join(lines, ";"), true
}
