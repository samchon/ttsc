package graph

import (
  "path/filepath"
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

  released := map[string]bool{
    "docTagPositions":   g.docTagPositions == nil,
    "docHosts":          g.docHosts == nil,
    "docHostPositions":  g.docHostPositions == nil,
    "bodyNodes":         g.bodyNodes == nil,
    "seen":              g.seen == nil,
    "resolved":          g.resolved == nil,
    "edgeEvidenceFiles": g.edgeEvidenceFiles == nil,
    "baseNodes":         g.baseNodes == nil,
    "selectedFiles":     g.selectedFiles == nil,
  }
  for field, ok := range released {
    if !ok {
      t.Errorf("%s survived the build; it pins the AST for as long as a consumer holds the graph", field)
    }
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
