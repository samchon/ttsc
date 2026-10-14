package main

import (
  "bytes"
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestArtifactStore verifies the overlay's complete-body and generation contract.
//
// Verifies: an action is published only after its OutputID body is valid, and a later put replaces its mapping without invalidating an earlier reader.
// 1. Put an archive, read it, and put a second body for the same action.
// 2. Reopen the store and require the new generation while the old body still exists.
// 3. Reject a bad digest, a truncated body and an aliased body, then treat a missing body after interrupted cleanup as a miss.
//
// @evidence contracts/testing.md#behavioral-verification Uses actual owned files and the store's put/get operations, asserting returned bytes and the surviving index after failed writes.
// @evidence contracts/testing.md#independent-expectations SHA-256 is computed directly from literal body bytes; a second mapping for one ActionID follows stock Go's last-valid-put policy, while invalid bytes cannot match their claimed OutputID.
// @evidence contracts/testing.md#distinguishing-cases Covers first put, same-action replacement, restart, zero body, wrong digest, truncated input, deduplicated output, body alias rejection and a missing body after partial cleanup; helper protocol and native clean races have separate owners.
// @evidence contracts/testing.md#execution-ownership This Go unit test owns a temporary directory and calls storage directly; it starts no Go build or external host.
func TestArtifactStore(t *testing.T) {
  root := t.TempDir()
  store, err := openArtifactStore(root, nil)
  if err != nil {
    t.Fatal(err)
  }
  defer store.close()
  action := strings.Repeat("a", 64)
  first := []byte("first archive")
  second := []byte("second archive")
  digest := func(body []byte) string {
    sum := sha256.Sum256(body)
    return hex.EncodeToString(sum[:])
  }
  firstPath, err := store.put(action, digest(first), int64(len(first)), bytes.NewReader(first))
  if err != nil {
    t.Fatal(err)
  }
  value, location, found, err := store.get(action)
  if err != nil || !found || location != firstPath || value.OutputID != digest(first) {
    t.Fatalf("first generation not readable: %+v %q %v %v", value, location, found, err)
  }
  secondPath, err := store.put(action, digest(second), int64(len(second)), bytes.NewReader(second))
  if err != nil {
    t.Fatal(err)
  }
  value, location, found, err = store.get(action)
  if err != nil || !found || location != secondPath || value.OutputID != digest(second) {
    t.Fatalf("new generation not readable: %+v %q %v %v", value, location, found, err)
  }
  if raw, err := os.ReadFile(firstPath); err != nil || !bytes.Equal(raw, first) {
    t.Fatalf("old pinned body changed: %q %v", raw, err)
  }
  if _, err := store.put(action, digest(first), int64(len(second)), bytes.NewReader(second)); err == nil {
    t.Fatal("wrong OutputID accepted")
  }
  if _, err := store.put(action, digest(first), int64(len(first)), bytes.NewReader(first[:3])); err == nil {
    t.Fatal("truncated body accepted")
  }
  if _, err := store.put(strings.Repeat("b", 64), digest(second), int64(len(second)), bytes.NewReader(second)); err != nil {
    t.Fatal(err)
  }
  empty := []byte{}
  if _, err := store.put(strings.Repeat("c", 64), digest(empty), 0, bytes.NewReader(empty)); err != nil {
    t.Fatal(err)
  }
  if err := store.close(); err != nil {
    t.Fatal(err)
  }
  reopened, err := openArtifactStore(root, nil)
  if err != nil {
    t.Fatal(err)
  }
  defer reopened.close()
  value, location, found, err = reopened.get(action)
  if err != nil || !found || value.OutputID != digest(second) {
    t.Fatalf("restart lost last valid generation: %+v %q %v %v", value, location, found, err)
  }
  aliasAction := strings.Repeat("d", 64)
  alias := filepath.Join(root, "overlay", "bodies", digest([]byte("alias")))
  if err := os.Symlink(secondPath, alias); err == nil {
    if _, err := reopened.put(aliasAction, digest([]byte("alias")), int64(len("alias")), bytes.NewReader([]byte("alias"))); err == nil {
      t.Fatal("aliased body accepted")
    }
  }
  if err := reopened.close(); err != nil {
    t.Fatal(err)
  }
  if err := os.Remove(secondPath); err != nil {
    t.Fatal(err)
  }
  recovering, err := openArtifactStore(root, nil)
  if err != nil {
    t.Fatal(err)
  }
  defer recovering.close()
  _, _, found, err = recovering.get(action)
  if err != nil || found {
    t.Fatalf("an interrupted cleanup's missing body did not become a miss: %v %v", found, err)
  }
}
