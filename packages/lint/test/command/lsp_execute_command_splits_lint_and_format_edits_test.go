package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
  "unicode/utf16"
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
func TestLSPExecuteCommandSplitsLintAndFormatEdits(t *testing.T) {
  source := "var legacy = 1\nJSON.stringify(legacy)\n"
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{
    "format/semi": "error",
    "no-var":      "error",
  })
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  fixed := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  if fixed != "let legacy = 1\nJSON.stringify(legacy)\n" {
    t.Fatalf("fix-all applied text = %q", fixed)
  }
  formatted := executeLSPCommandAppliedTextForTest(t, root, uri, commandFormatDocument, source)
  if formatted != "var legacy = 1;\nJSON.stringify(legacy);\n" {
    t.Fatalf("format applied text = %q", formatted)
  }
}

func executeLSPCommandEditForTest(t *testing.T, root string, uri string, command string) *lspWorkspaceEdit {
  t.Helper()
  return executeLSPCommandEditWithManifestForTest(t, root, uri, command, lintManifest(t))
}

func executeLSPCommandEditWithManifestForTest(t *testing.T, root string, uri string, command string, pluginsJSON string) *lspWorkspaceEdit {
  t.Helper()
  argsJSON, err := json.Marshal([]string{uri})
  if err != nil {
    t.Fatal(err)
  }
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-execute-command",
      "--cwd", root,
      "--plugins-json", pluginsJSON,
      "--command", command,
      "--arguments-json", string(argsJSON),
    })
  })
  if code != 0 || !isBenignContributorCollisionWarning(stderr) {
    t.Fatalf("lsp-execute-command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var edit lspWorkspaceEdit
  if err := json.Unmarshal([]byte(stdout), &edit); err != nil {
    t.Fatalf("lsp-execute-command JSON: %v\n%s", err, stdout)
  }
  return &edit
}

func executeLSPCommandAppliedTextForTest(t *testing.T, root string, uri string, command string, source string) string {
  t.Helper()
  return executeLSPCommandAppliedTextWithManifestForTest(t, root, uri, command, source, lintManifest(t))
}

func executeLSPCommandAppliedTextWithManifestForTest(t *testing.T, root string, uri string, command string, source string, pluginsJSON string) string {
  t.Helper()
  edit := executeLSPCommandEditWithManifestForTest(t, root, uri, command, pluginsJSON)
  return applyLSPWorkspaceEditForTest(t, source, edit.Changes[uri])
}

func applyLSPWorkspaceEditForTest(t *testing.T, source string, edits []lspTextEdit) string {
  t.Helper()
  next := source
  for i := len(edits) - 1; i >= 0; i-- {
    edit := edits[i]
    start := byteOffsetForLSPPositionForTest(t, next, edit.Range.Start)
    end := byteOffsetForLSPPositionForTest(t, next, edit.Range.End)
    next = next[:start] + edit.NewText + next[end:]
  }
  return next
}

func byteOffsetForLSPPositionForTest(t *testing.T, source string, position lspPosition) int {
  t.Helper()
  line, character := 0, 0
  for offset, r := range source {
    if line == position.Line && character == position.Character {
      return offset
    }
    if r == '\n' {
      line++
      character = 0
      continue
    }
    width := utf16.RuneLen(r)
    if width < 1 {
      width = 1
    }
    character += width
  }
  if line == position.Line && character == position.Character {
    return len(source)
  }
  t.Fatalf("position %#v outside source %q", position, source)
  return 0
}
