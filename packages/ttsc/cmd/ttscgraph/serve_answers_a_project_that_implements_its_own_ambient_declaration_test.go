package main

import (
  "bytes"
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestServeAnswersAProjectThatImplementsItsOwnAmbientDeclaration verifies shard
// assembly succeeds for a project that declares an ambient global in its own
// `.d.ts` and assigns the implementation elsewhere.
//
// Shard partition indexes edge sources by non-external node, and external nodes
// live in a non-source shard that may own no edges. An edge leaving one is
// therefore not a wrong fact but an unassemblable snapshot: the session refused
// the whole transaction with "edge source node is absent from shard facts", so
// every request failed before it ran while `dump`, which applies no such check,
// still emitted the graph.
//
//  1. Serve a project whose `src/globals.d.ts` declares `var patched` and whose
//     `src/index.ts` assigns an arrow function to it.
//  2. Request one negotiated shard snapshot.
//  3. Assert the response carries a complete transaction and no error.
//
// @evidence contracts/testing.md#behavioral-verification Verifies shard assembly succeeds for a project that declares an ambient global in its own `.d.ts` and assigns the implementation elsewhere.
// @evidence contracts/testing.md#independent-expectations The expectation comes from the shard-protocol transaction invariant, written as literals independent of the shard builder: a first negotiated snapshot must have no error, mode initial, no legacy dump, a non-empty manifest, exactly one upsert per manifest entry and no deletes. The fixture (a global var declared in a .d.ts and assigned in index.ts) reproduces the earlier failure where assembly refused the whole transaction, so that refusal fails the first assertion.
// @evidence contracts/testing.md#distinguishing-cases Serve a project whose `src/globals.d.ts` declares `var patched` and whose `src/index.ts` assigns an arrow function to it; Request one negotiated shard snapshot; Assert the response carries a complete transaction and no error.
// @evidence contracts/testing.md#execution-ownership TestServeAnswersAProjectThatImplementsItsOwnAmbientDeclaration is a Go source-unit entry. serveSnapshotRequests performs actual NDJSON decoding and resident lifecycle through the source publisher; prepared projection consumes explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeAnswersAProjectThatImplementsItsOwnAmbientDeclaration(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "globals.d.ts"), `declare global {
  var patched: (message: string) => void;
}
export {};
`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), `export function helper(): void {}
patched = (message: string): void => {
  helper();
};
`)

  input := strings.NewReader("{\"id\":1,\"graphSnapshotVersion\":1}\n")
  var output bytes.Buffer
  if code := serveSourceSnapshots(input, &output, root, "tsconfig.json"); code != 0 {
    t.Fatalf("serveSnapshots exited %d: %s", code, output.String())
  }

  var initial serveResponse
  if err := json.NewDecoder(&output).Decode(&initial); err != nil {
    t.Fatal(err)
  }
  if initial.Error != "" {
    t.Fatalf("shard assembly refused a project that implements its own ambient declaration: %s", initial.Error)
  }
  if initial.Mode != serveModeInitial || !initial.Changed || initial.Dump != nil || initial.Snapshot == nil {
    t.Fatalf("negotiated initial response: %#v", initial)
  }
  if len(initial.Snapshot.Manifest) == 0 ||
    len(initial.Snapshot.Upserts) != len(initial.Snapshot.Manifest) ||
    len(initial.Snapshot.Deletes) != 0 {
    t.Fatalf(
      "initial transaction is not complete: manifest=%d upserts=%d deletes=%d",
      len(initial.Snapshot.Manifest),
      len(initial.Snapshot.Upserts),
      len(initial.Snapshot.Deletes),
    )
  }
}
