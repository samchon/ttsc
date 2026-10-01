//go:build windows

package linthost

import (
  "os/exec"
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandMaterializesJunctionedDirectoryWithoutMutatingOriginal
// verifies an NTFS junction source directory still yields a fix-all edit.
//
// A Windows junction (`mklink /J`) is the privilege-free directory link used by
// pnpm/nx/Docker mounts, so it runs on every Windows machine rather than only an
// elevated symlink runner. The command target arrives under the junction's
// LOGICAL name (`src`), which the temp workspace must materialize under that
// same name and index by it — resolving the target to the junction's physical
// destination (`real-src`) would match zero findings and silently return no
// edit.
//
//  1. Seed a project whose `src` directory is a junction to `real-src`.
//  2. Execute `ttsc.lint.fixAll` against the visible junction path.
//  3. Assert the returned WorkspaceEdit fixes the document.
//  4. Assert both the junction path and backing file still contain source text.
// @evidence contracts/testing.md#behavioral-verification Fix-all must stage the visible Windows junction source and return its authored edit without mutating either the junction-visible or backing text.
// @evidence contracts/testing.md#independent-expectations Original and fixed fixture text are authored independently of workspace materialization; both physical and visible reads must retain the original bytes.
// @evidence contracts/testing.md#distinguishing-cases This host owns Seed a project whose `src` directory is a junction to `real-src`. Its decision boundary is Assert both the junction path and backing file still contain source text. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestLSPExecuteCommandMaterializesJunctionedDirectoryWithoutMutatingOriginal belongs to the existing Windows setup boundary batch, which materializes Go helpers once and executes the real NTFS operation; the Linux unit population does not select it.
// @evidence contracts/e2e.md#necessary-boundary A real mklink /J reparse point connects the logical source path with its physical backing file. The LSP temp-workspace copy must materialize that logical name; portable source fixtures cannot exercise Windows junction traversal.
// @evidence contracts/e2e.md#shared-execution The existing Windows setup batch shares the installed toolchain and one Go package preparation; this case calls the native Go host in process and builds no per-case native sidecar.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each named case owns its disposable project and configuration; Go cleanup removes fixture state after the case. Stdin/stdout capture restores the shared process handles before another case uses them.
// @evidence contracts/e2e.md#preserved-coverage This moved entry retains the authored WorkspaceEdit result and source-preservation assertions at the Windows boundary. Portable command/class selection and UTF-16 edit assertions remain in the lint units.
func TestLSPExecuteCommandMaterializesJunctionedDirectoryWithoutMutatingOriginal(t *testing.T) {
  root := t.TempDir()
  source := "var legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts"]
}
`)
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  realDir := filepath.Join(root, "real-src")
  realFile := filepath.Join(realDir, "main.ts")
  writeFile(t, realFile, source)
  linkDir := filepath.Join(root, "src")
  if out, err := exec.Command("cmd", "/c", "mklink", "/J", linkDir, realDir).CombinedOutput(); err != nil {
    t.Fatalf("mklink /J unavailable: %v: %s", err, out)
  }
  linkFile := filepath.Join(linkDir, "main.ts")
  uri := lintTestFileURI(t, linkFile)

  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  want := "let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
  if got != want {
    t.Fatalf("junctioned directory LSP fix text mismatch:\nwant %q\ngot  %q", want, got)
  }
  assertFileText(t, realFile, source)
  assertFileText(t, linkFile, source)
}
