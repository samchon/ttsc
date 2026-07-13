package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesDoNotDoubleRecordInvokedMemberAccess verifies a property
// access used as an invocation target remains only a value-call edge.
//
// Splitting value-call from value-access is useful only if method calls and
// tagged-template calls do not also look like plain property reads. Otherwise MCP
// flow ranking cannot tell invoked behavior from state/accessor evidence.
//
//  1. Compile method, constructor, and tagged-template calls whose callee/tag is
//     a property access expression.
//  2. Build the graph.
//  3. Assert each target has a value-call edge and no duplicate value-access
//     edge from the same caller.
func TestValueCallEdgesDoNotDoubleRecordInvokedMemberAccess(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), "export namespace Providers {\n"+
    "  export class Service {\n"+
    "    run(): void {}\n"+
    "  }\n"+
    "}\n"+
    "export namespace Tags {\n"+
    "  export function html(strings: TemplateStringsArray): string {\n"+
    "    return strings[0]\n"+
    "  }\n"+
    "}\n"+
    "export function handle(service: Providers.Service): string {\n"+
    "  service.run()\n"+
    "  new Providers.Service()\n"+
    "  return Tags.html`ok`\n"+
    "}\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  graph := Build(prog)
  path := sourceFile(t, prog, "main.ts").FileName()
  handle := nodeID(path, "handle", NodeFunction)
  run := nodeID(path, "Providers.Service.run", NodeMethod)
  service := nodeID(path, "Providers.Service", NodeClass)
  html := nodeID(path, "Tags.html", NodeFunction)

  for _, target := range []string{run, service, html} {
    if !hasEdge(graph, handle, target, EdgeValueCall) {
      t.Fatalf("missing value-call edge handle -> %s; edges: %v", target, graph.Edges)
    }
    if hasEdge(graph, handle, target, EdgeValueAccess) {
      t.Fatalf("invoked member access was also recorded as value-access handle -> %s; edges: %v", target, graph.Edges)
    }
  }
}
