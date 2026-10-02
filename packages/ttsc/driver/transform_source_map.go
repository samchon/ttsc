package driver

import (
  "encoding/base64"
  "encoding/json"
  "fmt"
  "path"
  "strings"
  "unicode/utf16"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// AuthoredSourceMap returns the text file was authored with, and sourceMap, a
// map printed from file's Program, corrected to describe that text.
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
//
// @evidence contracts/common.md#principled-implementation Source coordinates use exact injected byte regions translated to ECMAScript line and UTF-16 columns; malformed maps are rejected instead of published with false coordinates.
// @evidence contracts/common.md#clear-and-simple-design Region discovery, position remapping, and sourcesContent restoration have separate helpers under one correction operation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts BOM, hashbang, and same-line insertion use actual source extents rather than a fixed line-offset patch.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs define before/inside/after positions, authored content, and failure policy following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Compiler filenames and source-map URLs use slash-based path operations; resident source lookup delegates native canonicalization to the compiler.
// @evidence contracts/performance.md#efficient-algorithms Regions are computed once per source and mappings are decoded and re-encoded in one segment pass.
// @evidence contracts/performance.md#reuse-equivalent-work Each source's region is reused for all mapped segments rather than rediscovering the preamble for every position.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Region metadata is local to the correction and no external resource or resident cache is retained.
func (p *Program) AuthoredSourceMap(file *ast.SourceFile, sourceMap string) (authored string, corrected string, ok bool) {
  if p == nil || p.SourcePreamble == "" {
    return file.Text(), sourceMap, true
  }
  authored = file.Text()
  if start, length, found := sourcePreambleRegion(file.FileName(), authored, p.SourcePreamble); found {
    authored = authored[:start] + authored[start+length:]
  }
  directory := path.Dir(file.FileName())
  corrected, ok = correctAuthoredSourceMap(sourceMap, func(source string) *authoredRegion {
    name := sourceMapFileName(source, directory)
    target := file
    if name != file.FileName() {
      target = p.SourceFile(name)
    }
    if target == nil {
      return nil
    }
    return newAuthoredRegion(target.FileName(), target.Text(), p.SourcePreamble)
  })
  return authored, corrected, ok
}

// NewSourceMapCorrector returns a generation-owned emitted-file correction
// operation. It corrects external JS/declaration maps and inline map trailers
// using the exact injected region of each original compiler source. Output
// paths and sourceRoot/mapRoot follow the native emitter's source directory.
//
// Create it once per emit and discard it when that emit ends. Apply each map
// once; malformed maps fail the emit instead of publishing false coordinates.
// Non-map outputs and programs without a source preamble pass through unchanged.
// Calls must be serialized, and the captured compiler generation must remain
// unchanged until that emit finishes.
//
// @evidence contracts/common.md#principled-implementation Original compiler source regions qualify native emitted coordinates, including BOM, hashbang, same-line text, and ECMAScript line terminators; malformed maps return errors.
// @evidence contracts/common.md#clear-and-simple-design One output-directory index and shared exact map correction serve external and inline artifacts without another line-offset implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler output paths and SourceMapDirectory replace guessed source filenames, fixed line counts, and silent uncorrected malformed maps.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs specify generation ownership, supported map carriers, directory policy, single application, and error behavior following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Compiler path/case operations distinguish native output identity from raw source-map file URLs; published sourceRoot is not mistaken for the emitter's filesystem base.
// @evidence contracts/performance.md#efficient-algorithms Output paths are indexed once per source, each source region is calculated once, and each map processes its segments in one pass.
// @evidence contracts/performance.md#reuse-equivalent-work Every artifact in one emit shares the output index and exact region cache for the same captured compiler generation and preamble.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned closure owns only one generation's index and lazy regions; its emit owner releases the closure on success or failure without a process-global cache.
func (p *Program) NewSourceMapCorrector() func(fileName, text string) (string, error) {
  if p == nil || p.TSProgram == nil || p.SourcePreamble == "" {
    return func(_ string, text string) (string, error) { return text, nil }
  }
  program, preamble := p.TSProgram, p.SourcePreamble
  host := &pluginEmitHost{program: program}
  options := program.Options()
  if !options.SourceMap.IsTrue() && !options.InlineSourceMap.IsTrue() && !options.GetAreDeclarationMapsEnabled() {
    return func(_ string, text string) (string, error) { return text, nil }
  }
  directories := map[shimtspath.Path]string{}
  outputKey := func(name string) shimtspath.Path {
    return shimtspath.ToPath(name, program.GetCurrentDirectory(), program.UseCaseSensitiveFileNames())
  }
  register := func(output, mapOutput string, source *ast.SourceFile) {
    if output == "" {
      return
    }
    directory := shimcompiler.SourceMapDirectory(options, host, output, source)
    directories[outputKey(output)] = directory
    if mapOutput != "" {
      directories[outputKey(mapOutput)] = directory
    }
  }
  for _, source := range shimcompiler.GetSourceFilesToEmit(host, nil, false) {
    outputs := shimcompiler.GetOutputPathsFor(source, options, host, false)
    register(outputs.JsFilePath(), outputs.SourceMapFilePath(), source)
    register(outputs.DeclarationFilePath(), outputs.DeclarationMapPath(), source)
  }
  regions := map[*ast.SourceFile]*authoredRegion{}
  resolve := func(source, directory string) *authoredRegion {
    target := program.GetSourceFile(sourceMapFileName(source, directory))
    if target == nil {
      return nil
    }
    region, found := regions[target]
    if !found {
      region = newAuthoredRegionWithText(target.FileName(), target.Text(), preamble, options.InlineSources.IsTrue())
      regions[target] = region
    }
    return region
  }
  return func(fileName, text string) (string, error) {
    lower := strings.ToLower(fileName)
    external := strings.HasSuffix(lower, ".map")
    if !external && !isInlineSourceMapCarrier(lower) {
      return text, nil
    }
    directory, known := directories[outputKey(fileName)]
    if !known {
      return "", fmt.Errorf("driver: source map output has no compiler source directory: %s", fileName)
    }
    mapText := text
    start, end := 0, 0
    if !external {
      marker := strings.LastIndex(text, inlineSourceMapMarker)
      if marker < 0 {
        return text, nil
      }
      start = marker + len(inlineSourceMapMarker)
      end = start
      for end < len(text) && text[end] != '\n' && text[end] != '\r' {
        end++
      }
      raw, err := base64.StdEncoding.DecodeString(strings.TrimRight(text[start:end], " \t"))
      if err != nil {
        return "", fmt.Errorf("driver: invalid inline source map in %s: %w", fileName, err)
      }
      mapText = string(raw)
    }
    corrected, valid := correctAuthoredSourceMap(mapText, func(source string) *authoredRegion { return resolve(source, directory) })
    if !valid {
      return "", fmt.Errorf("driver: invalid source map in %s", fileName)
    }
    if external {
      return corrected, nil
    }
    return text[:start] + base64.StdEncoding.EncodeToString([]byte(corrected)) + text[end:], nil
  }
}

// sourceMapFileName reverses the pinned generator's raw file-URL spelling.
// GetRelativePathToDirectoryOrUrl does not percent-encode source names, so a
// literal '%' remains filename data and must not undergo URL unescaping.
func sourceMapFileName(source, directory string) string {
  name := shimtspath.GetNormalizedAbsolutePath(source, directory)
  if strings.HasPrefix(name, "file:///") {
    drive := strings.TrimPrefix(name, "file:///")
    if len(drive) >= 3 && drive[1] == ':' && drive[2] == '/' {
      return drive
    }
  }
  return strings.TrimPrefix(name, "file://")
}

// correctAuthoredSourceMap shares exact region removal between syntactic
// printer maps and native emitted maps while each caller owns source lookup.
func correctAuthoredSourceMap(sourceMap string, resolve func(string) *authoredRegion) (string, bool) {
  var doc map[string]json.RawMessage
  if json.Unmarshal([]byte(sourceMap), &doc) != nil {
    return "", false
  }
  var sources []string
  var mappings string
  if json.Unmarshal(doc["sources"], &sources) != nil || json.Unmarshal(doc["mappings"], &mappings) != nil {
    return "", false
  }
  regions := make([]*authoredRegion, len(sources))
  anyRegion := false
  for index, source := range sources {
    if region := resolve(source); region != nil {
      regions[index] = region
      anyRegion = true
    }
  }
  if !anyRegion {
    return sourceMap, true
  }
  remapped, valid := remapSourcePositions(mappings, func(source, line, column int) (int, int, bool) {
    if source < 0 || source >= len(regions) || regions[source] == nil {
      return line, column, true
    }
    return regions[source].authoredPosition(line, column)
  })
  if !valid {
    return "", false
  }
  encoded, err := marshalSourceMapJSON(remapped)
  if err != nil {
    return "", false
  }
  doc["mappings"] = encoded
  if raw, present := doc["sourcesContent"]; present {
    var contents []*string
    if json.Unmarshal(raw, &contents) != nil {
      return "", false
    }
    for index, region := range regions {
      if region != nil && index < len(contents) && contents[index] != nil {
        text := region.text
        contents[index] = &text
      }
    }
    if doc["sourcesContent"], err = marshalSourceMapJSON(contents); err != nil {
      return "", false
    }
  }
  out, err := marshalSourceMapJSON(doc)
  if err != nil {
    return "", false
  }
  return string(out), true
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
  return newAuthoredRegionWithText(fileName, text, preamble, true)
}

// newAuthoredRegionWithText avoids copying entire authored source text when a
// native map does not embed sourcesContent and only coordinates are needed.
func newAuthoredRegionWithText(fileName, text, preamble string, includeText bool) *authoredRegion {
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
  region := &authoredRegion{
    startLine:   startLine,
    startColumn: startColumn,
    endLine:     startLine + preambleLines,
    endColumn:   endColumn,
  }
  if includeText {
    region.text = text[:start] + text[start+length:]
  }
  return region
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
