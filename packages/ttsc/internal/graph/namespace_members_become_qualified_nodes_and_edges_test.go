package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestNamespaceMembersBecomeQualifiedNodesAndEdges verifies that declarations
// inside a `namespace` are first-class graph nodes, keyed by their
// namespace-qualified name, and that edges cross the namespace boundary in both
// directions. A top-level-statements-only walk recorded none of this: every
// namespaced declaration and every edge touching one was silently dropped.
//
// The fixture exercises four relationships:
//
//   - intra-namespace call:        Service.run   -> Service.helper
//   - top-level into a namespace:  bootstrap     -> Service.run
//   - namespaced method type-ref:  Service.Worker.process -> Payload
//   - namespaced type referenced:  WorkerRef     -> Service.Worker
//
// 1. Load Service.helper, Service.run, Service.Worker and Service.Worker.process with Payload and WorkerRef.
// 2. Build namespace declarations, value calls and type references.
// 3. Require all four qualified nodes, run-to-helper and bootstrap-to-run calls, and process-to-Payload and WorkerRef-to-Worker type references.
//
// @evidence contracts/testing.md#behavioral-verification Require all four qualified nodes, run-to-helper and bootstrap-to-run calls, and process-to-Payload and WorkerRef-to-Worker type references.
// @evidence contracts/testing.md#independent-expectations The literal fixture and supported graph contract establish these expectations: Require all four qualified nodes, run-to-helper and bootstrap-to-run calls, and process-to-Payload and WorkerRef-to-Worker type references.
// @evidence contracts/testing.md#distinguishing-cases Load Service.helper, Service.run, Service.Worker and Service.Worker.process with Payload and WorkerRef. Build namespace declarations, value calls and type references. Require all four qualified nodes, run-to-helper and bootstrap-to-run calls, and process-to-Payload and WorkerRef-to-Worker type references.
// @evidence contracts/testing.md#execution-ownership TestNamespaceMembersBecomeQualifiedNodesAndEdges is a Go source-unit entry. Build, nodeID execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestNamespaceMembersBecomeQualifiedNodesAndEdges(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Payload {}

export namespace Service {
  export function helper(): void {}

  export function run(): void {
    helper();
  }

  export class Worker {
    process(p: Payload): void {
      void p;
    }
  }
}

export function bootstrap(): void {
  Service.run();
}

export type WorkerRef = Service.Worker;
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

  serviceHelper := nodeID(path, "Service.helper", NodeFunction)
  serviceRun := nodeID(path, "Service.run", NodeFunction)
  serviceWorker := nodeID(path, "Service.Worker", NodeClass)
  workerProcess := nodeID(path, "Service.Worker.process", NodeMethod)
  bootstrap := nodeID(path, "bootstrap", NodeFunction)
  workerRef := nodeID(path, "WorkerRef", NodeTypeAlias)
  payload := nodeID(path, "Payload", NodeInterface)

  // The namespaced declarations are nodes in their own right.
  for _, id := range []string{serviceHelper, serviceRun, serviceWorker, workerProcess} {
    if _, ok := graph.Nodes[id]; !ok {
      t.Errorf("missing namespaced node %q", id)
    }
  }

  if !hasEdge(graph, serviceRun, serviceHelper, EdgeValueCall) {
    t.Errorf("missing value-call edge Service.run -> Service.helper (intra-namespace)")
  }
  if !hasEdge(graph, bootstrap, serviceRun, EdgeValueCall) {
    t.Errorf("missing value-call edge bootstrap -> Service.run (top-level into namespace)")
  }
  if !hasEdge(graph, workerProcess, payload, EdgeTypeRef) {
    t.Errorf("missing type-ref edge Service.Worker.process -> Payload (namespaced method)")
  }
  if !hasEdge(graph, workerRef, serviceWorker, EdgeTypeRef) {
    t.Errorf("missing type-ref edge WorkerRef -> Service.Worker (namespaced type referenced)")
  }
  if t.Failed() {
    t.Logf("nodes: %d, edges: %v", len(graph.Nodes), graph.Edges)
  }
}
