package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionReusesUnchangedSnapshot verifies that a second request over
// an untouched one-file project reports unchanged and omits a replacement dump.
//
// The owning snapshot operation checks native inputs before returning this
// result. This unit observes its mode, changed flag, and dump presence; it does
// not count graph constructions or execute the Node consumer's indexed-map path.
//
// 1. Open a one-file graph session and request its initial dump.
// 2. Request another snapshot without touching the project.
// 3. Assert the second response is unchanged and carries no replacement dump.
//
// @evidence contracts/testing.md#behavioral-verification Verifies initial dump publication followed by an unchanged response with no replacement dump over an untouched one-file project. Graph construction counts and downstream Node parsing or indexed-map reuse are not observed here.
// @evidence contracts/testing.md#independent-expectations The expectations are literal session states over a one-file fixture: the first snapshot must be mode initial, changed, with a dump, and a second snapshot with no disk change must be mode unchanged, not changed, with no dump.
// @evidence contracts/testing.md#distinguishing-cases Open a one-file graph session and request its initial dump; Request another snapshot without touching the project; Assert the second response is unchanged and carries no replacement dump.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReusesUnchangedSnapshot is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReusesUnchangedSnapshot(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()

  first, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if first == nil || mode != "initial" || !changed {
    t.Fatalf("initial snapshot = dump:%v mode:%q changed:%v", first != nil, mode, changed)
  }

  second, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if second != nil || mode != "unchanged" || changed {
    t.Fatalf("unchanged snapshot = dump:%v mode:%q changed:%v", second != nil, mode, changed)
  }
}

func graphSessionFixture(t *testing.T) string {
  t.Helper()
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export class BeforeEdit {}\n")
  return root
}
