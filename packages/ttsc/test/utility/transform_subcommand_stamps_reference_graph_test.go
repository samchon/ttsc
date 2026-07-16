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
// Implements samchon/ttsc#716: producing the `graph` section must not be
// per-plugin work — every plugin that routes its envelope through the driver
// SDK host emits it automatically, so the stale-bundler-cache bug class is
// closed by default. The section's keys must match the typescript map's keys
// so consumers can join the sections.
//
//  1. Run the utility transform subcommand over a project with a type-only
//     import edge and an ambient declaration file.
//  2. Decode the stdout envelope.
//  3. Assert graph.edges carries the type-only edge, graph.globals the
//     ambient file, and graph.configs the tsconfig, all keyed like the
//     typescript map.
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
  if _, ok := result.TypeScript["main.ts"]; !ok {
    t.Fatalf("typescript map missing main.ts: %v", keysOf(result.TypeScript))
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
