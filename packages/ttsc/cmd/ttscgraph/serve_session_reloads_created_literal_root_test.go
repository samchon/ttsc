package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsCreatedLiteralRoot verifies a `files`-listed root
// that does not exist yet joins the graph once it is created.
//
// A literal `files` entry survives a root-set reload whether or not the file
// exists, so the root comparison never flips for it, and a file absent from
// the program has no source hash and no unresolved-import candidate. The
// session must track missing literal roots as freshness inputs of their own.
//
//  1. Open a session whose tsconfig lists absent `src/generated.ts` in files.
//  2. Create that file without touching any other project input.
//  3. Assert the next snapshot reloads and exposes the new declaration.
//
// @evidence contracts/testing.md#behavioral-verification Verifies a `files`-listed root that does not exist yet joins the graph once it is created.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish "reload"; the next snapshot reloads and exposes the new declaration.
// @evidence contracts/testing.md#distinguishing-cases Open a session whose tsconfig lists absent `src/generated.ts` in files; Create that file without touching any other project input; Assert the next snapshot reloads and exposes the new declaration.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsCreatedLiteralRoot is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsCreatedLiteralRoot(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs" },
  "files": ["src/index.ts", "src/generated.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export class Present {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "src", "generated.ts"), "export class Generated {}\n")
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "Generated") {
    t.Fatalf("created files-listed root was not reloaded: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
