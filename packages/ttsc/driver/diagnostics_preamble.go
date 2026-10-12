package driver

import (
  "strings"

  "github.com/microsoft/typescript-go/shim/ast"
  "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
)

// Source-preamble correction for compiler diagnostics.
//
// ttsc injects a plugin's source preamble (e.g. @ttsc/banner's copyright block)
// at the SOURCE level: sourcePreambleFS prepends it before TypeScript-Go parses,
// so the preamble participates in comment emission, removeComments, JSDoc
// association, and `.d.ts` emit naturally. The side effect is that every
// position tsgo records — including every diagnostic's — describes the injected
// buffer, while the file the user reads has no preamble. Native source maps use
// Program.NewSourceMapCorrector to remove the exact injected region; this is
// the same invariant applied to the other coordinate the user is shown.
//
// The correction lives here, at the Program boundary where the preamble is
// known, rather than in each renderer. `WritePrettyDiagnostics`, the structured
// diagnostic list the JS launcher serializes, the graph snapshot, and any future
// consumer all read a Diagnostic that is already authored-relative, so none of
// them has to remember.

// preambleView is the authored (preamble-free) view of one preamble-injected
// source file, plus the byte region the preamble occupies in the buffer tsgo
// parsed.
//
// file is a re-parse of the authored text. The diagnostic renderer reads a
// source file's FileName, Text, and ECMA line map to place a location and quote
// a code frame, and all three have to describe the text the user wrote — moving
// the position alone would still quote the preamble-bearing buffer. Re-parsing
// is what produces a line map tsgo itself computed rather than one this package
// re-derived, and it costs one parse per file that actually carries a
// diagnostic.
type preambleView struct {
  file *ast.SourceFile

  // start is the byte offset where the preamble was inserted, and length its
  // byte length. ApplySourcePreamble inserts after a BOM and after a hashbang
  // line, so start is not always zero.
  start int

  length int
}

// authoredPos maps a position in the preamble-bearing buffer to the authored
// file. ok is false for a position inside the injected region, which has no
// authored counterpart at all.
func (v *preambleView) authoredPos(pos int) (int, bool) {
  if pos < v.start {
    return pos, true
  }
  if pos >= v.start+v.length {
    return pos - v.length, true
  }
  return 0, false
}

// authoredEnd maps an exclusive end offset. An end inside the injected region is
// truncated to the region's authored boundary, so a range that starts before the
// preamble never stretches over text the user did not write.
func (v *preambleView) authoredEnd(end int) int {
  if end <= v.start {
    return end
  }
  if end >= v.start+v.length {
    return end - v.length
  }
  return v.start
}

// sourcePreambleBOM is the UTF-8 byte order mark ApplySourcePreamble keeps
// ahead of an injected preamble.
const sourcePreambleBOM = "\ufeff"

// sourcePreambleRegion locates the injected preamble inside the text tsgo
// parsed, mirroring ApplySourcePreamble's insertion point: after a BOM, and
// after a hashbang line when one is present.
//
// The region is read back out of the parsed text rather than recomputed from the
// on-disk file, so it stays correct whichever of the BOM or hashbang the host
// stripped before parsing, and the leading-prefix check makes the result
// self-verifying: a file the preamble was never injected into (a declaration
// file, a `.json` input, a library file) simply does not match and is reported
// as having no region.
//
// One degenerate shape is nominally off by one: a file whose entire content is
// a hashbang with no trailing newline gets the preamble appended after an inserted newline,
// which is indistinguishable from an authored trailing newline. Only a position
// at that file's very end could differ, and such a file has no code to diagnose.
func sourcePreambleRegion(filePath, text, preamble string) (start int, length int, ok bool) {
  if preamble == "" || !isSourcePreambleTarget(filePath) {
    return 0, 0, false
  }
  start = 0
  if strings.HasPrefix(text, sourcePreambleBOM) {
    start = len(sourcePreambleBOM)
  }
  if strings.HasPrefix(text[start:], "#!") {
    newline := strings.IndexByte(text[start:], '\n')
    if newline < 0 {
      return 0, 0, false
    }
    start += newline + 1
  }
  if !strings.HasPrefix(text[start:], preamble) {
    return 0, 0, false
  }
  return start, len(preamble), true
}

// preambleMapper rebuilds diagnostics against the authored source files of one
// preamble-bearing Program. It caches one authored view per source file so every
// diagnostic in a file shares a single re-parsed file object — the renderer's
// "Found N errors in M files" summary groups by that object's identity.
//
// A mapper is built per diagnostics call and thrown away with it: it holds
// re-parsed source files, which have no reason to outlive the report they were
// built for.
type preambleMapper struct {
  preamble string
  views    map[*ast.SourceFile]*preambleView
}

// newPreambleMapper returns nil when this Program has no source preamble, which
// is the signal to leave every diagnostic exactly as tsgo produced it.
func (p *Program) newPreambleMapper() *preambleMapper {
  if p == nil || p.SourcePreamble == "" {
    return nil
  }
  return &preambleMapper{
    preamble: p.SourcePreamble,
    views:    map[*ast.SourceFile]*preambleView{},
  }
}

// viewOf returns the authored view of file, or nil when the preamble was never
// injected into it.
func (m *preambleMapper) viewOf(file *ast.SourceFile) *preambleView {
  if m == nil || file == nil {
    return nil
  }
  if view, cached := m.views[file]; cached {
    return view
  }
  view := newPreambleView(file, m.preamble)
  m.views[file] = view
  return view
}

// newPreambleView re-parses file without its injected preamble. It returns nil
// when the file carries no preamble, or when the re-parse yields nothing to
// anchor against — an uncorrected position is still better than a nil file.
func newPreambleView(file *ast.SourceFile, preamble string) *preambleView {
  text := file.Text()
  start, length, ok := sourcePreambleRegion(file.FileName().AsString(), text, preamble)
  if !ok {
    return nil
  }
  authored := shimparser.ParseSourceFile(file.ParseOptions(), text[:start]+text[start+length:], file.ScriptKind)
  if authored == nil {
    return nil
  }
  return &preambleView{file: authored, start: start, length: length}
}

// remapDiagnostic returns d anchored to its authored source file. ok is false
// when d's own position falls inside the injected preamble, which is the one
// case with no authored answer; see unanchoredPreambleDiagnostic for what the
// caller does with it.
//
// The original diagnostic is never mutated: it belongs to the Program's own
// diagnostic collection, which other callers read.
func (m *preambleMapper) remapDiagnostic(d *ast.Diagnostic) (*ast.Diagnostic, bool) {
  if m == nil || d == nil {
    return d, d != nil
  }
  related, relatedChanged := m.remapRelated(d.RelatedInformation())
  view := m.viewOf(d.File())
  if view == nil {
    if !relatedChanged {
      return d, true
    }
    clone := d.Clone()
    clone.SetRelatedInfo(related)
    return clone, true
  }
  pos, ok := view.authoredPos(d.Pos())
  if !ok {
    return nil, false
  }
  clone := d.Clone()
  clone.SetFile(view.file)
  clone.SetLocation(core.NewTextRange(pos, view.authoredEnd(d.End())))
  if relatedChanged {
    clone.SetRelatedInfo(related)
  }
  return clone, true
}

// remapRelated remaps a diagnostic's related information, each entry against its
// own file. An entry with no authored counterpart is dropped rather than
// reported without a position: related information exists only to point at a
// second location, and the primary diagnostic still carries the message.
func (m *preambleMapper) remapRelated(in []*ast.Diagnostic) ([]*ast.Diagnostic, bool) {
  if len(in) == 0 {
    return nil, false
  }
  out := make([]*ast.Diagnostic, 0, len(in))
  changed := false
  for _, related := range in {
    mapped, ok := m.remapDiagnostic(related)
    if !ok {
      changed = true
      continue
    }
    if mapped != related {
      changed = true
    }
    out = append(out, mapped)
  }
  return out, changed
}

// unanchoredPreambleDiagnostic reports a diagnostic whose position lies inside
// an injected source preamble.
//
// The preamble is text the user never wrote, so there is no authored line to
// name. The source-map lane drops such segments, but a diagnostic is not a
// mapping: dropping it would leave a failing build with nothing on stderr to
// explain the failure, and clamping it to the top of the file would print a
// coordinate that is simply false — the exact defect this correction exists to
// remove. So the report is kept and only the coordinate is dropped: the message,
// the code, and the file the preamble was injected into survive, and the
// diagnostic renders through the anchor-less `path: message` form ttsc already
// uses for diagnostics that have no source range. It counts as an error exactly
// as it did before, so the exit code is unchanged.
//
// One consequence to know: the JS launcher recovers structured diagnostics by
// parsing rendered text, and the anchor-less form carries no `line:col` for that
// parser to match — so a preamble-region diagnostic reaches stderr and the exit
// code but not `IFailure.diagnostics`. That is the same deal every anchor-less
// driver diagnostic has always had (`driver: linked plugins failed to apply`),
// and it is preferable to publishing a structured position that is not real.
func unanchoredPreambleDiagnostic(d *ast.Diagnostic) Diagnostic {
  out := Diagnostic{
    Code:     d.Code(),
    Message:  d.String(),
    Severity: SeverityError,
  }
  if file := d.File(); file != nil {
    out.File = file.FileName().AsString()
  }
  return out
}

// convertProgramDiagnostics converts tsgo diagnostics produced by this Program,
// undoing any source-preamble shift first. Every path that turns this Program's
// raw diagnostics into driver Diagnostics goes through here, so the correction
// cannot be forgotten by a new caller. Diagnostics that never pass through a
// Program — a tsconfig parse failure, a bad CLI flag — keep using
// convertDiagnostics directly, because no preamble is ever injected into them.
func (p *Program) convertProgramDiagnostics(in []*ast.Diagnostic) []Diagnostic {
  mapper := p.newPreambleMapper()
  if mapper == nil {
    return convertDiagnostics(in)
  }
  out := make([]Diagnostic, 0, len(in))
  for _, d := range in {
    if d == nil {
      continue
    }
    mapped, ok := mapper.remapDiagnostic(d)
    if !ok {
      out = append(out, unanchoredPreambleDiagnostic(d))
      continue
    }
    out = append(out, convertDiagnostic(mapped))
  }
  return out
}
