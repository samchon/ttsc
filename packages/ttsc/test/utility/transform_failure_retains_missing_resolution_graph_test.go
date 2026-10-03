package ttsc_test

import (
  "bytes"
  "encoding/json"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type failureGraphMutationProbe struct{ calls *int }

func (plugin failureGraphMutationProbe) ApplyProgram(*driver.Program, driver.PluginContext) error {
  *plugin.calls++
  return nil
}

// TestTransformFailureRetainsMissingResolutionGraph verifies invalid Programs
// publish their missing dependency observations without running source mutations.
//
// A diagnostic names the importer, not the unresolved declaration. Watch hosts
// need the original Program's graph to observe a dependency-only repair.
//
// 1. Transform an unresolved type-only package import through the utility host.
// 2. Require structured diagnostics, its missing candidate, and no source output.
// 3. Restore only the declaration and verify the next transform runs the plugin.
//
// @evidence contracts/testing.md#behavioral-verification RunTransformWithIO over an unresolved type-only import returns structured diagnostics, the missing candidate in the graph and no source output, and after only the declaration is restored the next transform runs the plugin.
// @evidence contracts/testing.md#independent-expectations The diagnostics, the missing candidate and the plugin call count are literal expectations.
// @evidence contracts/testing.md#distinguishing-cases The invalid program (no plugin call, graph kept) contrasts with the repaired program (plugin called once).
// @evidence contracts/testing.md#execution-ownership TestTransformFailureRetainsMissingResolutionGraph is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestTransformFailureRetainsMissingResolutionGraph(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
  calls := 0
  driver.RegisterPlugin(failureGraphMutationProbe{calls: &calls})
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","strict":true},"files":["main.ts"]}`)
  writeProjectFile(t, root, "main.ts", "import type { Shape } from 'typed-dep';\nexport const value: Shape = { id: 1 };\n")
  writeProjectFile(t, root, "node_modules/typed-dep/package.json", `{"types":"missing.d.ts"}`)
  args := []string{"--cwd", root, "--plugins-json", `[{"name":"probe","stage":"transform","config":{}}]`}
  var stdout, stderr bytes.Buffer
  code := utility.RunTransformWithIO(args, &stdout, &stderr)
  var result struct {
    TypeScript  map[string]string `json:"typescript"`
    Diagnostics []struct {
      Category string  `json:"category"`
      Code     int     `json:"code"`
      File     *string `json:"file"`
    } `json:"diagnostics"`
    Graph *driver.TransformGraph `json:"graph"`
  }
  if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
    t.Fatalf("failure must be a JSON envelope: %v; stdout=%s stderr=%s", err, &stdout, &stderr)
  }
  if code != 2 || len(result.TypeScript) != 0 || calls != 0 {
    t.Fatalf("failure ran a mutation or published output: code=%d calls=%d result=%+v", code, calls, result)
  }
  if len(result.Diagnostics) != 1 || result.Diagnostics[0].Code != 2307 || result.Diagnostics[0].Category != "error" || result.Diagnostics[0].File == nil {
    t.Fatalf("missing structured compiler diagnostic: %+v", result.Diagnostics)
  }
  if result.Graph == nil || !slices.Contains(result.Graph.Candidates["main.ts"], "node_modules/typed-dep/missing.d.ts") || !slices.Contains(result.Graph.Configs, "tsconfig.json") {
    t.Fatalf("failure dropped resolution or config ownership: %+v", result.Graph)
  }
  writeProjectFile(t, root, "node_modules/typed-dep/missing.d.ts", "export interface Shape { id: number }\n")
  stdout.Reset()
  stderr.Reset()
  code = utility.RunTransformWithIO(args, &stdout, &stderr)
  if code != 0 || calls != 1 || !strings.Contains(stdout.String(), `"main.ts"`) || stderr.Len() != 0 {
    t.Fatalf("dependency-only repair did not recover: code=%d calls=%d stdout=%s stderr=%s", code, calls, &stdout, &stderr)
  }
}
