package ttsc_test

import (
  "encoding/json"
  "os"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// environmentModeName and environmentUnsetName are variables only these tests
// set, so the ambient environment cannot satisfy or contradict them.
const (
  environmentModeName  = "TTSC_TEST_TRACKED_ENV_MODE"
  environmentUnsetName = "TTSC_TEST_TRACKED_ENV_UNSET"
)

// environmentReadingPlugin lowers the source by the environment: its preamble
// names the value of every variable it reads through PluginContext.Env, the
// way a plugin elides code outside one mode. With overwrite set it changes the
// process environment after reading, so a later hook can show it still sees
// the generation's recorded value.
type environmentReadingPlugin struct {
  names     []string
  overwrite string
}

func (plugin environmentReadingPlugin) SourcePreamble(ctx driver.PluginContext) (string, error) {
  var preamble strings.Builder
  for _, name := range plugin.names {
    value, ok := ctx.Env(name)
    if !ok {
      value = "<unset>"
    }
    preamble.WriteString("// " + name + "=" + value + "\n")
  }
  if plugin.overwrite != "" {
    if err := os.Setenv(environmentModeName, plugin.overwrite); err != nil {
      return "", err
    }
  }
  return preamble.String(), nil
}

// TestUtilityTransformRecordsPluginEnvironmentReads verifies a linked plugin's
// environment reads reach the transform envelope as environmentInputs, and a
// plugin that reads none leaves the envelope without the field.
//
// A plugin whose output depends on a variable makes that variable an input of
// the generation, so persistent hosts must see the name and the value it read.
// The first read fixes the value for the whole generation, and an unset
// variable is recorded as null.
//
// 1. Set one variable and unset another; register a plugin that reads both
//    and then overwrites the first, and a second plugin that reads the first.
// 2. Assert the envelope records the set value and null, and the second hook's
//    output carries the recorded value rather than the overwritten one.
// 3. Run a plugin that reads nothing and assert the raw envelope has no
//    environmentInputs field.
//
// @evidence contracts/testing.md#behavioral-verification RunTransform runs real linked source-preamble hooks over a temporary project; the decoded envelope must carry {mode:"test", unset:null}, the printed source must show the recorded value from both hooks, and a non-reading plugin's raw JSON must not contain environmentInputs.
// @evidence contracts/testing.md#independent-expectations Expected names and values are the literals this test sets with t.Setenv; null for the unset variable and field omission follow the authored contract, not the implementation's output.
// @evidence contracts/testing.md#distinguishing-cases Set versus unset variable, a repeated read across two hooks after the process value changed, and a plugin that reads nothing. The verbose build line and observation sidecar belong to TestUtilityBuildVerboseNamesEnvironmentInputs.
// @evidence contracts/testing.md#execution-ownership TestUtilityTransformRecordsPluginEnvironmentReads is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityTransformRecordsPluginEnvironmentReads(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")
  t.Setenv(environmentModeName, "test")
  t.Setenv(environmentUnsetName, "")
  if err := os.Unsetenv(environmentUnsetName); err != nil {
    t.Fatal(err)
  }

  transform := func(plugins ...environmentReadingPlugin) string {
    t.Helper()
    resetLinkedPluginRegistry()
    t.Cleanup(resetLinkedPluginRegistry)
    entries := make([]string, len(plugins))
    for index, plugin := range plugins {
      driver.RegisterPlugin(plugin)
      entries[index] = `{"name":"env","stage":"transform","config":{}}`
    }
    code, out, errOut := captureUtilityOutput(t, func() int {
      return utility.RunTransform([]string{
        "--cwd", root,
        "--plugins-json", "[" + strings.Join(entries, ",") + "]",
      })
    })
    if code != 0 || errOut != "" {
      t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
    }
    return strings.TrimSpace(out)
  }

  reading := transform(
    environmentReadingPlugin{
      names:     []string{environmentModeName, environmentUnsetName},
      overwrite: "changed",
    },
    environmentReadingPlugin{names: []string{environmentModeName}},
  )
  var result struct {
    EnvironmentInputs map[string]*string `json:"environmentInputs"`
    TypeScript        map[string]string  `json:"typescript"`
  }
  if err := json.Unmarshal([]byte(reading), &result); err != nil {
    t.Fatal(err)
  }
  if len(result.EnvironmentInputs) != 2 {
    t.Fatalf("environment inputs mismatch: %s", reading)
  }
  if mode := result.EnvironmentInputs[environmentModeName]; mode == nil || *mode != "test" {
    t.Fatalf("recorded mode mismatch: %s", reading)
  }
  if unset, ok := result.EnvironmentInputs[environmentUnsetName]; !ok || unset != nil {
    t.Fatalf("an unset read must be recorded as null: %s", reading)
  }
  text := result.TypeScript["index.ts"]
  if strings.Count(text, "// "+environmentModeName+"=test\n") != 2 ||
    !strings.Contains(text, "// "+environmentUnsetName+"=<unset>\n") ||
    strings.Contains(text, "changed") {
    t.Fatalf("every hook must see the generation's recorded value:\n%s", text)
  }

  silent := transform(environmentReadingPlugin{})
  if strings.Contains(silent, "environmentInputs") {
    t.Fatalf("a plugin that reads no environment must not add the field: %s", silent)
  }
}
