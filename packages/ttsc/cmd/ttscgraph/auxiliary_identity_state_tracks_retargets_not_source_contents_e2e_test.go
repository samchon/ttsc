//go:build e2e

package main

import (
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "testing"
)

// TestAuxiliaryIdentityStateTracksRetargetsNotSourceContents proves the two
// owners of a selected lexical module path stay separate:
//
//  1. ordinary source bytes are owned by graphSession.sourceHashes, so an
//     identity-only auxiliary state must not turn their edit into a reload;
//  2. retargeting the same lexical symlink or junction must invalidate even
//     when the old and new target bytes agree.
//
// 1. Capture identity-only state through an actual directory alias.
// 2. Edit source bytes, then recreate the alias against the equal-byte target.
// 3. Contrast invalidation decisions and content-sensitive duplicate priority.
//
// @evidence contracts/testing.md#behavioral-verification Actual captureDiskStates and diskStatesChanged observe a lexical directory alias before and after a source-byte edit and a physical retarget; compactAuxiliaryInputs checks duplicate ownership.
// @evidence contracts/testing.md#independent-expectations Literal equal target bytes define the retarget control, while the first target's changed bytes must not invalidate identity-only state. Explicit duplicate inputs require the content-sensitive entry to win.
// @evidence contracts/testing.md#distinguishing-cases Source-content edit versus same-byte physical retarget distinguishes content from identity ownership; a duplicate identity-only/content-sensitive path verifies compaction priority.
// @evidence contracts/testing.md#execution-ownership This Go E2E entry uses real POSIX symlinks or actual Windows Node junction creation. CombinedOutput joins each Node child; unavailable native alias capability is an explicit skipped boundary.
// @evidence contracts/e2e.md#necessary-boundary A real symlink or junction retarget changes native path identity despite equal bytes, which an in-memory path unit cannot prove. The source edit is the adjacent transition that must not invalidate this owner.
// @evidence contracts/e2e.md#shared-execution One fixture and Go host serve both target transitions and the compaction control. Windows uses two joined one-shot Node helpers for the initial junction and its recreated target; POSIX uses direct symlink calls, without compiler or product builds.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns both target directories and the alias. It joins each Windows helper before observing state, deletes only its own alias before recreating it, and TempDir cleanup owns the remaining fixture.
// @evidence contracts/e2e.md#preserved-coverage The original initial-state, source-byte noninvalidation, same-byte retarget invalidation and content-sensitive duplicate assertions remain. Windows junction and POSIX symlink execution are separate actual platform capabilities; skips are not promoted to coverage.
func TestAuxiliaryIdentityStateTracksRetargetsNotSourceContents(t *testing.T) {
  root := t.TempDir()
  first := filepath.Join(root, "first")
  second := filepath.Join(root, "second")
  if err := os.MkdirAll(first, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.MkdirAll(second, 0o755); err != nil {
    t.Fatal(err)
  }
  for _, directory := range []string{first, second} {
    if err := os.WriteFile(filepath.Join(directory, "selection.ts"), []byte("export const value = 1;\n"), 0o644); err != nil {
      t.Fatal(err)
    }
  }

  link := filepath.Join(root, "linked")
  createAuxiliaryDirectoryLink(t, first, link)
  selected := filepath.Join(link, "selection.ts")
  previous := captureDiskStates([]auxiliaryInput{{path: selected, identityOnly: true}})
  initial := previous[selected]
  if !initial.Exists || initial.Realpath == "" || !initial.IdentityOnly {
    t.Fatalf("initial identity state = %+v", initial)
  }

  if err := os.WriteFile(filepath.Join(first, "selection.ts"), []byte("export const value = 2;\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if diskStatesChanged(previous) {
    t.Fatal("selected source contents leaked into identity-only auxiliary invalidation")
  }

  if err := os.Remove(link); err != nil {
    t.Fatal(err)
  }
  createAuxiliaryDirectoryLink(t, second, link)
  if !diskStatesChanged(previous) {
    t.Fatal("same-byte lexical link retarget did not invalidate its physical identity")
  }

  merged := compactAuxiliaryInputs([]auxiliaryInput{
    {path: selected, identityOnly: true},
    {path: selected},
  })
  if len(merged) != 1 || merged[0].identityOnly {
    t.Fatalf("content-sensitive duplicate did not win: %+v", merged)
  }
}

func createAuxiliaryDirectoryLink(t *testing.T, target, link string) {
  t.Helper()
  if runtime.GOOS == "windows" {
    command := exec.Command(
      "node",
      "-e",
      `require("node:fs").symlinkSync(process.argv[1], process.argv[2], "junction")`,
      target,
      link,
    )
    if output, err := command.CombinedOutput(); err != nil {
      t.Skipf("directory junction unavailable on this host: %v: %s", err, output)
    }
    return
  }
  if err := os.Symlink(target, link); err != nil {
    t.Skipf("directory symlink unavailable on this host: %v", err)
  }
}
