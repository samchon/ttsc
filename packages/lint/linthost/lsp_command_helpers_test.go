package linthost

import (
  "encoding/json"
  "strings"
  "testing"
  "unicode/utf16"
)

func executeLSPCommandEditForTest(t *testing.T, root string, uri string, command string) *lspWorkspaceEdit {
  t.Helper()
  return executeLSPCommandEditWithManifestForTest(t, root, uri, command, lintManifest(t))
}

func executeLSPCommandEditWithManifestForTest(t *testing.T, root string, uri string, command string, pluginsJSON string) *lspWorkspaceEdit {
  t.Helper()
  uriArg, err := json.Marshal(uri)
  if err != nil {
    t.Fatal(err)
  }
  return executeLSPCommandEditWithArgumentsForTest(
    t,
    root,
    command,
    []json.RawMessage{uriArg},
    pluginsJSON,
  )
}

func executeLSPCommandEditWithArgumentsForTest(
  t *testing.T,
  root string,
  command string,
  arguments []json.RawMessage,
  pluginsJSON string,
) *lspWorkspaceEdit {
  t.Helper()
  argsJSON, err := json.Marshal(arguments)
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
  if code != 0 || stderr != "" {
    t.Fatalf("lsp-execute-command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if strings.TrimSpace(stdout) == "null" {
    return nil
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
  if edit == nil || len(edit.Changes) != 1 || len(edit.Changes[uri]) == 0 {
    t.Fatalf("lsp-execute-command %s returned no unique edit for %q: %#v", command, uri, edit)
  }
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
