package ttsc_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type conflictingHostInputPlugin struct {
  input string
}

func (plugin conflictingHostInputPlugin) SourcePreamble(ctx driver.PluginContext) (string, error) {
  ctx.ReportHostInputHash(plugin.input, stringPointer(strings.Repeat("a", 64)))
  ctx.ReportHostInputHash(plugin.input, stringPointer(strings.Repeat("b", 64)))
  ctx.ReportHostInputRealpath(plugin.input, stringPointer(filepath.Join(filepath.Dir(plugin.input), "old")))
  ctx.ReportHostInputRealpath(plugin.input, stringPointer(filepath.Join(filepath.Dir(plugin.input), "new")))
  return "", nil
}

// TestUtilityTransformOmitsConflictingLinkedHostInputHashes verifies contradictory
// linked-plugin reports are omitted from the transform envelope. The plugin
// supplies reports; this test does not execute a native config race or cache reuse.
//
// Native config evaluation can race an editor write. The path must remain in
// hostInputs for invalidation, while its contradictory hashes must be omitted
// so a persistent adapter falls back to conservative validation.
//
//  1. Register a linked plugin that reports two hashes for one config path.
//  2. Run the real utility transform entrypoint.
//  3. Assert the path is retained and no stable hash is published for it.
//
// @evidence contracts/testing.md#behavioral-verification A plugin that reports two hashes for one input keeps the path in hostInputs but the envelope publishes no hash for it.
// @evidence contracts/testing.md#independent-expectations The path and the absence of a stable hash are literal expectations from the reporting contract.
// @evidence contracts/testing.md#distinguishing-cases Two contradictory hashes contrast with a single stable hash that would be published.
// @evidence contracts/testing.md#execution-ownership TestUtilityTransformOmitsConflictingLinkedHostInputHashes is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityTransformOmitsConflictingLinkedHostInputHashes(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
  root := t.TempDir()
  input := filepath.Join(root, "strip.config.cjs")
  driver.RegisterPlugin(conflictingHostInputPlugin{input: input})
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"conflict","stage":"transform","config":{}}]`,
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
    t.Fatalf("conflicting hash must be omitted: %#v", result.HostInputHashes)
  }
  if _, ok := result.HostInputRealpaths[input]; ok {
    t.Fatalf("conflicting realpath must be omitted: %#v", result.HostInputRealpaths)
  }
}
