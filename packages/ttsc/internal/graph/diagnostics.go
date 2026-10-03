package graph

import "github.com/samchon/ttsc/packages/ttsc/driver"

// FileDiagnostics filters the resident Program's driver diagnostics by exact
// reported File spelling, with a compiler code where supplied and the location the driver
// resolves (see Diagnostic: authored-relative under a source preamble). Because
// the graph rides the already-open Program, this is one Program.Diagnostics()
// call, not a second Program construction. Native diagnostic stages can still
// perform previously uncomputed checker work before this filter runs.
//
// This does not execute @ttsc/lint or collect transform findings independently.
// Program.Diagnostics includes staged compiler findings and any latched linked
// hook failure; an empty path selects fileless findings, including nil-Program
// errors. The filter neither canonicalizes paths nor proves physical alias identity.
//
// This is the per-file view. The dump publishes the whole-program view through
// NewDiagnostics, which projects the same driver.Diagnostic values before the
// shared dump mapper relativizes their paths. Prefer one whole-program acquisition
// when every file is wanted; this filter reacquires the complete diagnostic result
// once per call.
//
// @evidence contracts/common.md#principled-implementation Exact reported File equality filters the current Program.Diagnostics result, preserving matching fileless and latched-failure entries rather than authenticating physical alias equivalence or compiler-only origin.
// @evidence contracts/common.md#clear-and-simple-design This per-file adapter leaves diagnostic acquisition to Program and whole-generation projection to NewDiagnostics.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No separate lint/transform execution or expected diagnostic is injected; matching driver failures keep their existing origin and meaning.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain reported spelling, fileless scope, staged acquisition and repeated per-file work under the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms Each call includes Program's native staged queries, conversion/sort work and full result allocation before filename-byte comparison and matching-slice growth; filtering population alone is not the total cost.
// @evidence contracts/performance.md#reuse-equivalent-work Program owns any reusable native diagnostic state; this adapter constructs no second Program but neither caches the complete converted result nor guarantees every native query is already warm.
// @evidence contracts/performance.md#bound-retention-and-release-resources Complete delegated diagnostics and matching output coexist without a result cap. Returned records may reference resident AST/source objects; the caller owns their lifetime and the Program, while this filter retains no separate cache or checker lease.
// @evidence contracts/portability.md#os-neutral-implementation The filter preserves and compares driver-reported native File spelling without separator rewriting, cwd anchoring or symlink/case alias discovery; diagnostic coordinate conversion remains with Program.
func FileDiagnostics(prog *driver.Program, path string) []driver.Diagnostic {
  out := make([]driver.Diagnostic, 0)
  for _, diagnostic := range prog.Diagnostics() {
    if diagnostic.File == path {
      out = append(out, diagnostic)
    }
  }
  return out
}
