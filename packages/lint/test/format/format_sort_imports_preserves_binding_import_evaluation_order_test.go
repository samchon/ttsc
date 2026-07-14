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
