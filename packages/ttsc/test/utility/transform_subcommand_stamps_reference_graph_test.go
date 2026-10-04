package ttsc_test

import (
  "encoding/json"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// utilityTransformGraph mirrors the graph section of the transform envelope.
type utilityTransformGraph struct {
  Edges   map[string][]string `json:"edges"`
  Globals []string            `json:"globals"`
  Configs []string            `json:"configs"`
}

// utilityTransformResultWithGraph decodes the envelope including the graph
// section stamped by the linked-plugin host.
type utilityTransformResultWithGraph struct {
  TypeScript map[string]string      `json:"typescript"`
  Graph      *utilityTransformGraph `json:"graph"`
}

// TestTransformSubcommandStampsReferenceGraph verifies the linked-plugin
// generic host's transform envelope carries the host-owned reference graph.
//
// Producing the `graph` section must not be
// per-plugin work — every plugin that routes its envelope through the driver
// SDK host captures it before transformation. This case does not run a
// persistent bundler cache. The section's source keys must match the typescript map's keys
// for implementation files. Ambient declarations remain graph inputs while
// SourceFiles intentionally omits them from the transformed TypeScript map.
//
//  1. Run the utility transform subcommand over a project with a type-only
//     import edge and an ambient declaration file.
//  2. Decode the stdout envelope.
//  3. Assert graph.edges carries the type-only edge, graph.globals the
//     ambient file, and graph.configs the tsconfig, all keyed like the
//     typescript map.
//
// @evidence contracts/testing.md#behavioral-verification The transform envelope's graph carries the type-only edge, ambient global and tsconfig. Implementation keys occur in the transformed map, while the resident declaration input occurs only in the graph.
// @evidence contracts/testing.md#independent-expectations The edges, globals and configs are the authored project's actual relationships written literally.
// @evidence contracts/testing.md#distinguishing-cases Type-only and ambient inputs distinguish the authored graph relationships from a runtime-import-only result; completeness for other language constructs is not certified.
// @evidence contracts/testing.md#execution-ownership TestTransformSubcommandStampsReferenceGraph is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestTransformSubcommandStampsReferenceGraph(t *testing.T) {
  resetLinkedPluginRegistry()
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
  "files": ["main.ts", "types.ts", "ambient.d.ts"]
}
`)
  writeProjectFile(t, root, "main.ts", `import type { Shape } from "./types";
export const shape: Shape = { id: 1 };
`)
  writeProjectFile(t, root, "types.ts", "export interface Shape { id: number }\n")
  writeProjectFile(t, root, "ambient.d.ts", "declare const AMBIENT: string;\n")

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{"--cwd", root})
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }

  var result utilityTransformResultWithGraph
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatalf("envelope is not valid JSON: %v\nstdout=%q", err, out)
  }
  if result.Graph == nil {
    t.Fatalf("envelope has no graph section: %q", out)
  }
  for _, key := range []string{"main.ts", "types.ts"} {
    if _, ok := result.TypeScript[key]; !ok {
      t.Fatalf("typescript map missing %s: %v", key, keysOf(result.TypeScript))
    }
  }
  if _, ok := result.TypeScript["ambient.d.ts"]; ok {
    t.Fatal("declaration source must not be published as transformed implementation")
  }
  if !slices.Contains(result.Graph.Edges["main.ts"], "types.ts") {
    t.Fatalf("graph edge main.ts -> types.ts missing: %v", result.Graph.Edges)
  }
  if !slices.Contains(result.Graph.Globals, "ambient.d.ts") {
    t.Fatalf("graph globals missing ambient.d.ts: %v", result.Graph.Globals)
  }
  if !slices.Contains(result.Graph.Configs, "tsconfig.json") {
    t.Fatalf("graph configs missing tsconfig.json: %v", result.Graph.Configs)
  }
}
