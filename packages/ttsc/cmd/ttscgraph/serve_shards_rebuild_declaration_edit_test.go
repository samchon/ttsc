package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsRebuildDeclarationEdit verifies that a declaration-file
// movement publishes one honest complete replacement instead of entering the
// authored-source partial builder with an empty invalidation set.
func TestServeShardsRebuildDeclarationEdit(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  declaration := filepath.Join(root, "src", "api.d.ts")
  writeGraphFile(t, declaration, "export declare function external(): number;\n")
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "import { external } from './api';\nexport const value = external();\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  initial, _, _, err := session.SnapshotShards()
  if err != nil || initial == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", initial != nil, err)
  }
  if err := os.WriteFile(declaration, []byte("export declare function external(): string;\n"), 0o644); err != nil {
    t.Fatal(err)
  }

  replacement, mode, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if replacement == nil || mode != serveModeRebuild || !changed || replacement.BaseGeneration != initial.Generation {
    t.Fatalf("declaration edit = snapshot:%#v mode:%q changed:%v", replacement, mode, changed)
  }
  assertServeShardFactsMatchFullDump(t, session)
}
