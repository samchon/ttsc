package evidence

import (
  "os"
  "runtime"
  "testing"
)

// unreadableDirectory makes one directory refuse to be listed, or skips the
// case when the platform or the user will not let it.
//
// Windows does not express this through the permission bits `os.Chmod` reaches,
// and a process running as root ignores them on POSIX as well, so the state is
// verified rather than assumed. Each refusal says which one it was, because a
// lane that silently stopped denying would otherwise report these cases as
// passing while proving nothing.
//
// Permissions are restored before the test returns. `t.TempDir` removes its
// tree afterwards and cannot descend into a directory it may not read, and
// cleanups run in reverse order of registration, so this one runs first.
func unreadableDirectory(t *testing.T, directory string) {
  t.Helper()
  if runtime.GOOS == "windows" {
    t.Skip("windows does not deny a directory listing through the permission bits os.Chmod reaches")
  }
  if err := os.Chmod(directory, 0); err != nil {
    t.Skipf("this filesystem refused to drop the permissions: %v", err)
  }
  t.Cleanup(func() { _ = os.Chmod(directory, 0o755) })
  if _, err := os.ReadDir(directory); err == nil {
    t.Skip("this process may list a directory with no permission bits, so it is probably root")
  }
}
