package ttsc_test

import (
  "bytes"
  "encoding/json"
  "fmt"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type failureHostInputPlugin struct{ input string }

func (plugin failureHostInputPlugin) ApplyProgram(_ *driver.Program, ctx driver.PluginContext) error {
  ctx.ReportHostInputHash(plugin.input, stringPointer(strings.Repeat("a", 64)))
  return fmt.Errorf("plugin rejected its input")
}

// TestTransformPluginFailureRetainsRecoveryInputs verifies an apply failure
// preserves the original graph and the input evaluated by the failing plugin.
//
// A partially mutated Program must not publish source output, but discarding its
// already captured graph and host-input paths also discards its recovery channel.
//
// 1. Run a linked plugin that reports its input and fails while applying.
// 2. Decode the failed transform envelope and require its diagnostic.
// 3. Require graph and host-input ownership with no successful source output.
func TestTransformPluginFailureRetainsRecoveryInputs(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
  root := t.TempDir()
  input := filepath.Join(root, "plugin.config.json")
  driver.RegisterPlugin(failureHostInputPlugin{input: input})
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020"},"files":["main.ts"]}`)
  writeProjectFile(t, root, "main.ts", "export const value = 1;\n")
  var stdout, stderr bytes.Buffer
  code := utility.RunTransformWithIO([]string{"--cwd", root, "--plugins-json", `[{"name":"failure","stage":"transform","config":{}}]`}, &stdout, &stderr)
  var result struct {
    TypeScript  map[string]string `json:"typescript"`
    Diagnostics []struct {
      MessageText string `json:"messageText"`
    } `json:"diagnostics"`
    Graph      *driver.TransformGraph `json:"graph"`
    HostInputs []string               `json:"hostInputs"`
  }
  if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
    t.Fatalf("plugin failure must be a JSON envelope: %v; stdout=%s stderr=%s", err, &stdout, &stderr)
  }
  if code != 2 || len(result.TypeScript) != 0 || len(result.Diagnostics) != 1 || !strings.Contains(result.Diagnostics[0].MessageText, "plugin rejected its input") {
    t.Fatalf("invalid plugin failure: code=%d result=%+v", code, result)
  }
  if result.Graph == nil || !slices.Contains(result.Graph.Configs, "tsconfig.json") || !slices.Contains(result.HostInputs, input) {
    t.Fatalf("plugin failure dropped recovery metadata: %+v", result)
  }
}
