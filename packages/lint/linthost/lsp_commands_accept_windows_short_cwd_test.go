//go:build windows

package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPCommandsAcceptWindowsShortCwd verifies both LSP mutation paths compare
// the document target and --cwd in the same physical namespace. WorkspaceEdit
// keys remain the editor's original long-form URI.
//
//  1. In subtest `fix all`, write an absolute custom lint config and run
//     `ttsc.lint.fixAll` with `--cwd` set to the 8.3 spelling of the project.
//  2. In subtest `format buffer`, format a stdin buffer through the same short
//     `--cwd`.
//  3. Assert both rewrites (`var` to `let`, added semicolon) are returned for
//     the original long-form URI.
//
// @evidence contracts/testing.md#behavioral-verification Both fix-all and stdin formatting accept Windows short cwd while preserving the long editor URI and producing literal let/semicolon rewrites.
// @evidence contracts/testing.md#independent-expectations The authored long URI and literal let value/const value text establish namespace and edit expectations independently of path normalization output.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: fix all, format buffer. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership This Windows-constrained Go unit directly invokes the maintained package operation in the owning linthost process over disposable filesystem inputs. The Windows GetShortPathName alias is only fixture preparation (the test skips when the volume provides no distinct alias); no installed SDK, product build or product host child is required.
func TestLSPCommandsAcceptWindowsShortCwd(t *testing.T) {
  t.Run("fix all", func(t *testing.T) {
    source := "var value = 1;\nexport {};\n"
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
    if want := "let value = 1;\nexport {};\n"; got != want {
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
