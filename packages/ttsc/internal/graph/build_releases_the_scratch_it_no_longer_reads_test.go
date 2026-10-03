package graph

import (
  "path/filepath"
  "reflect"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestBuildReleasesTheScratchItNoLongerReads verifies that a returned Graph
// releases its unexported reference fields after full and partial construction,
// while retaining the asserted public graph collections and expansion maps.
//
// Build-only reference fields can retain AST pointers, borrowed endpoint nodes,
// or text/index scratch. Reflection checks that this returned Graph no longer
// holds those field references; it does not measure collection, other owners,
// editor lifetimes, or retained public graph content.
//
// The assertion is structural rather than a heap measurement on purpose: a
// megabyte threshold is a flaky test, while "the producer stopped holding it" is
// the invariant and is exact.
//
//  1. Build the complete graph for a one-file project.
//  2. Assert every build-only field is released.
//  3. Assert the two fields the shard expansion reads after the call, and the
//     graph itself, are not.
//
// @evidence contracts/testing.md#behavioral-verification Full Build and selected-file BuildFiles return graphs with every unexported map, slice or pointer field nil, while the asserted public graph collections and expansion maps remain populated or allocated.
// @evidence contracts/testing.md#independent-expectations The expectation is structural and exact rather than a heap measurement: found by reflection, every unexported map, slice or pointer field of the returned Graph must be nil after both a complete Build and a partial BuildFiles, ExportedTargets and ImplementationSources must remain non-nil, and Nodes, Edges and DocTags must be non-empty. The test cannot tell whether a released field was truly unreferenced elsewhere.
// @evidence contracts/testing.md#distinguishing-cases Full and partial construction contrast, with the partial call borrowing a non-nil base index. Both must release private reference fields and retain public output; empty private fields alone cannot let an empty partial result pass.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its native temporary project, constructs and closes a driver compiler Program in-process, and directly calls Build and BuildFiles. A restored empty linked-plugin manifest excludes ambient hooks; no installed consumer, native product command, heap measurement, or forced garbage collection is used.
func TestBuildReleasesTheScratchItNoLongerReads(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

  // The partial call borrows a non-nil baseNodes index, unlike the full call.
  // Both calls also allocate their own selected-file map.
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
  if partial.ExportedTargets == nil || partial.ImplementationSources == nil {
    t.Error("partial build released its public expansion maps")
  }
  if len(partial.Nodes) == 0 || len(partial.Edges) == 0 || len(partial.DocTags) == 0 {
    t.Fatalf("partial graph is empty: %d nodes, %d edges, %d tags",
      len(partial.Nodes), len(partial.Edges), len(partial.DocTags))
  }

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
        "%s: %s survived as a private reference field in the returned graph",
        label,
        field.Name,
      )
    }
  }
}
