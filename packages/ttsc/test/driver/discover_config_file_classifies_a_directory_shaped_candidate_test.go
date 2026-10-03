package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDiscoverConfigFileClassifiesADirectoryShapedCandidate verifies a
// directory wearing a config file's name is rejected as a directory rather than
// as an absent path.
//
// The two are different observations to the host-input contract: an absent path
// is recorded by a nil hash, an existing directory by the directory-kind digest
// and its physical path, so that replacing it with a real config invalidates the
// generation. Reporting the directory as absent instead leaves every consumer
// comparing nil against a digest its own filesystem keeps producing, and the
// generation is refused on every delivery for the rest of its life.
//
// 1. Create an actual config beside a directory named as another config candidate.
// 2. Discover the config and compare the selected path and rejected directory kind with the authored paths.
//
// @evidence contracts/testing.md#behavioral-verification Calls DiscoverConfigFile on an actual config and a directory wearing an alternate config name; exact matches and rejected path/kind are asserted.
// @evidence contracts/testing.md#independent-expectations The authored regular JSON file and directory named demo.config.ts independently establish one match and one directory rejection.
// @evidence contracts/testing.md#distinguishing-cases Existing directory versus regular config distinguishes directory observation from absence; the sibling case owns absent upward candidates.
// @evidence contracts/testing.md#execution-ownership This direct driver Go unit searches its private t.TempDir filesystem in process without a compiler or CLI child.
func TestDiscoverConfigFileClassifiesADirectoryShapedCandidate(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "demo.config.json", "{}\n")
  directoryCandidate := filepath.Join(root, "demo.config.ts")
  writeProjectFile(t, root, filepath.Join("demo.config.ts", "keep.txt"), "")

  discovery := driver.DiscoverConfigFile(root, []string{"demo.config.json", "demo.config.ts"})

  if len(discovery.Matches) != 1 || discovery.Matches[0] != filepath.Join(root, "demo.config.json") {
    t.Fatalf("a directory must not be taken for a config file, got %v", discovery.Matches)
  }
  if len(discovery.Probed) != 1 {
    t.Fatalf("expected the directory as the only rejected candidate, got %v", discovery.Probed)
  }
  if discovery.Probed[0].Path != directoryCandidate || !discovery.Probed[0].Directory {
    t.Fatalf("expected %q classified as a directory, got %+v", directoryCandidate, discovery.Probed[0])
  }
}
