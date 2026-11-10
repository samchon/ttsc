package ttsc_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBuildVerboseNamesEnvironmentInputs verifies a verbose utility
// build names the environment variables its plugins read, after the
// emitted-file summary, and publishes their values only in the private
// observation sidecar.
//
// A developer needs to see which variables a build depended on, but values can
// be secrets, so the summary line carries names only. A plugin that reads no
// environment prints the summary exactly as before.
//
// 1. Build with a plugin that reads a set and an unset variable, with
//    `--verbose` and an emit-observations path.
// 2. Assert the line after `emitted=` names both variables as a sorted JSON
//    array, stdout never contains the value, and the sidecar records it.
// 3. Build with a plugin that reads nothing and assert stdout and the sidecar
//    carry no environment inputs.
//
// @evidence contracts/testing.md#behavioral-verification RunBuild emits a real temporary project through linked source-preamble hooks; stdout must end with the exact environment inputs line after the emitted summary and omit the value, and the emit-observations sidecar must carry or omit environmentInputs.
// @evidence contracts/testing.md#independent-expectations The expected line is the contract literal `// ttsc utility: environment inputs=[...]` with names sorted by byte order; values are the literals this test sets.
// @evidence contracts/testing.md#distinguishing-cases A reading plugin against a non-reading plugin on the same project; set versus unset variable. Envelope recording and first-read fixing belong to TestUtilityTransformRecordsPluginEnvironmentReads.
// @evidence contracts/testing.md#execution-ownership TestUtilityBuildVerboseNamesEnvironmentInputs is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityBuildVerboseNamesEnvironmentInputs(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")
  t.Setenv(environmentModeName, "secret-mode-value")
  t.Setenv(environmentUnsetName, "")
  if err := os.Unsetenv(environmentUnsetName); err != nil {
    t.Fatal(err)
  }

  build := func(plugin environmentReadingPlugin) (string, string) {
    t.Helper()
    resetLinkedPluginRegistry()
    t.Cleanup(resetLinkedPluginRegistry)
    driver.RegisterPlugin(plugin)
    observations := filepath.Join(t.TempDir(), "observations.json")
    code, out, errOut := captureUtilityOutput(t, func() int {
      return utility.RunBuild([]string{
        "--cwd", root,
        "--emit",
        "--verbose",
        "--emit-observations-json", observations,
        "--plugins-json", `[{"name":"env","stage":"transform","config":{}}]`,
      })
    })
    if code != 0 || errOut != "" {
      t.Fatalf("RunBuild mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
    }
    sidecar, err := os.ReadFile(observations)
    if err != nil {
      t.Fatal(err)
    }
    return out, string(sidecar)
  }

  out, sidecar := build(environmentReadingPlugin{
    names: []string{environmentUnsetName, environmentModeName},
  })
  lines := strings.Split(strings.TrimRight(out, "\n"), "\n")
  want := `// ttsc utility: environment inputs=["` + environmentModeName + `","` + environmentUnsetName + `"]`
  if len(lines) < 2 ||
    lines[len(lines)-2] != "// ttsc utility: emitted=1 files" ||
    lines[len(lines)-1] != want {
    t.Fatalf("verbose summary must end with the emitted count and then %q:\n%s", want, out)
  }
  if strings.Contains(out, "secret-mode-value") {
    t.Fatalf("the summary must not print values:\n%s", out)
  }
  var recorded struct {
    EnvironmentInputs map[string]*string `json:"environmentInputs"`
  }
  if err := json.Unmarshal([]byte(sidecar), &recorded); err != nil {
    t.Fatal(err)
  }
  if mode := recorded.EnvironmentInputs[environmentModeName]; mode == nil ||
    *mode != "secret-mode-value" {
    t.Fatalf("sidecar must record the read value: %s", sidecar)
  }
  if unset, ok := recorded.EnvironmentInputs[environmentUnsetName]; !ok || unset != nil {
    t.Fatalf("sidecar must record the unset read as null: %s", sidecar)
  }

  silentOut, silentSidecar := build(environmentReadingPlugin{})
  if strings.Contains(silentOut, "environment inputs") ||
    !strings.HasSuffix(silentOut, "// ttsc utility: emitted=1 files\n") {
    t.Fatalf("a plugin that reads no environment keeps the summary unchanged:\n%s", silentOut)
  }
  if strings.Contains(silentSidecar, "environmentInputs") {
    t.Fatalf("a plugin that reads no environment must not add the field: %s", silentSidecar)
  }
}
