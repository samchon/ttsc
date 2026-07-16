package ttsc_test

import (
  "encoding/json"
  "slices"
  "strings"
  "testing"
)

// apiTransformGraph mirrors the graph section of the api-transform envelope.
type apiTransformGraph struct {
  Edges   map[string][]string `json:"edges"`
  Globals []string            `json:"globals"`
  Configs []string            `json:"configs"`
}

// apiTransformResultWithGraph decodes the api-transform envelope including
// the graph section.
type apiTransformResultWithGraph struct {
  TypeScript map[string]string  `json:"typescript"`
  Graph      *apiTransformGraph `json:"graph"`
}

// TestAPITransformEnvelopeCarriesReferenceGraph verifies the no-plugin native
// host path (`cmd/ttsc api-transform`) stamps the host-owned reference graph
// into its JSON envelope.
//
// Acceptance for samchon/ttsc#716: the envelope's graph must include
// type-only import edges, ambient declaration files under globals, and the
// tsconfig `extends` chain under configs — the `tsc --incremental` input
// bound that bundler adapters register as watch files so persistent caches
// invalidate soundly by default.
//
//  1. Run `ttsc api-transform` over a project with a type-only import, an
//     ambient declaration file, and an extended tsconfig.
//  2. Decode the stdout envelope.
//  3. Assert the graph section carries the edge, the global, and the full
//     config chain.
func TestAPITransformEnvelopeCarriesReferenceGraph(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.base.json", `{
  "compilerOptions": { "strict": true }
}
`)
  writeProjectFile(t, root, "tsconfig.json", `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["main.ts", "mytype.ts", "ambient.d.ts"]
}
`)
  writeProjectFile(t, root, "main.ts", `import type { MyType } from "./mytype";
export const value: MyType = { id: "x" };
`)
  writeProjectFile(t, root, "mytype.ts", "export interface MyType { id: string }\n")
  writeProjectFile(t, root, "ambient.d.ts", "declare const AMBIENT: number;\n")

  code, out, errOut := runNativeCommand(t, "api-transform", "--cwd", root)
  if code != 0 {
    t.Fatalf("api-transform failed: code=%d stderr=%q", code, errOut)
  }

  var result apiTransformResultWithGraph
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatalf("envelope is not valid JSON: %v\nstdout=%q", err, out)
  }
  if result.Graph == nil {
    t.Fatalf("envelope has no graph section: %q", out)
  }
  if !slices.Contains(result.Graph.Edges["main.ts"], "mytype.ts") {
    t.Fatalf("type-only edge main.ts -> mytype.ts missing: %v", result.Graph.Edges)
  }
  if !slices.Contains(result.Graph.Globals, "ambient.d.ts") {
    t.Fatalf("globals missing ambient.d.ts: %v", result.Graph.Globals)
  }
  if len(result.Graph.Configs) < 2 || result.Graph.Configs[0] != "tsconfig.json" {
    t.Fatalf("configs must start with tsconfig.json and include its extends chain: %v", result.Graph.Configs)
  }
  if !slices.ContainsFunc(result.Graph.Configs, func(config string) bool {
    return strings.HasSuffix(config, "tsconfig.base.json")
  }) {
    t.Fatalf("configs missing extended tsconfig.base.json: %v", result.Graph.Configs)
  }
}
