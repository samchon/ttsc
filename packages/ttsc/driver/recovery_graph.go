package driver

import (
  "sort"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// recoveryGraph retains the predicates already observed before a failed load.
// Empty source/config populations make no Program-membership claim; every
// observed path is universal recovery input, including missing candidates.
// Snapshotting and proof projection perform no new filesystem operation. Work
// and returned storage follow observed paths/predicates plus path sorting.
func (fs *inputObservationFS) recoveryGraph(cwd string) *TransformGraph {
  graph := &TransformGraph{
    Edges: map[string][]string{}, Globals: []string{}, Configs: []string{},
    UseCaseSensitiveFileNames: fs.caseSensitivity == shimtspath.CaseSensitive,
  }
  for _, input := range fs.observedPaths() {
    graph.ResolutionInputs = append(graph.ResolutionInputs, TransformOutputKey(cwd, input))
  }
  sort.Strings(graph.ResolutionInputs)
  graph.attachObservedInputProof(fs, cwd)
  return graph
}
