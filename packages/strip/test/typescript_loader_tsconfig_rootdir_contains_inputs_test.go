package strip_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestTypeScriptLoaderTsconfigRootDirContainsInputs verifies the ephemeral
// loader tsconfig's rootDir contains both of its `files` entries on every
// platform.
//
// The loader tsconfig lists two absolute inputs — the generated loader script
// and the user's strip config — and tsgo rejects any input outside rootDir
// with TS6059. The historical hardcoded "/" is not an ancestor of
// drive-letter paths, so on Windows every TypeScript config evaluation failed
// (#299, #304); rootDir must be the volume root of the loader directory
// instead.
//
// 1. Synthesize the loader tsconfig for a temp-dir loader and config.
// 2. Parse the generated JSON.
// 3. Assert rootDir is slash-terminated and every `files` entry starts with it.
func TestTypeScriptLoaderTsconfigRootDirContainsInputs(t *testing.T) {
  dir := t.TempDir()
  raw := stripTypeScriptLoaderTsconfig(
    filepath.Join(dir, "loader.mts"),
    filepath.Join(dir, "strip.config.ts"),
    dir,
  )
  var parsed struct {
    CompilerOptions struct {
      RootDir string `json:"rootDir"`
    } `json:"compilerOptions"`
    Files []string `json:"files"`
  }
  if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
    t.Fatalf("parse generated tsconfig: %v", err)
  }
  rootDir := parsed.CompilerOptions.RootDir
  if !strings.HasSuffix(rootDir, "/") {
    t.Fatalf("rootDir %q is not a slash-terminated root", rootDir)
  }
  if len(parsed.Files) != 2 {
    t.Fatalf("files mismatch: %#v", parsed.Files)
  }
  for _, file := range parsed.Files {
    if !strings.HasPrefix(file, rootDir) {
      t.Fatalf("files entry %q is not under rootDir %q", file, rootDir)
    }
  }
}
