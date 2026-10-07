package evidence

import (
  "os"
  "os/exec"
  "os/user"
  "runtime"
  "testing"
)

// unreadableDirectory makes one directory refuse to be listed, or skips the
// case when the platform or the user will not let it.
//
// POSIX drops the permission bits. Windows ignores those bits, so it denies the
// current user the list-directory right with an access-control entry on a
// directory the test owns, which needs no elevation, and removes that entry
// again in cleanup. A process running as root ignores either form, so the state
// is verified rather than assumed. Each refusal says which one it was, because a
// lane that silently stopped denying would otherwise report these cases as
// passing while proving nothing.
//
// Permissions are restored before the test returns. `t.TempDir` removes its
// tree afterwards and cannot descend into a directory it may not read, and
// cleanups run in reverse order of registration, so this one runs first.
func unreadableDirectory(t *testing.T, directory string) {
  t.Helper()
  if runtime.GOOS == "windows" {
    denyWindowsListing(t, directory)
  } else {
    if err := os.Chmod(directory, 0); err != nil {
      t.Skipf("this filesystem refused to drop the permissions: %v", err)
    }
    t.Cleanup(func() { _ = os.Chmod(directory, 0o755) })
  }
  if _, err := os.ReadDir(directory); err == nil {
    t.Skip("this process may still list the directory after the denial, so the condition cannot be reproduced here")
  }
}

// denyWindowsListing adds a deny entry for the current user's SID, so the
// entry does not depend on how the account name is spelled.
func denyWindowsListing(t *testing.T, directory string) {
  t.Helper()
  current, err := user.Current()
  if err != nil {
    t.Skipf("the current user could not be resolved, so a directory listing cannot be denied: %v", err)
  }
  principal := "*" + current.Uid
  if output, err := exec.Command("icacls", directory, "/deny", principal+":(RD)").CombinedOutput(); err != nil {
    t.Skipf("icacls refused to deny the listing, so the condition cannot be reproduced here: %v: %s", err, output)
  }
  t.Cleanup(func() {
    if output, err := exec.Command("icacls", directory, "/remove:d", principal).CombinedOutput(); err != nil {
      t.Errorf("the deny entry on %s was not removed: %v: %s", directory, err, output)
    }
  })
}
