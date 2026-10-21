package main

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestAccountArtifactStore verifies that accounting skips entries a concurrent preparation removes while it walks.
//
// Verifies: a staging lock or staged directory removed between listing and stat is omitted from a successful accounting, while existing entries are still counted and still bound by policy.
// 1. Account a populated store without interference, as the baseline.
// 2. Remove a staging lock and a staged directory after their directories are listed, and require success without them.
// 3. Exceed the depth policy beside a removed entry, and require the policy failure.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production accountArtifactStore over real files in an owned store and compares the returned totals; removals happen through the store's accountingListed seam at the exact listing-to-stat window of the race.
// @evidence contracts/testing.md#independent-expectations Totals are the literal byte lengths written by the test: 7 pack bytes, 5 + 9 staging bytes with the lock and the staged file present, and only the 5-byte staged body once they are removed.
// @evidence contracts/testing.md#distinguishing-cases The undisturbed baseline contrasts with a vanished file and a vanished directory, and the depth case shows the absence rule does not excuse an entry that exists and breaks policy.
// @evidence contracts/testing.md#execution-ownership This Go unit test owns a temporary directory and calls accounting directly; it starts no preparation, transfer or external process.
func TestAccountArtifactStore(t *testing.T) {
  populate := func(t *testing.T) *artifactStore {
    store, err := openArtifactStore(t.TempDir(), nil)
    if err != nil {
      t.Fatal(err)
    }
    t.Cleanup(func() { store.close() })
    for name, body := range map[string]string{
      "base/packs/base.pack":                 "packbin",
      "base/staging/base-0123.lock":          "lockowner",
      "base/staging/keep.bin":                "kept!",
      "overlay/staging/transient/partial.bin": "gone",
    } {
      file := filepath.Join(store.path, filepath.FromSlash(name))
      if err := os.MkdirAll(filepath.Dir(file), 0700); err != nil {
        t.Fatal(err)
      }
      if err := os.WriteFile(file, []byte(body), 0600); err != nil {
        t.Fatal(err)
      }
    }
    return store
  }
  removeOnce := func(t *testing.T, store *artifactStore, removals map[string]string) {
    store.accountingListed = func(directory string) {
      target, ok := removals[directory]
      if !ok {
        return
      }
      delete(removals, directory)
      if err := os.RemoveAll(filepath.Join(store.path, filepath.FromSlash(target))); err != nil {
        t.Fatal(err)
      }
    }
  }

  baseline, err := accountArtifactStore(populate(t))
  if err != nil {
    t.Fatal(err)
  }
  if baseline.BaseBytes != 7 || baseline.BaseFiles != 1 || baseline.StagingBytes != 5+9+4 || baseline.StagingFiles != 3 {
    t.Fatalf("baseline accounting: %+v", baseline)
  }

  store := populate(t)
  removals := map[string]string{
    "base/staging":    "base/staging/base-0123.lock",
    "overlay/staging": "overlay/staging/transient",
  }
  removeOnce(t, store, removals)
  vanished, err := accountArtifactStore(store)
  if err != nil {
    t.Fatalf("accounting failed on removed entries: %v", err)
  }
  if len(removals) != 0 {
    t.Fatalf("removals not reached: %v", removals)
  }
  if vanished.BaseBytes != 7 || vanished.BaseFiles != 1 || vanished.StagingBytes != 5 || vanished.StagingFiles != 1 {
    t.Fatalf("accounting kept removed entries: %+v", vanished)
  }

  store = populate(t)
  deep := filepath.Join(store.path, "overlay", "staging", filepath.FromSlash(strings.Repeat("d/", 5)))
  if err := os.MkdirAll(deep, 0700); err != nil {
    t.Fatal(err)
  }
  removeOnce(t, store, map[string]string{"base/staging": "base/staging/base-0123.lock"})
  if _, err := accountArtifactStore(store); err == nil || !strings.Contains(err.Error(), "directory depth policy") {
    t.Fatalf("depth policy not enforced beside a removed entry: %v", err)
  }
}
