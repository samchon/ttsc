package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDiscoverConfigFileReportsEveryCandidateItRejected verifies the upward
// config search returns the candidates it probed and did not find, not only the
// file it settled on.
//
// Those paths decide the result as much as the match does: one created nearer
// the entry wins the next search outright, and one created beside the match
// makes that directory ambiguous. A consumer that never hears about them keeps
// serving output built from a config a cold run would no longer choose
// (samchon/ttsc#1271). The search must also stop at the first directory that
// answers, so a candidate above the match is neither probed nor reported.
func TestDiscoverConfigFileReportsEveryCandidateItRejected(t *testing.T) {
  root := t.TempDir()
  nested := filepath.Join(root, "packages", "app")
  writeProjectFile(t, root, filepath.Join("packages", "app", "index.ts"), "export {};\n")
  writeProjectFile(t, root, "demo.config.json", "{}\n")

  discovery := driver.DiscoverConfigFile(nested, []string{"demo.config.json", "demo.config.ts"})

  if len(discovery.Matches) != 1 || discovery.Matches[0] != filepath.Join(root, "demo.config.json") {
    t.Fatalf("expected the root config to match, got %v", discovery.Matches)
  }
  if discovery.Directory != root {
    t.Fatalf("expected the matching directory to be %q, got %q", root, discovery.Directory)
  }
  expected := map[string]struct{}{
    // The entry's own directory answered nothing, so both of its candidates can
    // supersede the match.
    filepath.Join(nested, "demo.config.json"): {},
    filepath.Join(nested, "demo.config.ts"):   {},
    // So can the directory between it and the match.
    filepath.Join(root, "packages", "demo.config.json"): {},
    filepath.Join(root, "packages", "demo.config.ts"):   {},
    // And the name the matching directory does not carry yet, which would make
    // that directory ambiguous.
    filepath.Join(root, "demo.config.ts"): {},
  }
  if len(discovery.Probed) != len(expected) {
    t.Fatalf("expected %d rejected candidates, got %d: %v", len(expected), len(discovery.Probed), discovery.Probed)
  }
  for _, candidate := range discovery.Probed {
    if _, ok := expected[candidate.Path]; !ok {
      t.Fatalf("unexpected rejected candidate %q in %v", candidate.Path, discovery.Probed)
    }
    if candidate.Directory {
      t.Fatalf("expected %q classified as absent, not as a directory", candidate.Path)
    }
  }
}
