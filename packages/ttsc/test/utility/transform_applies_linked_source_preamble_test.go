package ttsc_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type utilityPreamblePlugin struct{}

func (utilityPreamblePlugin) SourcePreamble(driver.PluginContext) (string, error) {
  return "// utility linked preamble\n", nil
}

// TestUtilityTransformAppliesLinkedSourcePreamble verifies linked
// source-preamble plugins affect rendered TypeScript during utility transform.
//
// The generic utility host is the fallback executable for linked transform
// packages. The transform subcommand must load the linked manifest and render
// the Program text only after source-preamble hooks have run; without this
// ordering the preamble would be absent from the JSON output seen by callers.
//
// 1. Register a linked source-preamble plugin.
// 2. Run utility transform with one linked plugin manifest entry.
// 3. Assert the JSON result contains the generated preamble text.
func TestUtilityTransformAppliesLinkedSourcePreamble(t *testing.T) {
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(utilityPreamblePlugin{})
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"pre","stage":"transform","config":{}}]`,
    })
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var result utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(result.TypeScript["index.ts"], "utility linked preamble") {
    t.Fatalf("preamble missing from transform output: %#v", result.TypeScript)
  }
}
