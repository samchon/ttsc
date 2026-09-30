package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPCodeActionsReturnsEmptyForOutsideCwdTarget verifies command
// advertising respects the project boundary.
//
// ExecuteCommand rejects targets outside `--cwd` before reading them. Code
// actions should make the same decision up front so VSCode does not show a
// fix-all command that will fail when selected.
//
// 1. Seed a project whose tsconfig includes a file outside cwd.
// 2. Enable a fixable lint rule.
// 3. Request `source.fixAll.ttsc` code actions for the outside file URI.
// 4. Assert the action list is empty.
// @evidence contracts/testing.md#behavioral-verification lsp-code-actions rejects an included, fixable source outside cwd by returning no actions, rather than offering a failing fix-all command.
// @evidence contracts/testing.md#independent-expectations The fixture supplies the outside URI and independent empty-array expectation from the workspace mutation boundary.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a project whose tsconfig includes a file outside cwd. The asserted decision is: Assert the action list is empty. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestLSPCodeActionsReturnsEmptyForOutsideCwdTarget owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestLSPCodeActionsReturnsEmptyForOutsideCwdTarget(t *testing.T) {
  parent := t.TempDir()
  root := filepath.Join(parent, "project")
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["../outside.ts"]
}
`)
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  outside := filepath.Join(parent, "outside.ts")
  writeFile(t, outside, "var outside = 1;\nJSON.stringify(outside);\n")
  uri := lintTestFileURI(t, outside)

  actions := runLSPCodeActionsForTest(t, root, uri, `{"only":["source.fixAll.ttsc"]}`)
  if len(actions) != 0 {
    t.Fatalf("outside-cwd target advertised code actions: %#v", actions)
  }
}
