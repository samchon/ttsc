package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPCommandsAcceptWindowsShortCwd verifies both LSP mutation paths compare
// the document target and --cwd in the same physical namespace. WorkspaceEdit
// keys remain the editor's original long-form URI.
func TestLSPCommandsAcceptWindowsShortCwd(t *testing.T) {
  t.Run("fix all", func(t *testing.T) {
    source := "var value = 1;\n"
    root := seedLintProject(t, source)
    longRoot := realProjectPath(root)
    shortRoot := windowsShortPathForTest(t, longRoot)
    configFile := filepath.Join(longRoot, "custom-lint.config.json")
    writeFile(t, configFile, `{"rules":{"no-var":"error"}}`)
    pluginsJSON := lintManifestWithConfig(t, map[string]any{"configFile": configFile})
    uri := lintTestFileURI(t, filepath.Join(longRoot, "src", "main.ts"))

    got := executeLSPCommandAppliedTextWithManifestForTest(
      t,
      shortRoot,
      uri,
      commandLintFixAll,
      source,
      pluginsJSON,
    )
    if want := "let value = 1;\n"; got != want {
      t.Fatalf("LSP fix through short cwd: got %q, want %q", got, want)
    }
  })

  t.Run("format buffer", func(t *testing.T) {
    source := "const value = 1\n"
    root := seedLintProject(t, source)
    seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
    longRoot := realProjectPath(root)
    shortRoot := windowsShortPathForTest(t, longRoot)
    uri := lintTestFileURI(t, filepath.Join(longRoot, "src", "main.ts"))

    got := executeLSPFormatBufferAppliedTextForTest(t, shortRoot, uri, source, source)
    if want := "const value = 1;\n"; got != want {
      t.Fatalf("LSP format through short cwd: got %q, want %q", got, want)
    }
  })
}
