package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// Verifies the native CLI rejects a diagnostic-only declaration failure.
//
// Ordinary source checking does not report TS4094 in an emitting project.
// The host must inspect emit diagnostics before publishing its manifest.
//
// 1. Export an anonymous class with a private field and enable declarations.
// 2. Run the real build command with a manifest path.
// 3. Assert nonzero status, TS4094, failure context and no success manifest.
func TestCLIProjectBuildEmitErrorRejectsManifest(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","declaration":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", `export const value = class { private hidden = 1; };`)
  manifest := filepath.Join(root, "manifest.json")
  code, out, errOut := runNativeCommand(t, "build", "--cwd", root, "--emit", "--manifest", manifest)
  if code == 0 {
    t.Fatalf("build succeeded: %s %s", out, errOut)
  }
  for _, text := range []string{"error", "TS4094", "ttsc: emit failed", "build output is incomplete"} {
    if !strings.Contains(errOut, text) {
      t.Fatalf("missing %q: %s", text, errOut)
    }
  }
  if _, err := os.Stat(manifest); !os.IsNotExist(err) {
    t.Fatalf("incomplete build published a manifest: %v", err)
  }
}
