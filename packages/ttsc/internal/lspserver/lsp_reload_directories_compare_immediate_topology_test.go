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
//  6. Replace an empty directory with the same topology and prove its identity
//     event still restarts selection.
//  7. Nest one reload directory in another and prove the unchanged parent
//     cannot hide an immediate topology change in the child.
//  8. Rediscover project inputs after topology drift and prove refresh retains
//     the selection-time baseline until the server restarts.
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

  replacementRoot := filepath.Join(root, "replacement-deps")
  if err := os.Mkdir(replacementRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  source.projectInputs = snapshot(replacementRoot)
  if err := os.Remove(replacementRoot); err != nil {
    t.Fatal(err)
  }
  if err := os.Mkdir(replacementRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  if !source.ProjectInputReloadMatchesChange(
    uri(replacementRoot),
    &created,
  ) {
    t.Fatal("same-topology directory replacement did not match its identity event")
  }

  nestedParent := filepath.Join(root, "nested-parent")
  nestedChild := filepath.Join(nestedParent, "child")
  if err := os.MkdirAll(nestedChild, 0o755); err != nil {
    t.Fatal(err)
  }
  nestedSnapshot, err := normalizeLSPProjectInputSnapshot(
    LSPProjectInputSnapshot{
      Root:              root,
      ReloadDirectories: []string{nestedParent, nestedChild},
    },
    root,
  )
  if err != nil {
    t.Fatalf("normalize nested reload directories: %v", err)
  }
  source.projectInputs = nestedSnapshot
  nestedEntry := filepath.Join(nestedChild, "selection.cjs")
  if err := os.WriteFile(nestedEntry, []byte("alpha"), 0o644); err != nil {
    t.Fatal(err)
  }
  if !source.ProjectInputReloadMatchesChange(uri(nestedEntry), &created) {
    t.Fatal("unchanged parent reload directory hid nested topology change")
  }

  refreshRoot := filepath.Join(root, "refresh-deps")
  if err := os.Mkdir(refreshRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  baseline := snapshot(refreshRoot)
  refreshEntry := filepath.Join(refreshRoot, "selection.cjs")
  if err := os.WriteFile(refreshEntry, []byte("alpha"), 0o644); err != nil {
    t.Fatal(err)
  }
  refreshed := snapshot(refreshRoot)
  preserveProjectInputReloadFingerprints(baseline, &refreshed)
  source.projectInputs = refreshed
  if !source.ProjectInputReloadMatchesChange(uri(refreshEntry), &created) {
    t.Fatal("project-input refresh absorbed selection-time topology drift")
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
