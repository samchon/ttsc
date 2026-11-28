//go:build linux || darwin

package lspserver

import (
  "fmt"
  "os"

  "golang.org/x/sys/unix"
)

func initialWorkspaceFileIdentity(pluginWorkspaceFile) os.FileInfo { return nil }

// Reproduce the Node observation using the original pathname and Unix stat.
func (input pluginWorkspaceFile) current() bool {
  var stat unix.Stat_t
  var err error
  if input.Kind == "link" {
    err = unix.Lstat(input.location, &stat)
    if err == nil {
      var target string
      target, err = os.Readlink(input.location)
      if err == nil && target != input.target {
        return false
      }
    }
  } else {
    err = unix.Stat(input.location, &stat)
  }
  if err != nil || (input.Kind == "directory" && stat.Mode&unix.S_IFMT != unix.S_IFDIR) {
    return input.Mode == nil
  }
  if input.Mode == nil || uint32(stat.Mode) != *input.Mode ||
    (input.Device != "" && fmt.Sprint(uint64(stat.Dev)) != input.Device) ||
    (input.Inode != "" && fmt.Sprint(stat.Ino) != input.Inode) {
    return false
  }
  if input.Kind == "directory" {
    if (input.Owner != "" && fmt.Sprint(stat.Uid) != input.Owner) ||
      (input.Group != "" && fmt.Sprint(stat.Gid) != input.Group) {
      return false
    }
    if input.physical != "" {
      physical, err := workspacePhysicalDirectory(input.location)
      return err == nil && physical == input.physical
    }
    return true
  }
  return (input.Size == "" || fmt.Sprint(stat.Size) == input.Size) &&
    (input.Modified == "" || fmt.Sprint(stat.Mtim.Nano()) == input.Modified) &&
    (input.Changed == "" || fmt.Sprint(stat.Ctim.Nano()) == input.Changed)
}
