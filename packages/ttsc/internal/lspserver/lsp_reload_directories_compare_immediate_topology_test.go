package lspserver

import (
  "net/url"
  "os"
  "path/filepath"
  "testing"
)

// TestLSPReloadDirectoriesCompareImmediateTopology verifies reload-directory
// notifications restart only when the declared non-recursive topology changes.
//
// A directory fingerprint represents resolution identity, not the contents of
// every child. Treating every descendant event as a restart turns ordinary
// edits into crashes, while ignoring directory identity or symlink targets
// leaves contributor selection stale.
//
//  1. Record a directory with one file and one nested directory.
//  2. Prove child-content and nested-descendant edits leave its digest stable.
//  3. Prove immediate creation and deletion change the digest.
//  4. Prove deleting the watched directory itself changes the digest.
//  5. Where supported, retarget a symlink without renaming it and prove the raw
//     link target participates in the digest.
func TestLSPReloadDirectoriesCompareImmediateTopology(t *testing.T) {
  root := t.TempDir()
  reloadDirectory := filepath.Join(root, "config-deps")
  nested := filepath.Join(reloadDirectory, "nested")
  if err := os.MkdirAll(nested, 0o755); err != nil {
    t.Fatal(err)
  }
  selection := filepath.Join(reloadDirectory, "selection.cjs")
  nestedSelection := filepath.Join(nested, "selection.cjs")
  if err := os.WriteFile(selection, []byte("alpha"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(nestedSelection, []byte("alpha"), 0o644); err != nil {
    t.Fatal(err)
  }
  changed := fileChangeTypeChanged
  created := fileChangeTypeCreated
  deleted := fileChangeTypeDeleted
  uri := func(location string) string {
    normalized := filepath.ToSlash(location)
    if filepath.VolumeName(location) != "" {
      normalized = "/" + normalized
    }
    return (&url.URL{Scheme: "file", Path: normalized}).String()
  }
  snapshot := func(directory string) LSPProjectInputSnapshot {
    normalized, err := normalizeLSPProjectInputSnapshot(
      LSPProjectInputSnapshot{
        Root:              root,
        ReloadDirectories: []string{directory},
      },
      root,
    )
    if err != nil {
      t.Fatalf("normalize reload directory: %v", err)
    }
    return normalized
  }
  source := &NativePluginSource{projectInputs: snapshot(reloadDirectory)}

  if err := os.WriteFile(selection, []byte("beta"), 0o644); err != nil {
    t.Fatal(err)
  }
  if source.ProjectInputReloadMatchesChange(uri(selection), &changed) {
    t.Fatal("ordinary child-content edit changed directory topology")
  }
  if err := os.WriteFile(nestedSelection, []byte("beta"), 0o644); err != nil {
    t.Fatal(err)
  }
  if source.ProjectInputReloadMatchesChange(uri(nestedSelection), &changed) {
    t.Fatal("nested descendant edit matched a non-recursive reload directory")
  }

  createdEntry := filepath.Join(reloadDirectory, "created.cjs")
  if err := os.WriteFile(createdEntry, []byte("created"), 0o644); err != nil {
    t.Fatal(err)
  }
  if !source.ProjectInputReloadMatchesChange(uri(createdEntry), &created) {
    t.Fatal("immediate entry creation did not change directory topology")
  }
  source.projectInputs = snapshot(reloadDirectory)
  if err := os.Remove(createdEntry); err != nil {
    t.Fatal(err)
  }
  if !source.ProjectInputReloadMatchesChange(uri(createdEntry), &deleted) {
    t.Fatal("immediate entry deletion did not change directory topology")
  }

  deletionRoot := filepath.Join(root, "deleted-deps")
  if err := os.Mkdir(deletionRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  source.projectInputs = snapshot(deletionRoot)
  if err := os.Remove(deletionRoot); err != nil {
    t.Fatal(err)
  }
  if !source.ProjectInputReloadMatchesChange(uri(deletionRoot), &deleted) {
    t.Fatal("reload-directory deletion did not change its topology state")
  }

  firstTarget := filepath.Join(root, "first-target")
  secondTarget := filepath.Join(root, "second-target")
  for _, target := range []string{firstTarget, secondTarget} {
    if err := os.Mkdir(target, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  link := filepath.Join(reloadDirectory, "selection-link")
  if err := os.Symlink(firstTarget, link); err == nil {
    source.projectInputs = snapshot(reloadDirectory)
    if err := os.Remove(link); err != nil {
      t.Fatal(err)
    }
    if err := os.Symlink(secondTarget, link); err != nil {
      t.Fatalf("retarget symlink: %v", err)
    }
    if !source.ProjectInputReloadMatchesChange(uri(link), &changed) {
      t.Fatal("symlink retarget did not change directory topology")
    }
  }
}
