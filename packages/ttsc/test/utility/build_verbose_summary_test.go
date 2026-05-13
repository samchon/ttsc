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
  if !strings.Contains(out, "plugins=0 emit=true") || !strings.Contains(out, "emitted=") {
    t.Fatalf("verbose summary was not printed:\n%s", out)
  }
}
