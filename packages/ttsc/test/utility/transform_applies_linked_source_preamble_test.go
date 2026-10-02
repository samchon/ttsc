package ttsc_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type utilityPreamblePlugin struct {
  input string
}

func (plugin utilityPreamblePlugin) SourcePreamble(ctx driver.PluginContext) (string, error) {
  const digest = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  ctx.ReportHostInputHash(plugin.input, stringPointer(digest))
  ctx.ReportHostInputRealpath(plugin.input, nil)
  return "// utility linked preamble\n", nil
}

func stringPointer(value string) *string {
  return &value
}

// TestUtilityTransformAppliesLinkedSourcePreamble verifies linked
// source-preamble plugins affect rendered TypeScript during utility transform.
//
// The generic utility host is the fallback executable for linked transform
// packages. The transform subcommand must load the linked manifest and render
// the Program text only after source-preamble hooks have run; without this
// ordering the preamble would be absent from the JSON output seen by callers.
//
// 1. Register a linked source-preamble plugin that reports one config input.
// 2. Run utility transform with one linked plugin manifest entry.
// 3. Assert the JSON result contains the preamble and exact reported input.
//
// @evidence contracts/testing.md#behavioral-verification RunTransform with a linked source-preamble plugin returns JSON whose TypeScript text carries the preamble and whose host inputs include the exact input the plugin reported.
// @evidence contracts/testing.md#independent-expectations The preamble text and input path are literals supplied by the test plugin.
// @evidence contracts/testing.md#distinguishing-cases The preamble must appear only after hooks run; absence from the JSON output is the failure the assertion detects.
// @evidence contracts/testing.md#execution-ownership TestUtilityTransformAppliesLinkedSourcePreamble is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityTransformAppliesLinkedSourcePreamble(t *testing.T) {
  resetLinkedPluginRegistry()
  root := t.TempDir()
  input := filepath.Join(root, "banner.config.cjs")
  driver.RegisterPlugin(utilityPreamblePlugin{input: input})
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
  if len(result.HostInputs) != 1 || result.HostInputs[0] != input {
    t.Fatalf("host inputs mismatch: %#v", result.HostInputs)
  }
  if digest := result.HostInputHashes[input]; digest == nil || *digest != "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" {
    t.Fatalf("host input hashes mismatch: %#v", result.HostInputHashes)
  }
  if realpath, ok := result.HostInputRealpaths[input]; !ok || realpath != nil {
    t.Fatalf("host input realpaths mismatch: %#v", result.HostInputRealpaths)
  }
}
