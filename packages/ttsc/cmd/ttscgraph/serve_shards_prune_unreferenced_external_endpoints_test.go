package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsPruneUnreferencedExternalEndpoints verifies an external leaf
// leaves both resident endpoint indexes when its last owning edge disappears.
//
// 1. Publish a local call to an ambient external declaration and record its endpoint identity.
// 2. Remove the last owning call while retaining the ambient import.
// 3. Require zero retained references and no external endpoint in either cache, then match a full projection.
//
// @evidence contracts/testing.md#behavioral-verification Require zero retained references and no external endpoint in either cache, then match a full projection.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: after the only call to the ambient external function is removed (the import stays), the snapshot must be mode incremental, changed, the recorded external endpoint id must have zero references and be absent from both the wire endpoint cache and the internal node cache, and the committed shards must equal a full projection. The full-projection comparison runs another lane over the same compiler and extraction helpers, so it cannot independently detect a shared checker or extraction defect.
// @evidence contracts/testing.md#distinguishing-cases Publish a local call to an ambient external declaration and record its endpoint identity. Remove the last owning call while retaining the ambient import. Require zero retained references and no external endpoint in either cache, then match a full projection.
// @evidence contracts/testing.md#execution-ownership TestServeShardsPruneUnreferencedExternalEndpoints is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeShardsPruneUnreferencedExternalEndpoints(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "api.d.ts"), "export declare function external(): number;\n")
  index := filepath.Join(root, "src", "index.ts")
  writeGraphFile(t, index, "import { external } from './api';\nexport function run(): number { return external(); }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if snapshot, _, _, err := snapshotGraphShardState(session); err != nil || snapshot == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }
  source := session.compiler.Program().SourceFile(index)
  if source == nil {
    t.Fatal("fixture source was absent from resident program")
  }
  sourceKey := session.graphStore.sourceKeys[source.FileName()]
  if sourceKey == "" || len(session.graphStore.sourceExternal[sourceKey]) != 1 {
    t.Fatalf("fixture source must own one external endpoint: key=%q targets=%v", sourceKey, session.graphStore.sourceExternal[sourceKey])
  }
  var externalID string
  for id := range session.graphStore.sourceExternal[sourceKey] {
    externalID = id
    break
  }
  if externalID == "" {
    t.Fatal("fixture did not produce an external endpoint")
  }
  endpoint, exists := session.graphStore.externalNodes[externalID]
  if !exists || !endpoint.External || endpoint.Name != "external" || session.graphStore.externalReferences[externalID] != 1 {
    t.Fatalf("fixture endpoint is not the singly referenced external callable: id=%q node=%#v references=%d", externalID, endpoint, session.graphStore.externalReferences[externalID])
  }

  if err := os.WriteFile(index, []byte("import { external } from './api';\nexport function run(): number { return 1; }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  snapshot, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if snapshot == nil || mode != serveModeIncremental || !changed {
    t.Fatalf("external endpoint edit = snapshot:%v mode:%q changed:%v", snapshot != nil, mode, changed)
  }
  if session.graphStore.externalReferences[externalID] != 0 {
    t.Fatalf("external endpoint %s retained a reference count", externalID)
  }
  if _, exists := session.graphStore.externalNodes[externalID]; exists {
    t.Fatalf("external endpoint %s remained in the wire endpoint cache", externalID)
  }
  for id, node := range session.graphStore.nodes {
    if node.External {
      t.Fatalf("external endpoint %s remained in the internal endpoint cache as %s", externalID, id)
    }
  }
  assertServeShardFactsMatchFullDump(t, session)
}
