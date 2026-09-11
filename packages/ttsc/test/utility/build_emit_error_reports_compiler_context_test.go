package ttsc_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// Verifies the utility host fails and identifies an emit diagnostic.
//
// Emit diagnostics may accompany a nil Go error. The utility host must keep
// TS4094 and the error severity visible and report an incomplete build.
//
// 1. Load a source whose exported anonymous class cannot have declarations.
// 2. Run the utility build entrypoint with declarations enabled.
// 3. Assert a failing status and compiler plus host/phase context.
func TestUtilityBuildEmitErrorReportsCompilerContext(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","declaration":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", `export const value = class { private hidden = 1; };`)
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{"--cwd", root, "--emit"})
  })
  if code == 0 {
    t.Fatalf("build succeeded: %s %s", out, errOut)
  }
  for _, text := range []string{"error", "TS4094", "ttsc utility: emit failed", "build output is incomplete"} {
    if !strings.Contains(errOut, text) {
      t.Fatalf("missing %q: %s", text, errOut)
    }
  }
}
