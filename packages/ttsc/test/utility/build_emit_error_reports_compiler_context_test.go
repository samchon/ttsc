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
//
// @evidence contracts/testing.md#behavioral-verification RunBuild over a project whose exported anonymous class cannot be declared fails and reports the compiler diagnostic with host and phase context.
// @evidence contracts/testing.md#independent-expectations TS4094, the error severity and the 'emit failed' and 'build output is incomplete' phrases are authored literals from the compiler and host contracts.
// @evidence contracts/testing.md#distinguishing-cases A nil Go error with a non-empty emit diagnostic is the case a status check on errors alone would miss; the nonzero status plus every named fragment must hold.
// @evidence contracts/testing.md#execution-ownership TestUtilityBuildEmitErrorReportsCompilerContext is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
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
