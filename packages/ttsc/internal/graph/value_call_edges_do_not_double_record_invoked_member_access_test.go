package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesDoNotDoubleRecordInvokedMemberAccess verifies a property
// access used as an invocation target remains only a value-call edge.
//
// Three authored dotted property targets cover method call, construction, and
// tagged template. Each has a positive value-call and negative value-access
// triple. This is not an exact edge-count, invocation-origin, bracket-access,
// runtime-effect, or MCP-ranking oracle.
//
//  1. Compile method, constructor, and tagged-template calls whose callee/tag is
//     a property access expression.
//  2. Build the graph.
//  3. Assert each target has a value-call edge and no duplicate value-access
//     edge from the same caller.
//
// @evidence contracts/testing.md#behavioral-verification Verifies a property access used as an invocation target remains only a value-call edge.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over service.run(), new Providers.Service() and Tags.html tagged template inside handle: for each of Providers.Service.run, Providers.Service and Tags.html there must be a value-call edge from handle and no value-access edge from handle to the same target.
// @evidence contracts/testing.md#distinguishing-cases Compile method, constructor, and tagged-template calls whose callee/tag is a property access expression; Build the graph; Assert each target has a value-call edge and no duplicate value-access edge from the same caller.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and three literal positive/negative pairs run in this process using its actual filename and shared nodeID encoder. No independent identity oracle, product CLI, installation, emitted invocation, or MCP-ranking consumer runs.
func TestValueCallEdgesDoNotDoubleRecordInvokedMemberAccess(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  handle := nodeID(path.AsString(), "handle", NodeFunction)
  run := nodeID(path.AsString(), "Providers.Service.run", NodeMethod)
  service := nodeID(path.AsString(), "Providers.Service", NodeClass)
  html := nodeID(path.AsString(), "Tags.html", NodeFunction)

  for _, target := range []string{run, service, html} {
    if !hasEdge(graph, handle, target, EdgeValueCall) {
      t.Fatalf("missing value-call edge handle -> %s; edges: %v", target, graph.Edges)
    }
    if hasEdge(graph, handle, target, EdgeValueAccess) {
      t.Fatalf("invoked member access was also recorded as value-access handle -> %s; edges: %v", target, graph.Edges)
    }
  }
}
