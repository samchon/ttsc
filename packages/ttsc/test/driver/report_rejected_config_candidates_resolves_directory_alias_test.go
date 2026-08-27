package driver_test

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestReportRejectedConfigCandidatesResolvesDirectoryAlias verifies a lexical
// alias is never published as a directory candidate's physical identity.
//
// Plugin discovery and the linked native plugin observe the same candidate in
// two stages. The JavaScript stage reports a realpath. If this Go stage reports
// the symlink spelling instead, the envelope merge drops the conflicting proof
// and every persistent adapter recompiles the whole project per module.
func TestReportRejectedConfigCandidatesResolvesDirectoryAlias(t *testing.T) {
  root := t.TempDir()
  targetRoot := filepath.Join(root, "physical")
  target := filepath.Join(targetRoot, "demo.config.json")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  aliasRoot := filepath.Join(root, "alias")
  if err := os.Symlink(targetRoot, aliasRoot); err != nil {
    t.Skipf("directory symlink is unavailable: %v", err)
  }
  alias := filepath.Join(aliasRoot, "demo.config.json")
  physical, err := filepath.EvalSymlinks(alias)
  if err != nil {
    t.Fatal(err)
  }

  var reported *string
  driver.ReportRejectedConfigCandidates(
    []driver.ConfigCandidate{{Directory: true, Path: alias}},
    nil,
    func(_ string, realpath *string) { reported = realpath },
  )

  if reported == nil {
    t.Fatalf("expected physical target %q, got no proof", physical)
  }
  if *reported != filepath.Clean(physical) {
    t.Fatalf("expected physical target %q, got %q", physical, *reported)
  }
}
