package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIProjectBuildAllowsUnusedTypeParametersOnOverloadSignatures verifies
// overload declarations do not fail unused checks.
//
// TypeScript permits type parameters that appear only on overload signatures
// even when noUnusedLocals and noUnusedParameters are enabled. The native build
// path should preserve that compiler behavior before deciding whether emit is
// allowed.
//
// This scenario builds a real project with one overload signature and an
// implementation. It protects the diagnostic filtering path that decides which
// semantic diagnostics are fatal before emit.
//
// 1. Create a strict project with noUnused checks enabled.
// 2. Build with forced emit through the native command.
// 3. Assert no unused-type-parameter diagnostic blocks JavaScript output.
func TestCLIProjectBuildAllowsUnusedTypeParametersOnOverloadSignatures(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export function marker<T>(input: unknown): string;
export function marker(input: unknown): string {
  return String(input);
}
`)

  code, _, stderr := runNativeCommand(t, "build", "--cwd", root, "--emit", "--quiet")
  if code != 0 {
    t.Fatalf("build failed: code=%d stderr=%q", code, stderr)
  }
  if strings.Contains(stderr, "declared but never used") || strings.Contains(stderr, "All type parameters are unused") {
    t.Fatalf("overload signature type parameters must not fail noUnused checks: %q", stderr)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); err != nil {
    t.Fatalf("expected emitted JS: %v", err)
  }
}
