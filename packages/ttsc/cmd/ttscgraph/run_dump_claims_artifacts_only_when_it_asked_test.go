package main

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestRunDumpClaimsArtifactsOnlyWhenItAsked verifies that the artifact
// capability is a statement about what this producer did, not about what it
// found.
//
// The two states a consumer must distinguish are "this project publishes no
// artifacts" and "this producer was never pointed at a publisher". Both are the
// same absent nodes, so only the claim separates them — and a producer that
// claimed unconditionally would make a project with no lint install look like a
// project whose documents cite nothing. The second producer is named for the
// same reason: these facts did not come from this Program, and the dump's
// one-generation contract stays honest by saying so rather than by hiding it.
//
//  1. Dump a project with no `--artifacts`, and assert neither the claim nor the
//     second producer appears, and that the citation stays a token.
//  2. Dump the same project with a published set, and assert both appear and the
//     citation resolved to a node carrying its heading and its line.
func TestRunDumpClaimsArtifactsOnlyWhenItAsked(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/main.ts"]
}
`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), `/** @evidence docs/sale.md#pricing States the rule. */
export function priced(): void {}
`)

  plain := decodeArtifactDump(t, runDumpForArtifacts(t, root, ""))
  if slices.Contains(plain.Provenance.Capabilities, graph.CapabilityArtifactNodes) {
    t.Fatalf("a dump that was never pointed at a publisher claimed %q", graph.CapabilityArtifactNodes)
  }
  if plain.Provenance.ArtifactProducer != nil {
    t.Fatal("a dump with no artifacts named a second producer")
  }
  for _, node := range plain.Nodes {
    if node.ID == "docs/sale.md#pricing" {
      t.Fatal("an unrequested dump fabricated an artifact node")
    }
  }

  published := filepath.Join(root, "artifacts.json")
  if err := os.WriteFile(published, []byte(`[
  {"address":"docs/sale.md","kind":"markdown_document","readable":"Sale","file":"docs/sale.md","line":1},
  {"address":"docs/sale.md#pricing","kind":"markdown_section","readable":"Pricing","parent":"docs/sale.md","file":"docs/sale.md","line":7}
]`), 0o644); err != nil {
    t.Fatal(err)
  }

  indexed := decodeArtifactDump(t, runDumpForArtifacts(t, root, published))
  if !slices.Contains(indexed.Provenance.Capabilities, graph.CapabilityArtifactNodes) {
    t.Fatalf("a dump that asked declares %v, missing %q",
      indexed.Provenance.Capabilities, graph.CapabilityArtifactNodes)
  }
  if indexed.Provenance.ArtifactProducer == nil {
    t.Fatal("the artifact nodes came from another Program and the dump did not say so")
  }

  var section *graph.DumpNode
  for index := range indexed.Nodes {
    if indexed.Nodes[index].ID == "docs/sale.md#pricing" {
      section = &indexed.Nodes[index]
    }
  }
  if section == nil {
    t.Fatal("the cited section is not a node")
  }
  if section.Name != "Pricing" {
    t.Fatalf("the section is named %q, not the heading text an index exists to hold", section.Name)
  }
  if section.Parent != "docs/sale.md" {
    t.Fatalf("the section's parent is %q, want its document", section.Parent)
  }
  if section.Evidence == nil || section.Evidence.StartLine != 7 {
    t.Fatalf("the section carries no span at its heading: %+v", section.Evidence)
  }
  cited := false
  for _, edge := range indexed.Edges {
    if edge.Kind == "doc_ref" && edge.To == "docs/sale.md#pricing" {
      cited = true
    }
  }
  if !cited {
    t.Fatal("the citation stayed a token; it has to resolve to the node now that one exists")
  }
}

// runDumpForArtifacts runs the dump subcommand and returns its stdout.
func runDumpForArtifacts(t *testing.T, root, artifacts string) string {
  t.Helper()
  args := []string{"dump", "--cwd", root, "--tsconfig", "tsconfig.json"}
  if artifacts != "" {
    args = append(args, "--artifacts", artifacts)
  }
  var out, errOut bytes.Buffer
  restoreStdout, restoreStderr := stdout, stderr
  stdout, stderr = &out, &errOut
  defer func() { stdout, stderr = restoreStdout, restoreStderr }()

  if code := run(args); code != 0 {
    t.Fatalf("dump exited %d: %s", code, errOut.String())
  }
  return out.String()
}

type artifactDump struct {
  Provenance struct {
    Capabilities     []string        `json:"capabilities"`
    ArtifactProducer *graph.Producer `json:"artifactProducer"`
  } `json:"provenance"`
  Nodes []graph.DumpNode `json:"nodes"`
  Edges []graph.DumpEdge `json:"edges"`
}

func decodeArtifactDump(t *testing.T, raw string) artifactDump {
  t.Helper()
  var parsed artifactDump
  if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &parsed); err != nil {
    t.Fatalf("dump is not JSON: %v", err)
  }
  return parsed
}
