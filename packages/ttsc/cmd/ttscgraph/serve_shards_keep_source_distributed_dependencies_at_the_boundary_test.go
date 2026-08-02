package main

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestServeShardsKeepSourceDistributedDependenciesAtTheBoundary proves the
// incremental store owns only workspace declarations while provenance still
// attests to every source the resident checker loaded.
func TestServeShardsKeepSourceDistributedDependenciesAtTheBoundary(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "node_modules", "dep-src", "package.json"), `{
  "name": "dep-src",
  "version": "1.0.0",
  "main": "src/index.ts"
}`)
  writeGraphFile(t, filepath.Join(root, "node_modules", "dep-src", "src", "index.ts"), "export function dependencyValue(): number { return 1; }\nexport function dependencyInternal(): number { return dependencyValue(); }\n")
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { dependencyValue } from 'dep-src';\nexport function workspaceValue(): number { return dependencyValue() + 1; }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if snapshot, _, _, err := session.SnapshotShards(); err != nil || snapshot == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }

  dependencyFile := ""
  for _, source := range session.graphStore.provenance.Sources {
    if strings.Contains(filepath.ToSlash(source.File), "/node_modules/dep-src/") {
      dependencyFile = source.File
      break
    }
  }
  if dependencyFile == "" {
    t.Fatal("raw dependency source is absent from provenance")
  }
  for _, file := range session.graphStore.extractedFiles {
    if file == dependencyFile {
      t.Fatalf("raw dependency source was treated as an authored extraction: %v", session.graphStore.extractedFiles)
    }
  }
  dependencyShard, ok := session.graphStore.shards[session.graphStore.sourceKeys[dependencyFile]]
  if !ok || dependencyShard.shard.Source == nil {
    t.Fatalf("dependency provenance shard missing for %q", dependencyFile)
  }
  if len(dependencyShard.shard.Nodes) != 0 || len(dependencyShard.shard.Edges) != 0 {
    t.Fatalf("dependency provenance shard owns graph facts: nodes=%v edges=%v", dependencyShard.shard.Nodes, dependencyShard.shard.Edges)
  }

  boundaryFound := false
  for _, node := range session.graphStore.nodes {
    normalized := filepath.ToSlash(node.File)
    if strings.Contains(normalized, "/node_modules/dep-src/") {
      if !node.External || node.Name != "dependencyValue" {
        t.Fatalf("unexpected dependency graph node: %+v", node)
      }
      boundaryFound = true
    }
  }
  if !boundaryFound {
    t.Fatal("referenced dependency boundary leaf is absent")
  }
  assertServeShardFactsMatchFullDump(t, session)
}
