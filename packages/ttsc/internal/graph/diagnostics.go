package graph

import "github.com/samchon/ttsc/packages/ttsc/driver"

// FileDiagnostics returns the resident program's compiler diagnostics for the
// source file at path, with the code tsgo reports and the location the driver
// resolves (see Diagnostic: authored-relative under a source preamble). Because
// the graph rides the already-open Program, this is one Program.Diagnostics()
// call over the warm checker, not a second compile.
//
// This is the compiler-only slice: it carries the TypeScript semantic
// diagnostics, not @ttsc/lint or transform-plugin findings.
//
// This is the per-file view. The dump publishes the whole-program view through
// NewDiagnostics, which groups and relativizes the same driver.Diagnostic values
// in one pass; prefer it when every file is wanted, because filtering per file
// here rescans the program's diagnostics once per call.
//
// @evidence contracts/common.md#principled-implementation Exact physical path equality filters the resident Program's compiler diagnostics without recomputing or substituting findings.
// @evidence contracts/common.md#clear-and-simple-design This per-file adapter leaves diagnostic acquisition to Program and whole-generation projection to NewDiagnostics.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin findings are intentionally outside this compiler-only view; no expected diagnostic is injected or suppressed.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain compiler-only scope, warm acquisition and the full-scan cost of repeated per-file use under the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms Filtering costs O(program diagnostics) and allocates only matching records; callers needing all files are directed to one whole-program projection.
// @evidence contracts/performance.md#reuse-equivalent-work Program owns reusable semantic diagnostics; this adapter consumes that warm result rather than opening a second compile.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned slice transfers to the caller and no additional Program lifetime or cache is retained.
// @evidenceExclude contracts/portability.md#os-neutral-implementation FileDiagnostics computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func FileDiagnostics(prog *driver.Program, path string) []driver.Diagnostic {
  out := make([]driver.Diagnostic, 0)
  for _, diagnostic := range prog.Diagnostics() {
    if diagnostic.File == path {
      out = append(out, diagnostic)
    }
  }
  return out
}
