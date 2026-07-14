package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoImportAssign verifies the lint rule corpus fixture no-import-assign.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. This rule uses a
// real temporary module because binding identity comes from the native checker rather than an
// AST-only name set.
//
// This case enables the rule annotations declared in no-import-assign.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture through a real Program.
// 2. Enable only no-import-assign and resolve its import alias.
// 3. Assert the native Engine reports the exact assignment range.
func TestRuleCorpusNoImportAssign(t *testing.T) {
  source := "import { value as x } from \"./dep\";\n// expect: no-import-assign error\nx = 5;\n"
  findings := runNoImportAssignProject(t, source)
  if len(findings) != 1 {
    t.Fatalf("want one no-import-assign finding, got %d (%+v)", len(findings), findings)
  }
  start := strings.Index(source, "x = 5")
  if findings[0].Pos != start || findings[0].End != start+len("x = 5") {
    t.Fatalf("want exact assignment range [%d,%d), got [%d,%d)",
      start, start+len("x = 5"), findings[0].Pos, findings[0].End)
  }
}
