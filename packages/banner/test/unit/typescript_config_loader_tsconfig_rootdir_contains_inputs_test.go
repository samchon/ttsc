package banner_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestTypeScriptConfigLoaderTsconfigRootDirContainsInputs verifies the
// ephemeral loader tsconfig's rootDir contains both of its `files` entries on
// every platform.
//
// The loader tsconfig lists two absolute inputs — the generated loader script
// and the user's banner config — and tsgo rejects any input outside rootDir
// with TS6059. The historical hardcoded "/" is not an ancestor of
// drive-letter paths, so on Windows every TypeScript config evaluation failed
// (#299, #304); rootDir must be the volume root of the loader directory
// instead.
//
// 1. Synthesize the loader tsconfig for a temp-dir loader and config.
// 2. Parse the generated JSON.
// 3. Assert rootDir is slash-terminated and every `files` entry starts with it.
//
// @evidence contracts/testing.md#behavioral-verification Calls bannerTypeScriptConfigLoaderTsconfig, decodes JSON and asserts slash-terminated rootDir with exactly two files, both beneath that root.
// @evidence contracts/testing.md#independent-expectations Loader and config fixture paths share their filesystem root; a slash-terminated root prefix must contain both independently constructed input paths.
// @evidence contracts/testing.md#distinguishing-cases Owns root spelling and two-file containment on the current host; module policy has separate coverage and this check does not run a compiler.
// @evidence contracts/testing.md#execution-ownership Unit entry TestTypeScriptConfigLoaderTsconfigRootDirContainsInputs is selected from test/unit by the utility runner unit overlay. Runs bannerTypeScriptConfigLoaderTsconfig and native root/path calculations in the Go process; no compiler project or child launcher is loaded.
func TestTypeScriptConfigLoaderTsconfigRootDirContainsInputs(t *testing.T) {
  dir := t.TempDir()
  raw := shared.BannerTypeScriptConfigLoaderTsconfig(
    filepath.Join(dir, "loader.mts"),
    filepath.Join(dir, "banner.config.ts"),
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
