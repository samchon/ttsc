package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestReportRejectedConfigCandidatesRecordsEachInItsOwnState verifies the two
// halves of a host-input observation are reported together and in the state the
// candidate was actually found in.
//
// A consumer needs both: with only the hash it cannot attach the observation to
// a physical target and declines narrow reuse, and with only the path it has no
// state to compare at all. An absent candidate carries the paired nils, while a
// directory carries the directory-kind digest and its own physical path.
func TestReportRejectedConfigCandidatesRecordsEachInItsOwnState(t *testing.T) {
  root := t.TempDir()
  absent := filepath.Join(root, "demo.config.ts")
  directory := filepath.Join(root, "demo.config.json")
  disappearedDirectory := filepath.Join(root, "gone.config.json")
  writeProjectFile(t, root, filepath.Join("demo.config.json", "keep.txt"), "")
  hashes := map[string]*string{}
  realpaths := map[string]*string{}

  driver.ReportRejectedConfigCandidates(
    []driver.ConfigCandidate{
      {Path: absent},
      {Directory: true, Path: directory},
      {Directory: true, Path: disappearedDirectory},
    },
    func(file string, hash *string) { hashes[file] = hash },
    func(file string, realpath *string) { realpaths[file] = realpath },
  )

  if len(hashes) != 3 || len(realpaths) != 3 {
    t.Fatalf("expected both halves for every candidate, got %v and %v", hashes, realpaths)
  }
  if hashes[absent] != nil || realpaths[absent] != nil {
    t.Fatalf("an absent candidate must be reported as absent, got %v and %v", hashes[absent], realpaths[absent])
  }
  if hashes[directory] == nil || realpaths[directory] == nil {
    t.Fatalf("a directory candidate must carry both proofs, got %v and %v", hashes[directory], realpaths[directory])
  }
  physical, err := filepath.EvalSymlinks(directory)
  if err != nil {
    t.Fatal(err)
  }
  if *realpaths[directory] != filepath.Clean(physical) {
    t.Fatalf("expected the directory's physical path %q, got %q", physical, *realpaths[directory])
  }
  if *hashes[directory] == "" {
    t.Fatalf("expected the directory-kind digest, got an empty hash")
  }
  if hashes[disappearedDirectory] == nil || realpaths[disappearedDirectory] != nil {
    t.Fatalf(
      "a vanished directory must keep its observed kind without fabricated physical proof, got %v and %v",
      hashes[disappearedDirectory],
      realpaths[disappearedDirectory],
    )
  }
}
