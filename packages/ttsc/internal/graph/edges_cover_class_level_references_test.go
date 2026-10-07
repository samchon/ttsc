package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEdgesCoverClassLevelReferences checks two type references on the authored
// Service declaration, together with its heritage and decorator facts:
//
//   - a heritage type argument `extends Base<Payload>` -> type-ref to Payload
//   - a type parameter constraint `<T extends Constraint>` -> type-ref to Constraint
//
// The authored decorator produces metadata without a Service-to-Injectable
// value-call edge. Other class-level syntax and runtime decorator effects are
// not exercised by this entry.
//
// 1. Load decorated Service with generic Constraint, Base heritage and Payload arguments.
// 2. Build its class-level type, heritage and decorator facts.
// 3. Require Payload and Constraint type references, Base heritage and Injectable metadata, without a spurious decorator factory value-call edge.
//
// @evidence contracts/testing.md#behavioral-verification Require Payload and Constraint type references, Base heritage and Injectable metadata, without a spurious decorator factory value-call edge.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over the Service class: type-ref edges to Payload (heritage type argument) and Constraint (type parameter constraint), a heritage edge to Base, a recorded Injectable decorator on Service, and no value-call edge from Service to Injectable. The checks are by presence or absence of edges and do not assert spans.
// @evidence contracts/testing.md#distinguishing-cases Load decorated Service with generic Constraint, Base heritage and Payload arguments. Build its class-level type, heritage and decorator facts. Require Payload and Constraint type references, Base heritage and Injectable metadata, without a spurious decorator factory value-call edge.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native experimental-decorator project, constructs/closes its driver Program in-process and directly calls Build. Actual Program filenames and the shared nodeID formatter select literal-name endpoints; they are not an independent ID-grammar oracle. A restored empty linked-plugin manifest excludes ambient hooks; no emitted decorator code, installed consumer or product process runs.
func TestEdgesCoverClassLevelReferences(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "experimentalDecorators": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function Injectable() {
  return function (_target: Function): void {};
}
export class Base<T> {
  value!: T;
}
export interface Payload {}
export interface Constraint {}

@Injectable()
export class Service<T extends Constraint> extends Base<Payload> {}
`)

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

  service := nodeID(path, "Service", NodeClass)
  injectable := nodeID(path, "Injectable", NodeFunction)
  base := nodeID(path, "Base", NodeClass)
  payload := nodeID(path, "Payload", NodeInterface)
  constraint := nodeID(path, "Constraint", NodeInterface)

  // The decorator factory call is a fact, not an edge: no value-call to
  // Injectable, but a recorded decorator on the Service node.
  if hasEdge(graph, service, injectable, EdgeValueCall) {
    t.Errorf("decorator factory call leaked a value-call edge Service -> Injectable")
  }
  if !hasDecorator(graph, service, "Injectable") {
    t.Errorf("missing decorator fact @Injectable on Service")
  }
  if !hasEdge(graph, service, payload, EdgeTypeRef) {
    t.Errorf("missing type-ref edge Service -> Payload (heritage type argument)")
  }
  if !hasEdge(graph, service, constraint, EdgeTypeRef) {
    t.Errorf("missing type-ref edge Service -> Constraint (type parameter constraint)")
  }
  // The base expression itself stays a heritage edge, unaffected by the
  // class-level type-argument walk.
  if !hasEdge(graph, service, base, EdgeHeritage) {
    t.Errorf("missing heritage edge Service -> Base")
  }
  if t.Failed() {
    t.Logf("edges: %v", graph.Edges)
  }
}
