package main

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestServeShardsKeepSourceDistributedDependenciesAtTheBoundary verifies the
// authored raw dependency has provenance without owning extracted graph facts,
// while its referenced callable is represented by an external boundary node.
//
// 1. Snapshot one workspace source that imports a raw TypeScript package.
// 2. Assert the dependency owns provenance but no authored graph facts.
// 3. Edit the dependency and assert the store publishes a complete replacement.
// 4. Compare the replacement store with the full-dump oracle.
//
// @evidence contracts/testing.md#behavioral-verification The authored dep-src dependency has provenance, is absent from extracted files, and owns no shard nodes or edges; its cached boundary nodes are external and named dependencyValue. Its edit reports rebuild, publishes each manifest key with its matching digest, and changes its checker digest. Other loaded sources and dependency packages are not certified.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over a fixture where src/main.ts imports the raw-TypeScript package dep-src: the dependency must appear in provenance sources, must not be in the store's extracted files, its shard must hold no nodes or edges, and all dependency nodes found in the store must be external and named dependencyValue, with at least one found; after editing the dependency the snapshot must be mode rebuild, changed, with one upsert per manifest entry and a changed checker digest for the dependency. The full-projection comparison runs another lane over the same compiler and extraction helpers, so it cannot independently detect a shared checker or extraction defect.
// @evidence contracts/testing.md#distinguishing-cases Snapshot one workspace source that imports a raw TypeScript package; Assert the dependency owns provenance but no authored graph facts; Edit the dependency and assert the store publishes a complete replacement. 4. Compare the replacement store with the full-dump oracle.
// @evidence contracts/testing.md#execution-ownership TestServeShardsKeepSourceDistributedDependenciesAtTheBoundary is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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
  if snapshot, _, _, err := snapshotGraphShardState(session); err != nil || snapshot == nil {
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
  replacement, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if replacement == nil {
    t.Fatal("dependency edit did not publish a shard snapshot")
  }
  if mode != serveModeRebuild || !changed || len(replacement.Upserts) != len(replacement.Manifest) {
    t.Fatalf(
      "dependency edit should report and publish a complete rebuild: mode=%q changed=%v manifest=%d upserts=%d",
      mode,
      changed,
      len(replacement.Manifest),
      len(replacement.Upserts),
    )
  }
  dependencyDigestChanged := false
  manifestDigests := make(map[string]string, len(replacement.Manifest))
  if len(replacement.Manifest) == 0 {
    t.Fatal("replacement manifest is empty")
  }
  for _, reference := range replacement.Manifest {
    if reference.Key == "" || reference.Digest == "" {
      t.Fatalf("replacement manifest has an empty identity: %#v", reference)
    }
    if _, exists := manifestDigests[reference.Key]; exists {
      t.Fatalf("replacement manifest repeats key %q", reference.Key)
    }
    manifestDigests[reference.Key] = reference.Digest
  }
  seenUpserts := make(map[string]bool, len(replacement.Upserts))
  for _, upsert := range replacement.Upserts {
    digest, exists := manifestDigests[upsert.Shard.Key]
    if !exists || digest != upsert.Digest || seenUpserts[upsert.Shard.Key] {
      t.Fatalf("replacement upsert does not match a unique manifest entry: %#v", upsert)
    }
    seenUpserts[upsert.Shard.Key] = true
  }
  for key := range manifestDigests {
    if !seenUpserts[key] {
      t.Fatalf("replacement omitted manifest key %q", key)
    }
  }
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
