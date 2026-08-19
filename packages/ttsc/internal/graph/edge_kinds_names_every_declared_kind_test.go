package graph

import (
  "os"
  "regexp"
  "slices"
  "testing"
)

// TestEdgeKindsNamesEveryDeclaredKind verifies that EdgeKinds returns exactly the
// EdgeKind constants this package declares.
//
// EdgeKinds exists so a consumer reporting per-kind numbers can seed every family
// rather than only the ones a particular project contains. That guarantee is only
// worth having if the list cannot fall behind the constants: a kind added to the
// block and not to the list is reported as absent rather than as zero, which is
// the defect the list was introduced to end. Go has no reflection over a const
// block, so the declarations are read from the source that makes them.
//
//  1. Read the EdgeKind constant block from graph.go.
//  2. Collect every declared wire value.
//  3. Assert EdgeKinds returns that set, with no extra and no missing member.
func TestEdgeKindsNamesEveryDeclaredKind(t *testing.T) {
  source, err := os.ReadFile("graph.go")
  if err != nil {
    t.Fatal(err)
  }
  matches := regexp.MustCompile(`(?m)^\s*Edge\w+ EdgeKind = "([a-z-]+)"`).
    FindAllStringSubmatch(string(source), -1)
  if len(matches) == 0 {
    t.Fatal("no EdgeKind constant declarations were found in graph.go")
  }

  declared := make([]string, 0, len(matches))
  for _, match := range matches {
    declared = append(declared, match[1])
  }
  returned := make([]string, 0, len(EdgeKinds()))
  for _, kind := range EdgeKinds() {
    returned = append(returned, string(kind))
  }

  slices.Sort(declared)
  slices.Sort(returned)
  if !slices.Equal(declared, returned) {
    t.Fatalf("EdgeKinds returns %v, but graph.go declares %v; a kind missing "+
      "from the list is reported as absent rather than as zero", returned, declared)
  }
}
