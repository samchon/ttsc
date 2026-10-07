package evidence

import (
  "os"
  "testing"
)

/**
 * Verifies a real directory resolves to the directory it is.
 *
 * The case above judges spellings, which only a path nothing has made real can
 * be judged by. A directory that exists is the other half, and it is asked the
 * other question: an absent path ends every chain at its first `os.Lstat`,
 * while a present one walks the resolver's whole body at every component. What
 * it must answer is the same directory, not the same string — a platform whose
 * temporary directory sits behind a link of its own, as macOS's `/var` does,
 * changes the spelling for the very reason this resolution exists.
 *
 *  1. Take a real directory this platform allocated.
 *  2. Resolve it.
 *  3. Assert the answer is the same directory the filesystem knows.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveLinkedPath settles a real temporary directory and its returned path opens the same directory.
 * @evidence contracts/testing.md#independent-expectations os.SameFile compares operating-system file identity independently of the resolver spelling.
 * @evidence contracts/testing.md#distinguishing-cases A real existing directory complements hypothetical no-link paths whose identity cannot be opened.
 * @evidence contracts/testing.md#execution-ownership TestARealDirectoryResolvesToTheDirectoryItIs allocates its own t.TempDir, calls resolveLinkedPath and compares actual os.Stat identities with os.SameFile in one Go process. It creates no symbolic link, consumer or native compiler; t.TempDir owns fixture cleanup.
 */
func TestARealDirectoryResolvesToTheDirectoryItIs(t *testing.T) {
  directory := t.TempDir()
  resolved, ok := resolveLinkedPath(directory)
  if !ok {
    t.Fatalf("resolving '%s' must settle", directory)
  }
  declared, err := os.Stat(directory)
  if err != nil {
    t.Fatal(err)
  }
  answered, err := os.Stat(resolved)
  if err != nil {
    t.Fatalf("resolving '%s' gave '%s', which does not open: %v", directory, resolved, err)
  }
  if !os.SameFile(declared, answered) {
    t.Fatalf("resolving '%s' gave '%s', which is another directory", directory, resolved)
  }
}
