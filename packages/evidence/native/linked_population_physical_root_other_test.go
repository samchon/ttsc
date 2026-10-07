//go:build !windows

package evidence

import "path/filepath"

// linkedPopulationPhysicalRoot resolves POSIX symlink ancestry before a fixture
// measures its own link count. Native errors remain preparation failures.
func linkedPopulationPhysicalRoot(location string) (string, error) {
  return filepath.EvalSymlinks(location)
}
