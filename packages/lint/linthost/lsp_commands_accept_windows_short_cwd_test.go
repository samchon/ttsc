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
//  1. Exercise the fixture variants described above through the owning operation.
//  2. Compare their observable results with the independently authored expectations.
// @evidence contracts/testing.md#behavioral-verification Both fix-all and stdin formatting accept Windows short cwd while preserving the long editor URI and producing literal let/semicolon rewrites.
// @evidence contracts/testing.md#independent-expectations The authored long URI and literal let value/const value text establish namespace and edit expectations independently of path normalization output.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: fix all, format buffer. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestLSPCommandsAcceptWindowsShortCwd belongs to the existing Windows setup boundary batch, which materializes Go helpers once and executes the real NTFS operation; the Linux unit population does not select it.
// @evidence contracts/e2e.md#necessary-boundary Real GetShortPathName aliases connect short cwd, long config paths and long editor URIs to one Windows project. Literal portable paths cannot prove both command paths resolve the NTFS identity and retain the editor URI.
// @evidence contracts/e2e.md#shared-execution The existing Windows setup batch prepares one Go package and installed toolchain. The fix-all and stdin-format subcases reuse the Go host without separate builds or host child processes; distinct configurations require separate disposable projects.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each subcase owns its project/configuration and obtains an alias for that fixture. Command capture and buffer-stdin helpers restore global streams before the next subcase; Go cleanup owns their fixture directories.
// @evidence contracts/e2e.md#preserved-coverage Both original short-cwd command subcases retain exact authored let/semicolon results and the helper requirement for edits under the supplied long-form URI. Portable command class and UTF-16 semantics remain in separately selected lint units.
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
