package ttsc_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type scopedHostInputPlugin struct {
  hash  bool
  input string
}

func (plugin scopedHostInputPlugin) SourcePreamble(ctx driver.PluginContext) (string, error) {
  if plugin.hash {
    ctx.ReportHostInputHash(plugin.input, stringPointer(strings.Repeat("a", 64)))
    ctx.ReportHostInputRealpath(
      plugin.input,
      stringPointer(filepath.Join(filepath.Dir(plugin.input), "physical")),
    )
  } else {
    ctx.ReportHostInput(plugin.input)
  }
  return "", nil
}

// TestUtilityTransformOmitsCrossPluginHostInputHash verifies one plugin's
// fingerprint and physical identity cannot prove another plugin's unproven
// dependency.
//
// The transform envelope describes the combined result of every linked hook.
// If any hook lists a path without an exact observation, persistent adapters
// must see the path but no proof, even when another hook hashes the same file.
//
// @evidence contracts/testing.md#behavioral-verification One plugin's hash and identity for a path are not published when another plugin lists the same path without an exact observation.
// @evidence contracts/testing.md#independent-expectations The expected presence of the path and absence of proof are literal.
// @evidence contracts/testing.md#distinguishing-cases The hashed plugin and the unproven plugin report the same file, which is the case where a merged map could wrongly certify it.
// @evidence contracts/testing.md#execution-ownership TestUtilityTransformOmitsCrossPluginHostInputHash is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityTransformOmitsCrossPluginHostInputHash(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
  root := t.TempDir()
  input := filepath.Join(root, "shared.config.cjs")
  driver.RegisterPlugin(scopedHostInputPlugin{input: input})
  driver.RegisterPlugin(scopedHostInputPlugin{hash: true, input: input})
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"unproven","stage":"transform","config":{}},{"name":"proven","stage":"transform","config":{}}]`,
    })
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var result utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatal(err)
  }
  if len(result.HostInputs) != 1 || result.HostInputs[0] != input {
    t.Fatalf("host inputs mismatch: %#v", result.HostInputs)
  }
  if _, ok := result.HostInputHashes[input]; ok {
    t.Fatalf("another plugin's hash must not revive missing proof: %#v", result.HostInputHashes)
  }
  if _, ok := result.HostInputRealpaths[input]; ok {
    t.Fatalf("another plugin's realpath must not revive missing proof: %#v", result.HostInputRealpaths)
  }
}
