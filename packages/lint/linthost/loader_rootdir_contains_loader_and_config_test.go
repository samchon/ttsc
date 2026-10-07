package linthost

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestLoaderRootDirContainsLoaderAndConfig verifies the ephemeral loader
// tsconfig's rootDir contains both authored `files` entries under the host's path grammar.
//
// The loader tsconfig lists two absolute inputs — the generated loader script
// and the user's config — and tsgo rejects any input outside rootDir with
// TS6059. The historical hardcoded "/" is not an ancestor of drive-letter
// paths, so on Windows every TypeScript config evaluation failed (#299,
// #304); rootDir must be the volume root of the loader directory instead.
//
// 1. Synthesize the loader tsconfig for a temp-dir loader and config.
// 2. Parse the generated JSON.
// 3. Assert rootDir is slash-terminated and every `files` entry starts with it.
//
// @evidence contracts/testing.md#behavioral-verification typeScriptConfigLoaderTsconfig emits two input paths under one slash-terminated rootDir, avoiding a root that excludes the config or loader.
// @evidence contracts/testing.md#independent-expectations encoding/json independently decodes output and the authored two input locations define required ancestry; this checks generated behavior rather than committed file arrangement.
// @evidence contracts/testing.md#distinguishing-cases Both loader and config must fit; LoaderModuleOptionFollowsTheConfigPackageType separately owns module mode and TestWindowsLoaderTempBaseStaysOnConfigVolume owns cross-volume placement. This case observes the current host path grammar; the Linux execution alone does not prove Windows drive-root syntax.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit generates loader tsconfig JSON for two authored host-native paths and independently decodes their identities and root ancestry in-process; it does not launch the generated compiler project or certify another OS path grammar.
func TestLoaderRootDirContainsLoaderAndConfig(t *testing.T) {
  dir := t.TempDir()
  raw := typeScriptConfigLoaderTsconfig(
    filepath.Join(dir, "loader.mts"),
    filepath.Join(dir, "lint.config.ts"),
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
  if parsed.Files[0] != filepath.ToSlash(filepath.Join(dir, "loader.mts")) ||
    parsed.Files[1] != filepath.ToSlash(filepath.Join(dir, "lint.config.ts")) {
    t.Fatalf("generated inputs lost their authored identities: %#v", parsed.Files)
  }
  for _, file := range parsed.Files {
    if !strings.HasPrefix(file, rootDir) {
      t.Fatalf("files entry %q is not under rootDir %q", file, rootDir)
    }
  }
}
