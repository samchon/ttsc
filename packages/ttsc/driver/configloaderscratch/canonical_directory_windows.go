//go:build windows

package configloaderscratch

import (
  "path/filepath"
  "strings"

  "golang.org/x/sys/windows"
)

// canonicalDirectory returns the opened directory's final filesystem path,
// including through NTFS junction ancestors that EvalSymlinks can leave intact.
func canonicalDirectory(path string) (string, error) {
  pointer, err := windows.UTF16PtrFromString(path)
  if err != nil {
    return "", err
  }
  handle, err := windows.CreateFile(
    pointer,
    windows.FILE_READ_ATTRIBUTES,
    windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
    nil,
    windows.OPEN_EXISTING,
    windows.FILE_FLAG_BACKUP_SEMANTICS,
    0,
  )
  if err != nil {
    return "", err
  }
  defer windows.CloseHandle(handle)

  buffer := make([]uint16, windows.MAX_PATH)
  for {
    length, err := windows.GetFinalPathNameByHandle(handle, &buffer[0], uint32(len(buffer)), 0)
    if err != nil {
      return "", err
    }
    if length < uint32(len(buffer)) {
      resolved := windows.UTF16ToString(buffer[:length])
      if strings.HasPrefix(resolved, `\\?\UNC\`) {
        resolved = `\\` + strings.TrimPrefix(resolved, `\\?\UNC\`)
      } else {
        resolved = strings.TrimPrefix(resolved, `\\?\`)
      }
      return filepath.Clean(resolved), nil
    }
    buffer = make([]uint16, length+1)
  }
}

// containsDirectory compares Windows path spelling after final-path resolution.
func containsDirectory(base, child string) (bool, error) {
  relative, err := filepath.Rel(base, child)
  if err != nil {
    return false, err
  }
  return relative == "." ||
    (relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)) && !filepath.IsAbs(relative)), nil
}
