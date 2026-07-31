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
  if snapshot, _, _, err := session.SnapshotShards(); err != nil || snapshot == nil {
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
  snapshot, mode, changed, err := session.SnapshotShards()
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
