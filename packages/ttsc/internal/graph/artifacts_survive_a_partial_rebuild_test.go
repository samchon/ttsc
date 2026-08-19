package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestArtifactsSurviveAPartialRebuild verifies that a citation of an artifact is
// still a relation after the incremental path rebuilds the file that wrote it.
//
// A partial build re-resolves the outgoing facts of the files it selected, and a
// citation is one of them. The full snapshot applied the published artifacts and
// the incremental one did not, so editing a declaration that cites a document
// section rebuilt it with that edge missing — the client's graph silently lost a
// relation it had a moment earlier, and only a full reload brought it back.
//
// The nodes are re-added rather than assumed present because a partial starts
// with only its selected files' nodes. They are the same nodes under the same
// ids, which is why the store can replace like with like.
//
//  1. Build the complete graph with artifacts applied, and confirm the edge.
//  2. Rebuild only the citing file, as the shard path does.
//  3. Assert the edge is there again, and that the artifact came with it.
func TestArtifactsSurviveAPartialRebuild(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/main.ts"]
}
`)
  source := filepath.Join(root, "src", "main.ts")
  writeFile(t, source, `/** @evidence docs/sale.md#pricing States the rule. */
export function priced(): void {}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil || prog == nil {
    t.Fatalf("could not load the probe project: %v", err)
  }
  defer func() { _ = prog.Close() }()

  published := []Artifact{
    {
      Address:  "docs/sale.md#pricing",
      Kind:     "markdown_section",
      Readable: "Pricing",
      File:     "docs/sale.md",
      Line:     7,
    },
  }

  complete := Build(prog)
  ApplyArtifacts(complete, published)
  if !citesArtifact(complete) {
    t.Fatal("the complete build did not resolve the citation")
  }

  var selected string
  for _, node := range complete.Nodes {
    if node.File != "" && node.Kind == NodeFunction {
      selected = node.File
      break
    }
  }
  if selected == "" {
    t.Fatal("the probe project produced no declaration to reselect")
  }

  partial := BuildFiles(prog, []string{selected}, complete.Nodes)
  ApplyArtifacts(partial, published)
  if !citesArtifact(partial) {
    t.Fatal("the partial rebuild dropped the citation edge the full build had")
  }
  if _, published := partial.Nodes["docs/sale.md#pricing"]; !published {
    t.Fatal("the partial rebuild resolved an edge to a node it did not carry")
  }
}

// citesArtifact reports whether any doc-ref edge lands on the probe's artifact.
func citesArtifact(g *Graph) bool {
  for _, edge := range g.Edges {
    if edge.Kind == EdgeDocRef && edge.To == "docs/sale.md#pricing" {
      return true
    }
  }
  return false
}
