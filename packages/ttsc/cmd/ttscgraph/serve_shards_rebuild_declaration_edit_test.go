package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsRebuildDeclarationEdit verifies that a declaration-file
// edit reports rebuild from the initial generation and leaves committed facts
// equal to a full projection over the same compiler. Complete replacement
// payloads, internal closure selection, and rebuild counts are not observed.
//
// 1. Publish a project whose local value calls an ambient number-returning declaration.
// 2. Change the ambient declaration to return string.
// 3. Require a rebuild response based on the initial generation and committed-fact equality with the full projection.
//
// @evidence contracts/testing.md#behavioral-verification Require a changed rebuild response based on the initial generation and committed-fact equality with the full projection. This does not independently certify complete upsert membership, internal invalidation closures, or rebuild counts.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: changing the ambient api.d.ts return type from number to string must make the next shard snapshot mode rebuild, changed, with BaseGeneration equal to the initial generation, and the committed shards must equal a full projection. The full-projection comparison runs another lane over the same compiler and extraction helpers, so it cannot independently detect a shared checker or extraction defect.
// @evidence contracts/testing.md#distinguishing-cases Publish a project whose local value calls an ambient number-returning declaration. Change the ambient declaration to return string. Require a changed rebuild response based on the initial generation and committed-fact equality with the full projection.
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
