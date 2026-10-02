package ttsc_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityProjectDiagnosticsFailCheck verifies utility check fails on real
// TypeScript semantic diagnostics after plugin configuration succeeds.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a syntactically valid project with a type error.
// 2. Run utility check with no linked plugin errors.
// 3. Assert TypeScript diagnostics produce a non-zero command status.
//
// @evidence contracts/testing.md#behavioral-verification RunCheck over a project with a type error returns a nonzero status once plugin configuration has succeeded.
// @evidence contracts/testing.md#independent-expectations The assignment of a string to a number is a TypeScript semantic error by the language definition, independent of the host.
// @evidence contracts/testing.md#distinguishing-cases A syntactically valid project with a semantic error contrasts with the configuration and plugin failures covered elsewhere.
// @evidence contracts/testing.md#execution-ownership TestUtilityProjectDiagnosticsFailCheck is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityProjectDiagnosticsFailCheck(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the invalid assignment reaches prog.Diagnostics rather
  // than tsconfig parsing or plugin configuration.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `const value: number = "bad";
export { value };
`)

  // Diagnostic assertion: the utility host must surface semantic diagnostics
  // and return the same failure code used by command wrappers.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{"--cwd", root})
  })
  if code != 2 || out != "" || !strings.Contains(errOut, "Type 'string' is not assignable") {
    t.Fatalf("RunCheck diagnostic mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
