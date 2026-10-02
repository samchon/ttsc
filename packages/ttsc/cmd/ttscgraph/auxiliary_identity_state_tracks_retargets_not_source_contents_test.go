package main

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
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
// @evidence contracts/testing.md#execution-ownership This Go unit test creates a real directory alias in the test process: a POSIX symlink, or a Windows junction through the windowsjunction helper, which needs no privilege. An unavailable POSIX symlink capability is an explicit skip.
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
    if err := windowsjunction.Create(link, target); err != nil {
      t.Fatalf("directory junction creation failed: %v", err)
    }
    return
  }
  if err := os.Symlink(target, link); err != nil {
    t.Skipf("directory symlink unavailable on this host: %v", err)
  }
}
