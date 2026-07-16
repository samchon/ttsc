package ttsc_test

import (
  "encoding/json"
  "slices"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// specifierRewritePlugin mutates every string literal equal to `from` into
// `to` across the program, mirroring how @ttsc/paths rewrites import
// specifiers in place.
type specifierRewritePlugin struct {
  from string
  to   string
}

func (p specifierRewritePlugin) ApplyProgram(prog *driver.Program, _ driver.PluginContext) error {
  for _, sf := range prog.SourceFiles() {
    rewriteSpecifierLiterals(sf.AsNode(), p.from, p.to)
  }
  return nil
}

func rewriteSpecifierLiterals(node *shimast.Node, from, to string) {
  if node == nil {
    return
  }
  if node.Kind == shimast.KindStringLiteral && node.Text() == from {
    node.AsStringLiteral().Text = to
    node.Flags |= shimast.NodeFlagsSynthesized
    node.Loc = shimcore.UndefinedTextRange()
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    rewriteSpecifierLiterals(child, from, to)
    return false
  })
}

// TestTransformGraphReflectsSourceBeforePluginMutation verifies the stamped
// reference graph describes the original source's resolved references even
// when a linked plugin mutates import specifiers in place.
//
// Linked ProgramPlugin hooks (e.g. @ttsc/paths) rewrite the very string
// literals the graph's edge resolution reads through the checker. If the host
// computed the graph after ApplyLinkedPlugins, a rewritten specifier would
// resolve to nothing and the edge would silently vanish — exactly the class
// of missing invalidation edge samchon/ttsc#716 exists to close. The graph is
// therefore computed before plugin hooks run: edges are transform inputs, the
// mutated text is transform output.
//
//  1. Register a linked plugin that rewrites the "./types" import specifier.
//  2. Run the utility transform subcommand.
//  3. Assert the printed output carries the rewritten specifier while the
//     graph still edges main.ts -> types.ts.
func TestTransformGraphReflectsSourceBeforePluginMutation(t *testing.T) {
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(specifierRewritePlugin{from: "./types", to: "./rewritten"})
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
  "files": ["main.ts", "types.ts"]
}
`)
  writeProjectFile(t, root, "main.ts", `import type { Shape } from "./types";
export const shape: Shape = { id: 1 };
`)
  writeProjectFile(t, root, "types.ts", "export interface Shape { id: number }\n")

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"rewrite","stage":"transform","config":{}}]`,
    })
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }

  var result utilityTransformResultWithGraph
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatalf("envelope is not valid JSON: %v\nstdout=%q", err, out)
  }
  if !strings.Contains(result.TypeScript["main.ts"], "./rewritten") {
    t.Fatalf("linked plugin mutation missing from printed output: %q", result.TypeScript["main.ts"])
  }
  if result.Graph == nil {
    t.Fatalf("envelope has no graph section: %q", out)
  }
  if !slices.Contains(result.Graph.Edges["main.ts"], "types.ts") {
    t.Fatalf("graph must keep the pre-mutation edge main.ts -> types.ts: %v", result.Graph.Edges)
  }
}
