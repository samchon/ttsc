//go:build e2e

package linthost

import (
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

// TestFormatSortImportsPreservesBindingImportEvaluationOrder verifies default,
// named, and namespace imports retain their observable module evaluation order.
//
// Every binding import evaluates its dependency even though it is not a bare
// side-effect import. The old bare-import-only guard sorted `b` before `a` into
// `a` before `b`, so this executable ESM witness locks the runtime semantics,
// not merely the formatter's source text.
//
//  1. Format binding imports whose lexical order differs from source order.
//  2. Execute dependency modules that append their names to shared state.
//  3. Assert the formatter emits no declaration edit and Node observes `b,a`.
//
// @evidence contracts/testing.md#behavioral-verification Exercises the native sort-imports rule followed by actual ESM dependency execution in Node; asserts zero formatter findings and the literal b,a dependency evaluation trace, distinguishing the named lost connection or changed behavior from valid execution.
// @evidence contracts/testing.md#independent-expectations ECMAScript binding imports execute modules in authored order; independent dependency modules append their own identities.
// @evidence contracts/testing.md#distinguishing-cases This case owns default/named and namespace bindings are all effectful despite not being bare side-effect imports; portable rule decisions remain in the shared Go unit population.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestFormatSortImportsPreservesBindingImportEvaluationOrder by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry and its subcase failure identities; ordinary Go unit execution does not select this tagged file.
// @evidence contracts/e2e.md#necessary-boundary The actual connection is the native sort-imports rule followed by actual ESM dependency execution in Node; direct native operation calls cannot prove that separate evaluator, formatter, binary-stdin or JavaScript runtime behavior.
// @evidence contracts/e2e.md#shared-execution One Go fixture and one Node module graph execute this binding-import boundary; direct rule units cover additional sorting decisions.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Temporary files own the two modules and main source. The Node child starts a fresh global trace, terminates before comparison and has no cross-case module state.
// @evidence contracts/e2e.md#preserved-coverage Keeps zero formatter findings and the literal b,a dependency evaluation trace and every original input/control branch; preparation sharing changes no expected result or admitted case.
func TestFormatSortImportsPreservesBindingImportEvaluationOrder(t *testing.T) {
  source := `import bDefault, { bNamed } from "./b.mjs";
import * as aNamespace from "./a.mjs";
console.log(globalThis.__sortImportsTrace.join(","));
void bDefault;
void bNamed;
void aNamespace;
`
  root, filePath, findings := runRuleFindingsSnapshotFile(
    t,
    "format/sort-imports",
    "main.mjs",
    source,
    nil,
  )
  if len(findings) != 0 {
    t.Fatalf("format/sort-imports: expected zero findings, got %d (%+v)", len(findings), findings)
  }
  writeFile(t, filepath.Join(root, "src", "b.mjs"), `globalThis.__sortImportsTrace ??= [];
globalThis.__sortImportsTrace.push("b");
export default 0;
export const bNamed = 0;
`)
  writeFile(t, filepath.Join(root, "src", "a.mjs"), `globalThis.__sortImportsTrace ??= [];
globalThis.__sortImportsTrace.push("a");
export const aNamed = 0;
`)
  output, err := exec.Command("node", filePath).CombinedOutput()
  if err != nil {
    t.Fatalf("node failed: %v\n%s", err, output)
  }
  if got := strings.TrimSpace(string(output)); got != "b,a" {
    t.Fatalf("module evaluation order = %q, want %q", got, "b,a")
  }
}
