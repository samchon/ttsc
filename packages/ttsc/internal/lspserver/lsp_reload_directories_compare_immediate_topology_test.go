package lspserver

import (
  "errors"
  "net/url"
  "os"
  "path/filepath"
  "runtime"
  "syscall"
  "testing"
)

// TestLSPReloadDirectoriesCompareImmediateTopology verifies reload-directory
// direct reload-policy results distinguish the authored native mutations.
//
// A directory fingerprint represents resolution identity, not the contents of
// every child. This test observes policy booleans after real mutations, not an
// actual notification, server restart, crash or contributor-selection reload.
//
//  1. Require no match for child-content and undeclared nested-descendant edits.
//  2. Require matches for immediate create/delete and directory delete/replace.
//  3. Require a declared nested child and preserved older baseline to match drift.
//  4. Where privilege permits, require a symlink retarget to match.
//
// @evidence contracts/testing.md#behavioral-verification Direct ProjectInputReloadMatchesChange calls return false for two content edits and true for immediate create/delete, directory delete/replace, a declared nested child's creation, drift after explicit baseline preservation and the conditional symlink retarget. Directory-self matches are identity policy, not assertions that its digest changed.
// @evidence contracts/testing.md#independent-expectations Each mutation has an authored literal true/false expectation rather than an expected digest computed by the SUT. Snapshots establish actual stored baselines; no particular hash value or client event/restart behavior is certified.
// @evidence contracts/testing.md#distinguishing-cases Content versus immediate topology, undeclared versus declared nested territory, same-topology directory replacement and retained versus recomputed baseline are distinguished by supplied operations. The symlink subtest reports Windows privilege-only unavailability explicitly instead of silently omitting it.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit runs actual normalizer, fingerprint preservation and reload matcher over owned temporary native files/directories. It starts no child, installs no consumer or host and substitutes no operation. The symlink lane skips only Windows privilege-not-held; other fixture errors fail.
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

  firstTarget := filepath.Join(root, "first-target")
  secondTarget := filepath.Join(root, "second-target")
  for _, target := range []string{firstTarget, secondTarget} {
    if err := os.Mkdir(target, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  link := filepath.Join(reloadDirectory, "selection-link")
  t.Run("symlink retarget", func(t *testing.T) {
    if err := os.Symlink(firstTarget, link); err != nil {
      if runtime.GOOS == "windows" && errors.Is(err, syscall.Errno(1314)) {
        t.Skipf("Windows symlink privilege is unavailable: %v", err)
      }
      t.Fatalf("create owned symlink: %v", err)
    }
    linkSnapshot, err := normalizeLSPProjectInputSnapshot(LSPProjectInputSnapshot{
      Root: root,
      ReloadDirectories: []string{reloadDirectory},
    }, root)
    if err != nil {
      t.Fatalf("normalize symlink reload directory: %v", err)
    }
    source.projectInputs = linkSnapshot
    if err := os.Remove(link); err != nil {
      t.Fatal(err)
    }
    if err := os.Symlink(secondTarget, link); err != nil {
      t.Fatalf("retarget symlink: %v", err)
    }
    if !source.ProjectInputReloadMatchesChange(uri(link), &changed) {
      t.Fatal("symlink retarget did not change directory topology")
    }
  })
}
