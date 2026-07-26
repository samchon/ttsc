//go:build windows

package lspserver

import (
  "path/filepath"
  "strings"
  "sync"
  "unsafe"

  "golang.org/x/sys/windows"
)

var projectInputCaseSensitiveDirectories sync.Map

// projectInputPathKey resolves existing spelling through the filesystem and
// applies case folding only to a missing suffix beneath a case-insensitive
// directory. Windows case semantics are per directory, not per volume or OS.
func projectInputPathKey(location string) string {
  normalized := filepath.Clean(projectInputFilesystemPath(location))
  if !filepath.IsAbs(normalized) {
    return strings.ToLower(filepath.ToSlash(normalized))
  }

  probe := normalized
  missing := []string{}
  for {
    physical, err := filepath.EvalSymlinks(probe)
    if err == nil {
      physical = filepath.Clean(physical)
      if len(missing) == 0 {
        return filepath.ToSlash(physical)
      }
      sensitive := projectInputDirectoryIsCaseSensitive(physical)
      for index := len(missing) - 1; index >= 0; index-- {
        segment := missing[index]
        if !sensitive {
          segment = strings.ToLower(segment)
        }
        physical = filepath.Join(physical, segment)
      }
      return filepath.ToSlash(physical)
    }
    parent := filepath.Dir(probe)
    if parent == probe {
      return strings.ToLower(filepath.ToSlash(normalized))
    }
    missing = append(missing, filepath.Base(probe))
    probe = parent
  }
}

func projectInputDirectoryIsCaseSensitive(directory string) bool {
  key := filepath.Clean(directory)
  if cached, ok := projectInputCaseSensitiveDirectories.Load(key); ok {
    return cached.(bool)
  }

  sensitive := queryProjectInputDirectoryCaseSensitivity(key)
  projectInputCaseSensitiveDirectories.Store(key, sensitive)
  return sensitive
}

func queryProjectInputDirectoryCaseSensitivity(directory string) bool {
  pointer, err := windows.UTF16PtrFromString(directory)
  if err != nil {
    return false
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
    return false
  }
  defer windows.CloseHandle(handle)

  var flags uint32
  if err := windows.GetFileInformationByHandleEx(
    handle,
    windows.FileCaseSensitiveInfo,
    (*byte)(unsafe.Pointer(&flags)),
    uint32(unsafe.Sizeof(flags)),
  ); err != nil {
    return false
  }
  return flags&windows.FILE_CS_FLAG_CASE_SENSITIVE_DIR != 0
}
