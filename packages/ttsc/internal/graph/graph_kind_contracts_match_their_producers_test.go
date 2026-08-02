package graph

import (
  "os"
  "path/filepath"
  "regexp"
  "sort"
  "testing"
)

// TestGraphKindContractsMatchTheirProducers keeps the hand-authored TypeScript
// unions exact: raw dump kinds equal the Go producer, general kinds add only the
// TypeScript memory/trace synthesis, and modifiers equal the emitted flag table.
//
// 1. Read every published graph-kind and modifier union.
// 2. Derive raw dump values from the native constants and wire mapping.
// 3. Apply the memory layer's module fold and synthetic kinds.
// 4. Assert every published union equals its producer set exactly.
func TestGraphKindContractsMatchTheirProducers(t *testing.T) {
  structures := filepath.Join("..", "..", "..", "graph", "src", "structures")
  rawNodes := stringUnion(t, filepath.Join(structures, "TtscGraphDumpNodeKind.ts"), "TtscGraphDumpNodeKind")
  rawEdges := stringUnion(t, filepath.Join(structures, "TtscGraphDumpEdgeKind.ts"), "TtscGraphDumpEdgeKind")
  nodes := stringUnion(t, filepath.Join(structures, "TtscGraphNodeKind.ts"), "TtscGraphNodeKind")
  edges := stringUnion(t, filepath.Join(structures, "TtscGraphEdgeKind.ts"), "TtscGraphEdgeKind")
  modifiers := stringUnion(t, filepath.Join(structures, "TtscGraphNodeModifier.ts"), "TtscGraphNodeModifier")

  source, err := os.ReadFile("graph.go")
  if err != nil {
    t.Fatalf("read graph.go: %v", err)
  }
  nodeConstants := sourceConstants(t, source, `(?m)^\s*Node[A-Za-z0-9_]*\s+NodeKind\s*=\s*"([^"]+)"`)
  edgeConstants := sourceConstants(t, source, `(?m)^\s*Edge[A-Za-z0-9_]*\s+EdgeKind\s*=\s*"([^"]+)"`)

  assertStringSet(t, "raw dump node kinds", rawNodes, nodeConstants)
  assertStringSet(t, "raw dump edge kinds", rawEdges, producedWireEdgeKinds(edgeConstants))
  memoryNodeKinds := withoutString(nodeConstants, "module")
  assertStringSet(t, "general graph node kinds", nodes, append(memoryNodeKinds, "file", "property"))
  assertStringSet(t, "general graph edge kinds", edges, append(append([]string{}, producedWireEdgeKinds(edgeConstants)...), "contains", "dispatches"))

  emittedModifiers := make([]string, 0, len(modifierFlagStrings))
  for _, modifier := range modifierFlagStrings {
    emittedModifiers = append(emittedModifiers, modifier.text)
  }
  assertStringSet(t, "graph node modifiers", modifiers, emittedModifiers)
}

func withoutString(values []string, excluded string) []string {
  out := make([]string, 0, len(values))
  for _, value := range values {
    if value != excluded {
      out = append(out, value)
    }
  }
  return out
}

func stringUnion(t *testing.T, path, name string) []string {
  t.Helper()
  source, err := os.ReadFile(path)
  if err != nil {
    t.Fatalf("read %s: %v", path, err)
  }
  declaration := regexp.MustCompile(`(?s)export type ` + regexp.QuoteMeta(name) + `\s*=\s*(.*?);`).FindSubmatch(source)
  if declaration == nil {
    t.Fatalf("find exported union %s in %s", name, path)
  }
  return sourceConstants(t, declaration[1], `"([^"]+)"`)
}

func sourceConstants(t *testing.T, source []byte, pattern string) []string {
  t.Helper()
  matches := regexp.MustCompile(pattern).FindAllSubmatch(source, -1)
  if len(matches) == 0 {
    t.Fatalf("no string constants matched %q", pattern)
  }
  values := make([]string, 0, len(matches))
  for _, match := range matches {
    values = append(values, string(match[1]))
  }
  return values
}

func producedWireEdgeKinds(constants []string) []string {
  values := map[string]bool{}
  for _, constant := range constants {
    kind := EdgeKind(constant)
    origins := []string{""}
    switch kind {
    case EdgeValueCall:
      origins = []string{"call", "new", "jsx", "tagged"}
    case EdgeHeritage:
      origins = []string{"extends", "implements"}
    case EdgeMemberRelation:
      origins = []string{"implements", "overrides"}
    }
    for _, origin := range origins {
      values[wireEdgeKind(kind, origin)] = true
    }
  }
  out := make([]string, 0, len(values))
  for value := range values {
    out = append(out, value)
  }
  return out
}

func assertStringSet(t *testing.T, name string, got, want []string) {
  t.Helper()
  got = append([]string{}, got...)
  want = append([]string{}, want...)
  sort.Strings(got)
  sort.Strings(want)
  if len(got) != len(want) {
    t.Fatalf("%s = %v, want %v", name, got, want)
  }
  for i := range got {
    if got[i] != want[i] {
      t.Fatalf("%s = %v, want %v", name, got, want)
    }
  }
}
