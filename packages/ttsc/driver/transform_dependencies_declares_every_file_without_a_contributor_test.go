package driver

import (
  "reflect"
  "testing"
)

// TestTransformDependenciesDeclaresEveryFileWithoutAContributor verifies the
// rule the host declares under when nothing else can contribute: a
// source-to-source transform is syntactic, so a file the host alone produced
// depends on its own text and the compiler options, and on nothing else.
//
// With an empty contributor set the aggregation is vacuously satisfied for
// every file, which is what lets a plugin-free project's consumer stop
// revalidating each delivered module's whole reference closure
// (samchon/ttsc#1259).
func TestTransformDependenciesDeclaresEveryFileWithoutAContributor(t *testing.T) {
  keys := []string{"src/main.ts", "src/types.ts"}

  out := aggregateTransformDependencies(keys, nil, newPluginFileDeclarations())

  if !reflect.DeepEqual(out.Complete, []string{"src/main.ts", "src/types.ts"}) {
    t.Fatalf("expected every file declared complete, got %v", out.Complete)
  }
  if out.Dependencies != nil {
    t.Fatalf("expected no dependency entries, got %v", out.Dependencies)
  }
}
