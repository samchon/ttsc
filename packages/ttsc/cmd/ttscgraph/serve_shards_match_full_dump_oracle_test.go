package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "reflect"
  "sort"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestServeShardsMatchFullDumpOracle proves the initial transaction and one
// accepted edit reconstruct exactly the facts the complete builder produces.
// This keeps shard ownership and base-node reuse as an optimization boundary,
// never a second semantic contract.
//
// 1. Load Base, Impl and a consumer, then publish an initial shard generation.
// 2. Change a private implementation body and publish incrementally.
// 3. Require canonical node, edge and diagnostic rows to equal a fresh full projection over the same compiler state; the two projection algorithms share the compiler.
//
// @evidence contracts/testing.md#behavioral-verification Require canonical node, edge and diagnostic rows to equal a fresh full projection over the same compiler state; the two projection algorithms share the compiler.
// @evidence contracts/testing.md#independent-expectations The literal fixture and the supported graph contract establish these expectations: Require canonical node, edge and diagnostic rows to equal a fresh full projection over the same compiler state; the two projection algorithms share the compiler.
// @evidence contracts/testing.md#distinguishing-cases Load Base, Impl and a consumer, then publish an initial shard generation. Change a private implementation body and publish incrementally. Require canonical node, edge and diagnostic rows to equal a fresh full projection over the same compiler state; the two projection algorithms share the compiler.
// @evidence contracts/testing.md#execution-ownership TestServeShardsMatchFullDumpOracle is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeShardsMatchFullDumpOracle(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "base.ts"), "export interface Base { run(): void; }\n")
  writeGraphFile(t, filepath.Join(root, "src", "impl.ts"), "import { Base } from './base';\nexport class Impl implements Base { run(): void {} }\n")
  writeGraphFile(t, filepath.Join(root, "src", "consumer.ts"), "import { Impl } from './impl';\nexport function consume(): void { new Impl().run(); }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if snapshot, _, _, err := snapshotGraphShardState(session); err != nil || snapshot == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }
  assertServeShardFactsMatchFullDump(t, session)

  impl := filepath.Join(root, "src", "impl.ts")
  if err := os.WriteFile(impl, []byte("import { Base } from './base';\nexport class Impl implements Base { run(): void { const touched = true; void touched; } }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  snapshot, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if snapshot == nil || mode != serveModeIncremental || !changed {
    t.Fatalf("edited shard snapshot = snapshot:%v mode:%q changed:%v", snapshot != nil, mode, changed)
  }
  assertServeShardFactsMatchFullDump(t, session)
}

func assertServeShardFactsMatchFullDump(t *testing.T, session *graphSession) {
  t.Helper()
  complete, err := projectGraphDump(session)
  if err != nil {
    t.Fatal(err)
  }
  var nodes []graph.DumpNode
  var edges []graph.DumpEdge
  var diagnostics []graph.Diagnostic
  for _, committed := range session.graphStore.shards {
    nodes = append(nodes, committed.shard.Nodes...)
    edges = append(edges, committed.shard.Edges...)
    diagnostics = append(diagnostics, committed.shard.Diagnostics...)
  }
  if !reflect.DeepEqual(canonicalJSONRows(nodes), canonicalJSONRows(complete.Nodes)) {
    t.Fatal("committed shard nodes differ from complete-build oracle")
  }
  if !reflect.DeepEqual(canonicalJSONRows(edges), canonicalJSONRows(complete.Edges)) {
    t.Fatal("committed shard edges differ from complete-build oracle")
  }
  if !reflect.DeepEqual(canonicalJSONRows(diagnostics), canonicalJSONRows(complete.Diagnostics)) {
    t.Fatal("committed shard diagnostics differ from complete-build oracle")
  }
}

func canonicalJSONRows[T any](values []T) []string {
  rows := make([]string, 0, len(values))
  for _, value := range values {
    encoded, err := json.Marshal(value)
    if err != nil {
      panic(err)
    }
    rows = append(rows, string(encoded))
  }
  sort.Strings(rows)
  return rows
}
