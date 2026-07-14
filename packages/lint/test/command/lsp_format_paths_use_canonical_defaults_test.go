package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPFormatPathsUseDefaultsWithoutLintConfig guards the editor contract
// for projects that use formatting without configuring lint at all.
//
// Code-action discovery, disk execute-command, dirty-buffer formatting, and
// the CLI must all activate the same always-on formatter defaults. In
// particular, the LSP front doors must not fail just because lint.config.json
// is absent.
func TestLSPFormatPathsUseDefaultsWithoutLintConfig(t *testing.T) {
  source := "const value = 1\n"
  root := seedLintProject(t, source)

  assertCanonicalLSPFormatPaths(t, root, source, "const value = 1;\n")
}

// TestLSPFormatPathsUseDefaultsWithoutFormatBlock guards the distinction
// between a lint configuration and an explicit formatter configuration.
//
// A rules-only lint.config.json must not suppress documented formatter
// defaults on any LSP path.
func TestLSPFormatPathsUseDefaultsWithoutFormatBlock(t *testing.T) {
  source := "const value = 1\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{"no-var": "off"},
  })

  assertCanonicalLSPFormatPaths(t, root, source, "const value = 1;\n")
}

// TestLSPFormatPathsUseEditorLanguageOverrides guards the resolver context
// used by editor-originated format requests.
//
// The project-wide, combined, and exact TypeScript values all disagree. LSP
// requests must resolve the real document language and select the exact scope;
// the project-wide CLI must use only the top-level value. Every value is
// deliberately non-default so neither path can pass by skipping settings.
func TestLSPFormatPathsUseEditorLanguageOverrides(t *testing.T) {
  source := "function outer() {\n     const value = 1\n}\n"
  root := seedLintProject(t, source)
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), `{
  "editor.tabSize": 3,
  "[javascript][typescript]": { "editor.tabSize": 6 },
  "[typescript]": { "editor.tabSize": 4 }
}`)

  assertLSPFormatPaths(t, root, source, "function outer() {\n    const value = 1;\n}\n")
  assertCLIFormatText(t, root, "function outer() {\n   const value = 1;\n}\n")
}

// TestLSPFormatPathsHonorEntryIgnores guards scoping parity across every
// formatting front door. A rules-bearing entry is important here: it proves
// ignores are preserved even when the config is not an ignore-only entry.
func TestLSPFormatPathsHonorEntryIgnores(t *testing.T) {
  source := "const value = 1\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "ignores": []string{"src/main.ts"},
    "rules":   map[string]any{"no-var": "off"},
  })
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))

  actions := runLSPCodeActionsForTest(t, root, uri, `{"only":["source.format"]}`)
  if got := actionCommandsForTest(actions); len(got) != 0 {
    t.Fatalf("ignored format actions = %#v, want none", got)
  }
  if edit := executeLSPCommandEditForTest(t, root, uri, commandFormatDocument); edit != nil {
    t.Fatalf("ignored disk format edit = %#v, want nil", edit)
  }
  if edit := executeLSPFormatBufferEditForTest(t, root, uri, source); len(edit.Changes) != 0 {
    t.Fatalf("ignored buffer format edit = %#v, want no changes", edit)
  }

  assertCLIFormatText(t, root, source)
}

func assertCanonicalLSPFormatPaths(t *testing.T, root string, source string, want string) {
  t.Helper()
  assertLSPFormatPaths(t, root, source, want)
  assertCLIFormatText(t, root, want)
}

func assertLSPFormatPaths(t *testing.T, root string, source string, want string) {
  t.Helper()
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))

  actions := runLSPCodeActionsForTest(t, root, uri, `{"only":["source.format"]}`)
  if got := actionCommandsForTest(actions); len(got) != 1 || got[0] != commandFormatDocument {
    t.Fatalf("format actions = %#v, want [%q]", got, commandFormatDocument)
  }
  if got := executeLSPCommandAppliedTextForTest(t, root, uri, commandFormatDocument, source); got != want {
    t.Fatalf("disk format text = %q, want %q", got, want)
  }
  if got := executeLSPFormatBufferAppliedTextForTest(t, root, uri, source, source); got != want {
    t.Fatalf("buffer format text = %q, want %q", got, want)
  }
}

func assertCLIFormatText(t *testing.T, root string, want string) {
  t.Helper()
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != want {
    t.Fatalf("CLI format text = %q, want %q", string(got), want)
  }
}
