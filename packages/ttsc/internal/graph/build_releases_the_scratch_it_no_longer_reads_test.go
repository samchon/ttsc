package graph

import (
  "path/filepath"
  "reflect"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestBuildReleasesTheScratchItNoLongerReads verifies that a returned Graph
// carries only what a consumer reads, and still carries what the shard path
// reads after the call.
//
// Every field asserted nil below is documented build-only and holds pointers
// into the compiler AST or into the preceding generation's nodes. They used to
// survive the build, so a consumer retaining the Graph pinned all of it —
// internal/graphsymbols keeps one for the lifetime of an editor session between
// invalidations, closing the Program while the maps referencing its AST live on.
// Measured on this repository's own packages, holding the Graph after closing
// the Program retained 38.1 MB for @ttsc/lint, 52.5 MB for ttsc, and 58.2 MB for
// @ttsc/graph; releasing the scratch brings those to 3.7, 5.0, and 4.0 MB.
//
// The assertion is structural rather than a heap measurement on purpose: a
// megabyte threshold is a flaky test, while "the producer stopped holding it" is
// the invariant and is exact.
//
//  1. Build the complete graph for a one-file project.
//  2. Assert every build-only field is released.
//  3. Assert the two fields the shard expansion reads after the call, and the
//     graph itself, are not.
func TestBuildReleasesTheScratchItNoLongerReads(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `/** @evidence docs/a.md#x Cited. */
export interface ISale { id: string }
export class Store implements ISale {
  public id: string = "";
  public save(): void { this.load() }
  public load(): void {}
}
export function run(store: Store): void { store.save() }
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil || prog == nil {
    t.Fatalf("could not load the probe project: %v", err)
  }
  defer func() { _ = prog.Close() }()

  g := Build(prog)
  assertScratchReleased(t, g, "complete build")

  // The partial build is not a second case of the same thing: `baseNodes` and
  // `selectedFiles` are nil on arrival in a complete build, so a complete build
  // alone cannot fail on them. `baseNodes` is the largest of the nine and the
  // one #1243 flagged as the caution, because it is passed in rather than built.
  var mainFile string
  for _, node := range g.Nodes {
    mainFile = node.File
    break
  }
  if mainFile == "" {
    t.Fatal("the probe project produced no node to select a file from")
  }
  partial := BuildFiles(prog, []string{mainFile}, g.Nodes)
  assertScratchReleased(t, partial, "partial build")

  // The negative twin. Clearing scratch must not clear what the shard expansion
  // in cmd/ttscgraph/serve_shards.go reads after BuildFiles returns.
  if g.ExportedTargets == nil {
    t.Error("ExportedTargets was released, but the shard path reads it after the build")
  }
  if g.ImplementationSources == nil {
    t.Error("ImplementationSources was released, but the shard path reads it after the build")
  }
  if len(g.Nodes) == 0 || len(g.Edges) == 0 || len(g.DocTags) == 0 {
    t.Fatalf("the graph itself is empty: %d nodes, %d edges, %d tags",
      len(g.Nodes), len(g.Edges), len(g.DocTags))
  }
}

// assertScratchReleased requires every unexported reference field of a returned
// Graph to be nil.
//
// It reflects rather than naming the fields, because a hand-written list has to
// be edited by the same person who forgets to edit releaseBuildState — which is
// exactly how docHosts arrived beside resolved. Unexported fields are readable
// this way: reflect.Value.IsNil needs no exported access, only Interface does.
//
// Exported fields are skipped: Nodes, Edges, Decorators, and DocTags are the
// graph, and ExportedTargets and ImplementationSources are read after the build.
func assertScratchReleased(t *testing.T, g *Graph, label string) {
  t.Helper()
  value := reflect.ValueOf(g).Elem()
  for index := 0; index < value.NumField(); index++ {
    field := value.Type().Field(index)
    if field.IsExported() {
      continue
    }
    switch value.Field(index).Kind() {
    case reflect.Map, reflect.Slice, reflect.Ptr:
    default:
      continue
    }
    if !value.Field(index).IsNil() {
      t.Errorf(
        "%s: %s survived; it pins the AST for as long as a consumer holds the graph",
        label,
        field.Name,
      )
    }
  }
}
