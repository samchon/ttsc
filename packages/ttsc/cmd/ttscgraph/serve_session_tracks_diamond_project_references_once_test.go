package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionTracksDiamondProjectReferencesOnce verifies the config
// traversal terminates and deduplicates when two references share a child.
//
// A diamond (root -> left, root -> right, both -> shared) visits the shared
// config twice; without the seen-set the traversal would duplicate tracked
// state, and on a reference cycle it would never terminate. The shared leaf
// must appear in the freshness state exactly once and the session must stay
// stable across untouched snapshots.
//
//  1. Open a session over a diamond of project references.
//  2. Assert the shared leaf config is hash-tracked.
//  3. Assert an untouched snapshot reports unchanged.
//
// @evidence contracts/testing.md#behavioral-verification Verifies the config traversal terminates and deduplicates when two references share a child.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish "unchanged"; an untouched snapshot reports unchanged.
// @evidence contracts/testing.md#distinguishing-cases Open a session over a diamond of project references; Assert the shared leaf config is hash-tracked; Assert an untouched snapshot reports unchanged.
// @evidence contracts/testing.md#execution-ownership TestServeSessionTracksDiamondProjectReferencesOnce is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionTracksDiamondProjectReferencesOnce(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "files": ["src/index.ts"],
  "references": [{ "path": "./left" }, { "path": "./right" }]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export const root = 1;\n")
  for _, side := range []string{"left", "right"} {
    writeGraphFile(t, filepath.Join(root, side, "tsconfig.json"), `{
  "compilerOptions": { "composite": true },
  "files": ["src/index.ts"],
  "references": [{ "path": "../shared" }]
}`)
    writeGraphFile(t, filepath.Join(root, side, "src", "index.ts"), "export const side = 1;\n")
  }
  writeGraphFile(t, filepath.Join(root, "shared", "tsconfig.json"), `{
  "compilerOptions": { "composite": true },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "shared", "src", "index.ts"), "export const shared = 1;\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  sharedConfig := filepath.ToSlash(filepath.Join(root, "shared", "tsconfig.json"))
  if _, ok := session.configHashes[sharedConfig]; !ok {
    t.Fatalf("shared diamond config was not tracked: %s; got %#v", sharedConfig, session.configHashes)
  }
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != "unchanged" || changed {
    t.Fatalf("diamond references churned: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
