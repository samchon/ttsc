package linthost

import (
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
// @evidence contracts/testing.md#behavioral-verification A project with lint and format fixes produces only the lint command for source.fixAll.ttsc and only the format command for source.format.
// @evidence contracts/testing.md#independent-expectations The requested action kinds and literal single-command lists express the supported filter contract, independently of returned action enumeration.
// @evidence contracts/testing.md#distinguishing-cases One source has a no-var lint finding and, through the empty format block, missing-semicolon format findings, so both command kinds are available; each of the two context.only requests must then return exactly one command, the lint fix-all command for source.fixAll.ttsc and the format-document command for source.format, so neither request can leak the other's action.
// @evidence contracts/testing.md#execution-ownership TestLSPCodeActionsSplitLintAndFormatCommands owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestLSPCodeActionsSplitLintAndFormatCommands(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1\nJSON.stringify(legacy)\nexport {}\n")
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
