package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsRebuildDeclarationEdit verifies that a declaration-file
// movement publishes one honest complete replacement instead of entering the
// authored-source partial builder with an empty invalidation set.
//
// 1. Publish a project whose local value calls an ambient number-returning declaration.
// 2. Change the ambient declaration to return string.
// 3. Require one complete rebuild replacement based on the initial generation and equality with the full projection.
//
// @evidence contracts/testing.md#behavioral-verification Require one complete rebuild replacement based on the initial generation and equality with the full projection.
// @evidence contracts/testing.md#independent-expectations The literal fixture and the supported graph contract establish these expectations: Require one complete rebuild replacement based on the initial generation and equality with the full projection. The full projection comparison uses another lane over the same compiler and extraction helpers, so it cannot independently detect a shared checker or extraction defect.
// @evidence contracts/testing.md#distinguishing-cases Publish a project whose local value calls an ambient number-returning declaration. Change the ambient declaration to return string. Require one complete rebuild replacement based on the initial generation and equality with the full projection.
// @evidence contracts/testing.md#execution-ownership TestServeShardsRebuildDeclarationEdit is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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
  initial, _, _, err := snapshotGraphShardState(session)
  if err != nil || initial == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", initial != nil, err)
  }
  if err := os.WriteFile(declaration, []byte("export declare function external(): string;\n"), 0o644); err != nil {
    t.Fatal(err)
  }

  replacement, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if replacement == nil || mode != serveModeRebuild || !changed || replacement.BaseGeneration != initial.Generation {
    t.Fatalf("declaration edit = snapshot:%#v mode:%q changed:%v", replacement, mode, changed)
  }
  assertServeShardFactsMatchFullDump(t, session)
}
