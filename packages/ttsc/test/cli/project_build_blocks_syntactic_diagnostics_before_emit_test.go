package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIProjectBuildBlocksSyntacticDiagnosticsBeforeEmit verifies parse
// errors stop emit.
//
// Syntactic diagnostics are fatal before the driver reaches JavaScript output.
// Forced emit should not bypass malformed TypeScript because downstream
// plugins and runtime files would see inconsistent source state.
//
// This scenario exercises a real project with one malformed declaration. The
// output assertion keeps the failure tied to the pre-emit diagnostic gate.
//
// 1. Create a project containing invalid TypeScript syntax.
// 2. Build with forced emit through the native command.
// 3. Assert the syntactic diagnostic appears and no JS is emitted.
func TestCLIProjectBuildBlocksSyntacticDiagnosticsBeforeEmit(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `console.log("before");
const = ;
`)

  code, _, stderr := runNativeCommand(t, "build", "--cwd", root, "--emit")
  if code != 2 {
    t.Fatalf("expected exit 2, got %d stderr=%q", code, stderr)
  }
  if !strings.Contains(stderr, "Variable declaration expected") {
    t.Fatalf("expected syntactic diagnostic, got %q", stderr)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("expected no emitted JS, stat err=%v", err)
  }
}
