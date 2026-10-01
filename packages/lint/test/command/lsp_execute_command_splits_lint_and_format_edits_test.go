package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandSplitsLintAndFormatEdits verifies command execution
// applies only the requested edit class.
//
// VSCode invokes `workspace/executeCommand` for both fix-all and format code
// actions. The `@ttsc/lint` sidecar must keep those commands separate so
// "format document" does not apply lint rewrites and "fix all" does not apply
// formatter-only edits.
//
// 1. Seed a project with one no-var fix and one missing-semi format fix.
// 2. Execute `ttsc.lint.fixAll` through the LSP command path.
// 3. Execute `ttsc.format.document` through the same path.
// 4. Assert the returned WorkspaceEdits contain only their own edit class.
// @evidence contracts/testing.md#behavioral-verification Fix-all changes var to let without adding semicolons; format-document adds semicolons without changing var, rejecting cross-class rewrites.
// @evidence contracts/testing.md#independent-expectations Two independently authored full source strings specify each allowed change and preservation of the other defect.
// @evidence contracts/testing.md#distinguishing-cases The same source contains both a lint defect and a formatting defect so either command applying both classes fails instead of passing a single-defect fixture.
// @evidence contracts/testing.md#execution-ownership Both LSP commands dispatch directly through the Go host and native rules in one unit process; the helper also requires exactly the requested URI with nonempty edits.
func TestLSPExecuteCommandSplitsLintAndFormatEdits(t *testing.T) {
  source := "var legacy = 1\nJSON.stringify(legacy)\nexport {}\n"
  root := seedLintProject(t, source)
  // no-var is a lint rule; the format block enables format/semi (formatting
  // is configured only through the format block).
  seedLintConfig(t, root, map[string]any{
    "rules":  map[string]any{"no-var": "error"},
    "format": map[string]any{},
  })
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  fixed := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  if fixed != "let legacy = 1\nJSON.stringify(legacy)\nexport {}\n" {
    t.Fatalf("fix-all applied text = %q", fixed)
  }
  formatted := executeLSPCommandAppliedTextForTest(t, root, uri, commandFormatDocument, source)
  if formatted != "var legacy = 1;\nJSON.stringify(legacy);\nexport {};\n" {
    t.Fatalf("format applied text = %q", formatted)
  }
}
