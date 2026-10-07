package ttsc_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBuildVerboseSummary verifies the verbose command option enables
// utility build summaries even though quiet mode defaults to true.
//
// The build entrypoint parses both quiet and verbose options before it loads
// the project. This test keeps the command-option branch observable through the
// public stdout contract instead of reaching into parseHostOptions directly.
//
// 1. Create an emit-capable project with an output directory.
// 2. Run utility build with `--emit` and `--verbose`.
// 3. Assert stdout includes the plugin and emitted-file summaries.
//
// @evidence contracts/testing.md#behavioral-verification RunBuild with --emit and --verbose prints the plugin and emitted-file summaries to stdout even though quiet is the default.
// @evidence contracts/testing.md#independent-expectations The plugin-free single-source project owes the authored plugins=0 and emitted=1 files summary literals.
// @evidence contracts/testing.md#distinguishing-cases The same authored project is built with and without verbose; verbose summaries contrast with independently required empty stdout under the quiet default.
// @evidence contracts/testing.md#execution-ownership TestUtilityBuildVerboseSummary is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityBuildVerboseSummary(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: no plugins are needed here; the assertion is about command
  // option parsing and summary output.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  // Output assertion: verbose should flip quiet off and print both pre-emit
  // and post-emit summary lines.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--verbose",
      "--plugins-json", "[]",
    })
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunBuild mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(out, "plugins=0 emit=true") || !strings.Contains(out, "emitted=1 files") {
    t.Fatalf("verbose summary was not printed:\n%s", out)
  }
  quietCode, quietOut, quietErr := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{"--cwd", root, "--emit", "--plugins-json", "[]"})
  })
  if quietCode != 0 || quietOut != "" || quietErr != "" {
    t.Fatalf("default quiet build mismatch: code=%d stdout=%q stderr=%q", quietCode, quietOut, quietErr)
  }
}
