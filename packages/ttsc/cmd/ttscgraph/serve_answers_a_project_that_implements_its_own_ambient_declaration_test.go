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
// Source shard partitioning requires an owner for each outgoing edge. This
// fixture combines an owned ambient declaration and an implementation elsewhere,
// exercising assembly rather than certifying every underlying graph fact.
//
//  1. Serve a project whose `src/globals.d.ts` declares `var patched` and whose
//     `src/index.ts` assigns an arrow function to it.
//  2. Request one negotiated shard snapshot.
//  3. Assert the response carries a complete transaction and no error.
//
// @evidence contracts/testing.md#behavioral-verification Verifies shard assembly succeeds for a project that declares an ambient global in its own `.d.ts` and assigns the implementation elsewhere.
// @evidence contracts/testing.md#independent-expectations The supported initial-transaction invariant requires no error, initial mode, changed=true, no legacy dump, a nonempty manifest, exactly one upsert per manifest key with its declared digest, and no deletes. Duplicate keys, unknown upserts or mismatched digests violate this independently stated correspondence; equality does not authenticate digest bytes or complete graph semantics. The authored ambient/global assignment supplies the assembly boundary input, without claiming a newly executed historical reproduction.
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
  manifestDigests := make(map[string]string, len(initial.Snapshot.Manifest))
  for _, entry := range initial.Snapshot.Manifest {
    if entry.Key == "" || entry.Digest == "" {
      t.Fatalf("initial manifest entry lacks a key or digest: %+v", entry)
    }
    if _, duplicate := manifestDigests[entry.Key]; duplicate {
      t.Fatalf("duplicate initial manifest key: %s", entry.Key)
    }
    manifestDigests[entry.Key] = entry.Digest
  }
  seenUpserts := make(map[string]bool, len(initial.Snapshot.Upserts))
  for _, upsert := range initial.Snapshot.Upserts {
    expectedDigest, exists := manifestDigests[upsert.Shard.Key]
    if !exists || upsert.Digest != expectedDigest {
      t.Fatalf("initial upsert does not match its manifest entry: key=%s digest=%s", upsert.Shard.Key, upsert.Digest)
    }
    if seenUpserts[upsert.Shard.Key] {
      t.Fatalf("duplicate initial upsert key: %s", upsert.Shard.Key)
    }
    seenUpserts[upsert.Shard.Key] = true
  }
  for key := range manifestDigests {
    if !seenUpserts[key] {
      t.Fatalf("initial manifest key has no upsert: %s", key)
    }
  }
}
