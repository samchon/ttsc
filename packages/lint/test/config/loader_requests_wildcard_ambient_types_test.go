package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestLoaderRequestsWildcardAmbientTypes verifies the ephemeral loader tsconfig
// asks for every installed `@types` package.
//
// TypeScript 7 includes no ambient type package unless `types` contains "*",
// and this Program extends nothing, so without the wildcard a config could not
// name a single Node global — `__dirname` failed to type-check with TS2304
// before it ever ran, and no project-level setting could influence it (#1068).
// The loader directory links the config's nearest node_modules, so the default
// typeRoots walk resolves exactly what the project installed.
//
// 1. Synthesize the loader tsconfig for a temp-dir loader and config.
// 2. Parse the generated JSON.
// 3. Assert `types` is exactly the wildcard entry.
func TestLoaderRequestsWildcardAmbientTypes(t *testing.T) {
  dir := t.TempDir()
  raw := typeScriptConfigLoaderTsconfig(
    filepath.Join(dir, "loader.mts"),
    filepath.Join(dir, "lint.config.ts"),
    dir,
  )
  var parsed struct {
    CompilerOptions struct {
      Types []string `json:"types"`
    } `json:"compilerOptions"`
  }
  if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
    t.Fatalf("parse generated tsconfig: %v", err)
  }
  if len(parsed.CompilerOptions.Types) != 1 || parsed.CompilerOptions.Types[0] != "*" {
    t.Fatalf("types = %#v, want [\"*\"]", parsed.CompilerOptions.Types)
  }
}
