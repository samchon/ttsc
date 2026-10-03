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
//
// @evidence contracts/testing.md#behavioral-verification Fix-all remaps the absolute custom JSON config into its temp workspace so the src glob still enables no-var and the original source remains unchanged.
// @evidence contracts/testing.md#independent-expectations The authored let replacement and original var disk text independently require configuration applicability and nonmutation.
// @evidence contracts/testing.md#distinguishing-cases The config is named custom-lint.config.json, which discovery would not find, is passed as an absolute configFile, and carries a src/** files glob, so the let rewrite appears only if the absolute path was remapped into the temporary workspace; the original file must still contain var.
// @evidence contracts/testing.md#execution-ownership The native Go config loader, fresh Program and private temp copy execute in process with JSON config. The no-var engine requests no type checker; no executable config evaluator or installed compiler runs.
func TestLSPExecuteCommandMapsAbsoluteConfigFileIntoTempWorkspace(t *testing.T) {
  source := "var legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
  root := seedLintProject(t, source)
  configFile := filepath.Join(root, "custom-lint.config.json")
  writeFile(t, configFile, `{"files":["src/**/*.ts"],"rules":{"no-var":"error"}}`)
  file := filepath.Join(root, "src", "main.ts")
  uri := lintTestFileURI(t, file)
  pluginsJSON := lintManifestWithConfig(t, map[string]any{"configFile": configFile})

  got := executeLSPCommandAppliedTextWithManifestForTest(t, root, uri, commandLintFixAll, source, pluginsJSON)
  want := "let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
  if got != want {
    t.Fatalf("absolute configFile LSP fix text mismatch:\nwant %q\ngot  %q", want, got)
  }
  assertFileText(t, file, source)
}
