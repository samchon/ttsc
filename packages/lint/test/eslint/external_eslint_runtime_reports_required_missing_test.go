package main

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestExternalESLintRuntimeReportsRequiredMissing verifies missing required runtime errors.
//
// External ESLint configs with runtime-only features must fail loudly when the
// project has no installed eslint package. The native fallback is only allowed
// when the runtime is optional.
//
// This scenario exercises runExternalESLintDiagnostics and the node subprocess
// wrapper through a temporary project that intentionally lacks node_modules.
//
// 1. Create a temporary project with package.json and eslint.config.js only.
// 2. Mark the ConfigStore as requiring the external ESLint runtime.
// 3. Assert diagnostics fail with the required-runtime message.
func TestExternalESLintRuntimeReportsRequiredMissing(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "package.json"), `{"type":"module"}`)
  config := filepath.Join(root, "eslint.config.js")
  writeFile(t, config, `export default [];`)
  store := &ConfigStore{
    externalConfigPath:    config,
    eslintRuntime:         true,
    eslintRuntimeRequired: true,
  }
  file := parseTSFile(t, filepath.Join(root, "src", "main.ts"), "export const value = 1;\n")
  _, ran, err := runExternalESLintDiagnostics(store, root, []*shimast.SourceFile{file})
  if ran || err == nil || !strings.Contains(err.Error(), "ESLint runtime is required") {
    t.Fatalf("expected required runtime error, ran=%v err=%v", ran, err)
  }
}
