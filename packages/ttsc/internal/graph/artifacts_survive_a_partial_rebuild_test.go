package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestArtifactsSurviveAPartialRebuild verifies that a citation of an artifact is
// still a relation after a selected-file BuildFiles call followed by explicit
// ApplyArtifacts. Both builds use the same unchanged compiler Program; this
// tests the publication steps directly, not an edit, shard coordinator, or
// client/store replacement.
//
//  1. Build the complete graph with artifacts applied, and confirm the edge.
//  2. Rebuild only the selected citing file using the same unchanged Program.
//  3. Assert the edge is there again, and that the artifact came with it.
//
// @evidence contracts/testing.md#behavioral-verification Full Build and selected-file BuildFiles, each followed by ApplyArtifacts, expose a doc-ref to the literal artifact address; the partial result contains that artifact node.
// @evidence contracts/testing.md#independent-expectations The expectation is the same literal fixture built two ways: the doc-ref edge to docs/sale.md#pricing must exist after the complete build with artifacts applied, and again after BuildFiles over only the citing file followed by ApplyArtifacts, and the partial graph must hold the artifact node. The complete build is the baseline, so only the selected file path is taken from the code under test.
// @evidence contracts/testing.md#distinguishing-cases Full versus selected-file construction contrasts while the authored Program and artifact remain unchanged. The literal edge is required in both, and node membership is separately required in the partial result; no source mutation or coordinator publication is exercised.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its temporary project, constructs and closes a driver compiler Program in-process, and directly calls Build, BuildFiles and ApplyArtifacts. A restored empty linked-plugin manifest excludes ambient hooks. It installs no consumer and builds or starts no native product command.
func TestArtifactsSurviveAPartialRebuild(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
