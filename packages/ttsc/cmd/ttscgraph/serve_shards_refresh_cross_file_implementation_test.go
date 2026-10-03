package main

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestServeShardsRefreshCrossFileImplementation verifies that an assignment
// source and the declaration node whose implementation span it owns enter one
// replacement transaction.
//
// 1. Publish Service.run and a separate install.ts assignment whose implementation calls helper.
// 2. Remove the cross-file assignment without changing service.ts.
// 3. Require initial evidence to name src/install.ts, an incremental replacement of the declaration shard digest and equality with the full projection.
//
// @evidence contracts/testing.md#behavioral-verification Require initial evidence to name src/install.ts, an incremental replacement of the declaration shard digest and equality with the full projection.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over Service.run and an install.ts assignment calling helper: the initial edge from Service.run to helper must carry evidence file src/install.ts, and removing the assignment (service.ts untouched) must give mode incremental, changed, with a different digest for the Service shard and committed shards equal to a full projection. The full-projection comparison runs another lane over the same compiler and extraction helpers, so it cannot independently detect a shared checker or extraction defect.
// @evidence contracts/testing.md#distinguishing-cases Publish Service.run and a separate install.ts assignment whose implementation calls helper. Remove the cross-file assignment without changing service.ts. Require initial evidence to name src/install.ts, an incremental replacement of the declaration shard digest and equality with the full projection.
// @evidence contracts/testing.md#execution-ownership TestServeShardsRefreshCrossFileImplementation is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeShardsRefreshCrossFileImplementation(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  service := filepath.Join(root, "src", "service.ts")
  install := filepath.Join(root, "src", "install.ts")
  writeGraphFile(t, service, "export class Service { run(): void {} }\n")
  writeGraphFile(t, install, "import { Service } from './service';\nexport function helper(): void {}\nexport function install(value: Service): void { value.run = (): void => { helper(); }; }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if snapshot, _, _, err := snapshotGraphShardState(session); err != nil || snapshot == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }
  serviceSource := session.compiler.Program().SourceFile(service)
  if serviceSource == nil {
    t.Fatal("service source was absent from resident program")
  }
  serviceKey := session.graphStore.sourceKeys[serviceSource.FileName()]
  before := session.graphStore.shards[serviceKey].digest
  evidenceFile := ""
  for _, edge := range session.graphStore.shards[serviceKey].shard.Edges {
    if strings.Contains(edge.From, "#Service.run:method") && strings.Contains(edge.To, "#helper:function") && edge.Evidence != nil {
      evidenceFile = edge.Evidence.File
      break
    }
  }
  if evidenceFile != "src/install.ts" {
    t.Fatalf("cross-file implementation edge evidence = %q", evidenceFile)
  }

  if err := os.WriteFile(install, []byte("import { Service } from './service';\nexport function helper(): void {}\nexport function install(value: Service): void { void value; }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  snapshot, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if snapshot == nil || mode != serveModeIncremental || !changed {
    t.Fatalf("cross-file implementation edit = snapshot:%v mode:%q changed:%v", snapshot != nil, mode, changed)
  }
  if session.graphStore.shards[serviceKey].digest == before {
    t.Fatal("declaration shard retained its cross-file implementation evidence")
  }
  assertServeShardFactsMatchFullDump(t, session)
}
