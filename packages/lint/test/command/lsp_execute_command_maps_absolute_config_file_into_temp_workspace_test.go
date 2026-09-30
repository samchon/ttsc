package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandMapsAbsoluteConfigFileIntoTempWorkspace verifies scoped
// configs keep matching during temp-workspace command execution.
//
// `configFile` may be absolute in the tsconfig plugin entry. LSP commands run
// fixes in a copied temp workspace, so an absolute original config path must be
// remapped too; otherwise `files` globs compare temp source paths against the
// original config directory and silently disable the rule set.
//
// 1. Seed a project with a non-discovered absolute lint config path.
// 2. Scope that config to `src/**/*.ts` and enable `no-var`.
// 3. Execute `ttsc.lint.fixAll` through the LSP command path.
// 4. Assert the rule still applies and the source file remains unchanged.
// @evidence contracts/testing.md#behavioral-verification Fix-all remaps the absolute custom JSON config into its temp workspace so the src glob still enables no-var and the original source remains unchanged.
// @evidence contracts/testing.md#independent-expectations The authored let replacement and original var disk text independently require configuration applicability and nonmutation.
// @evidence contracts/testing.md#distinguishing-cases A non-discovered absolute config with a files glob distinguishes correct remapping from default config discovery and matching against the original directory.
// @evidence contracts/testing.md#execution-ownership The native Go loader, checker and private temp copy execute in process with JSON config; no executable config evaluator or installed compiler runs.
func TestLSPExecuteCommandMapsAbsoluteConfigFileIntoTempWorkspace(t *testing.T) {
  source := "var legacy = 1;\nJSON.stringify(legacy);\n"
  root := seedLintProject(t, source)
  configFile := filepath.Join(root, "custom-lint.config.json")
  writeFile(t, configFile, `{"files":["src/**/*.ts"],"rules":{"no-var":"error"}}`)
  file := filepath.Join(root, "src", "main.ts")
  uri := lintTestFileURI(t, file)
  pluginsJSON := lintManifestWithConfig(t, map[string]any{"configFile": configFile})

  got := executeLSPCommandAppliedTextWithManifestForTest(t, root, uri, commandLintFixAll, source, pluginsJSON)
  want := "let legacy = 1;\nJSON.stringify(legacy);\n"
  if got != want {
    t.Fatalf("absolute configFile LSP fix text mismatch:\nwant %q\ngot  %q", want, got)
  }
  assertFileText(t, file, source)
}
