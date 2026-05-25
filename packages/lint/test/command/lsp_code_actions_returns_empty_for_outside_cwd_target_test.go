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
