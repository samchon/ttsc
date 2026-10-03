package ttsc_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityFilterUnknownWrapperArgs verifies utility option parsing ignores
// wrapper-only host flags before the Go flag set sees them.
//
// The JS launcher can forward options that belong to the broader runtime host,
// not the utility sidecar. This black-box check covers the filter branch for
// inline unknown flags, unknown flags with separate values, known inline flags,
// and arguments after `--`.
//
// 1. Create a minimal project that check mode can load.
// 2. Run utility check with mixed wrapper-only and utility-owned flags.
// 3. Assert the command succeeds, proving the unknown flags were filtered out.
//
// @evidence contracts/testing.md#behavioral-verification RunCheck over a plain project succeeds when mixed wrapper-only and utility flags are passed, proving the unknown flags never reach Go's flag parser.
// @evidence contracts/testing.md#independent-expectations Success status on a project with no diagnostics is the contract; any leaked unknown flag would make the flag set fail with status 2.
// @evidence contracts/testing.md#distinguishing-cases Inline unknown flags, unknown flags with a separate value, known inline flags and post-'--' arguments are each present in one invocation.
// @evidence contracts/testing.md#execution-ownership TestUtilityFilterUnknownWrapperArgs is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityFilterUnknownWrapperArgs(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the project itself is intentionally plain so a failure
  // points at argument filtering instead of TypeScript diagnostics.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  // Parse assertion: RunCheck would return usage status 2 if filterHostArgs
  // let any wrapper-only flag reach flag.Parse.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--binary=/ignored/tsgo",
      "--cache-dir", ".ignored-cache",
      "--cwd=" + root,
      "--emit",
      "--tsconfig=tsconfig.json",
      "--plugins-json=[]",
      "--",
      "--cwd", "/ignored/after-delimiter",
    })
  })
  if code != 0 || out != "" || errOut != "" {
    t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
