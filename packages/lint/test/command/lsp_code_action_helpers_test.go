package linthost

import (
  "encoding/json"
  "testing"
)

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
  if code != 0 || stderr != "" {
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
