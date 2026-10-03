package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsTransitiveProjectReference verifies config and root
// freshness traverses the complete project-reference graph, not only the
// root config's direct references.
//
// 1. Load the root-to-middle-to-leaf project reference chain and inspect captured config identities.
// 2. Publish the initial snapshot, then add leaf/src/added.ts.
// 3. Require the leaf config to be tracked and the transitive root addition to publish a changed reload dump.
//
// @evidence contracts/testing.md#behavioral-verification A leaf config reached only through root to middle to leaf project references is tracked in the session's config hashes, and adding a file under the leaf's include reloads the session with a changed dump.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: the slash-form path of leaf/tsconfig.json must be a key of the captured config hashes (transitive reference tracked), and creating leaf/src/added.ts must yield mode reload, changed, with a dump. The added file's node is not asserted.
// @evidence contracts/testing.md#distinguishing-cases Load the root-to-middle-to-leaf project reference chain and inspect captured config identities. Publish the initial snapshot, then add leaf/src/added.ts. Require the leaf config to be tracked and the transitive root addition to publish a changed reload dump.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsTransitiveProjectReference is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsTransitiveProjectReference(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "files": ["src/index.ts"],
  "references": [{ "path": "./middle" }]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export const root = 1;\n")
  writeGraphFile(t, filepath.Join(root, "middle", "tsconfig.json"), `{
  "compilerOptions": { "composite": true },
  "files": ["src/index.ts"],
  "references": [{ "path": "../leaf" }]
}`)
  writeGraphFile(t, filepath.Join(root, "middle", "src", "index.ts"), "export const middle = 1;\n")
  writeGraphFile(t, filepath.Join(root, "leaf", "tsconfig.json"), `{
  "compilerOptions": { "composite": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "leaf", "src", "index.ts"), "export const leaf = 1;\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  leafConfig := filepath.ToSlash(filepath.Join(root, "leaf", "tsconfig.json"))
  if _, ok := session.configHashes[leafConfig]; !ok {
    t.Fatalf("transitive project config was not tracked: %s; got %#v", leafConfig, session.configHashes)
  }
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  added := filepath.Join(root, "leaf", "src", "added.ts")
  if err := os.WriteFile(added, []byte("export const added = 1;\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("transitive root addition = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
