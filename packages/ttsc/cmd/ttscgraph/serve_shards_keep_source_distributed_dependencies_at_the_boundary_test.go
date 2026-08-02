package main

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestServeShardsKeepSourceDistributedDependenciesAtTheBoundary proves the
// incremental store owns only workspace declarations while provenance still
// attests to every source the resident checker loaded.
//
// 1. Snapshot one workspace source that imports a raw TypeScript package.
// 2. Assert the dependency owns provenance but no authored graph facts.
// 3. Edit the dependency and assert the store publishes a complete replacement.
// 4. Compare the replacement store with the full-dump oracle.
func TestServeShardsKeepSourceDistributedDependenciesAtTheBoundary(t *testing.T) {
  root := t.TempDir()
  dependencyPath := filepath.Join(root, "node_modules", "dep-src", "src", "index.ts")
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "node_modules", "dep-src", "package.json"), `{
  "name": "dep-src",
  "version": "1.0.0",
  "main": "src/index.ts"
}`)
  writeGraphFile(t, dependencyPath, "export function dependencyValue(): number { return 1; }\nexport function dependencyInternal(): number { return dependencyValue(); }\n")
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
  dependencyDigest := ""
  for _, source := range session.graphStore.provenance.Sources {
    if strings.Contains(filepath.ToSlash(source.File), "/node_modules/dep-src/") {
      dependencyFile = source.File
      dependencyDigest = source.Checker
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

  writeGraphFile(t, dependencyPath, "export function dependencyValue(): number { return 2; }\nexport function dependencyInternal(): number { return dependencyValue(); }\n")
  replacement, mode, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if replacement == nil {
    t.Fatal("dependency edit did not publish a shard snapshot")
  }
  if mode != serveModeIncremental || !changed || len(replacement.Upserts) != len(replacement.Manifest) {
    t.Fatalf(
      "dependency edit should reuse the compiler and publish every shard: mode=%q changed=%v manifest=%d upserts=%d",
      mode,
      changed,
      len(replacement.Manifest),
      len(replacement.Upserts),
    )
  }
  dependencyDigestChanged := false
  for _, source := range session.graphStore.provenance.Sources {
    if source.File == dependencyFile && source.Checker != dependencyDigest {
      dependencyDigestChanged = true
      break
    }
  }
  if !dependencyDigestChanged {
    t.Fatal("raw dependency edit did not refresh checker provenance")
  }
  assertServeShardFactsMatchFullDump(t, session)
}
