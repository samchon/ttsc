//go:build windows

package evidence

import (
  "path/filepath"
  "strings"

  "golang.org/x/sys/windows"
)

// linkedPopulationPhysicalRoot queries the opened native directory's final path.
// Go's EvalSymlinks does not traverse every directory junction, so that API
// cannot establish physical fixture ancestry here. Windows supplies the native
// spelling; only its extended drive/UNC transport prefix is converted.
// The function owns and closes its attribute-only handle on every return.
func linkedPopulationPhysicalRoot(location string) (resolved string, err error) {
  pointer, err := windows.UTF16PtrFromString(location)
  if err != nil {
    return "", err
  }
  handle, err := windows.CreateFile(
    pointer, windows.FILE_READ_ATTRIBUTES,
    windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
    nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS, 0,
  )
  if err != nil {
    return "", err
  }
  defer func() {
    if closeErr := windows.CloseHandle(handle); err == nil {
      err = closeErr
    }
  }()
  buffer := make([]uint16, windows.MAX_PATH)
  for {
    length, queryErr := windows.GetFinalPathNameByHandle(handle, &buffer[0], uint32(len(buffer)), 0)
    if queryErr != nil {
      return "", queryErr
    }
    if length < uint32(len(buffer)) {
      resolved = windows.UTF16ToString(buffer[:length])
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
