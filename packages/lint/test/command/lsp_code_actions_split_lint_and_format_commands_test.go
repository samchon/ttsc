package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestLSPCodeActionsSplitLintAndFormatCommands verifies the command front door
// preserves LSP CodeActionKind filtering.
//
// `lsp-code-actions` receives `context.only` from ttscserver, not from package
// helpers. This test pins the real dispatcher path so a fix-all request cannot
// expose format actions and a format request cannot expose lint fix actions.
//
// 1. Seed a project with one lint fix and one format fix.
// 2. Run `lsp-code-actions` with `source.fixAll.ttsc`.
// 3. Run `lsp-code-actions` with `source.format`.
// 4. Assert each response advertises only its matching command.
func TestLSPCodeActionsSplitLintAndFormatCommands(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1\nJSON.stringify(legacy)\n")
  // no-var is a lint rule; the format block enables format/semi (formatting
  // is configured only through the format block).
  seedLintConfig(t, root, map[string]any{
    "rules":  map[string]any{"no-var": "error"},
    "format": map[string]any{},
  })
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  fixActions := runLSPCodeActionsForTest(t, root, uri, `{"only":["source.fixAll.ttsc"]}`)
  if got := actionCommandsForTest(fixActions); len(got) != 1 || got[0] != commandLintFixAll {
    t.Fatalf("fix-all actions = %#v", got)
  }
  formatActions := runLSPCodeActionsForTest(t, root, uri, `{"only":["source.format"]}`)
  if got := actionCommandsForTest(formatActions); len(got) != 1 || got[0] != commandFormatDocument {
    t.Fatalf("format actions = %#v", got)
  }
}

func runLSPCodeActionsForTest(t *testing.T, root string, uri string, contextJSON string) []lspCodeAction {
  t.Helper()
  return runLSPCodeActionsForRangeForTest(
    t,
    root,
    uri,
    `{"start":{"line":0,"character":0},"end":{"line":0,"character":1}}`,
    contextJSON,
  )
}

func runLSPCodeActionsForRangeForTest(
  t *testing.T,
  root string,
  uri string,
  rangeJSON string,
  contextJSON string,
) []lspCodeAction {
  t.Helper()
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-code-actions",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
      "--uri", uri,
      "--range-json", rangeJSON,
      "--context-json", contextJSON,
    })
  })
  if code != 0 || !isBenignContributorCollisionWarning(stderr) {
    t.Fatalf("lsp-code-actions mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var actions []lspCodeAction
  if err := json.Unmarshal([]byte(stdout), &actions); err != nil {
    t.Fatalf("lsp-code-actions JSON: %v\n%s", err, stdout)
  }
  return actions
}

func actionCommandsForTest(actions []lspCodeAction) []string {
  commands := make([]string, 0, len(actions))
  for _, action := range actions {
    if action.Command != nil {
      commands = append(commands, action.Command.Command)
    }
  }
  return commands
}
