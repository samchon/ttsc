package lspserver

import (
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "syscall"
  "unsafe"

  "golang.org/x/sys/windows"
)

func initialWorkspaceFileIdentity(pluginWorkspaceFile) os.FileInfo { return nil }

// Windows file times are 100 ns ticks from January 1601.
func workspaceWindowsNanoseconds(value int64) int64 {
  time := syscall.Filetime{LowDateTime: uint32(value), HighDateTime: uint32(uint64(value) >> 32)}
  return time.Nanoseconds()
}

// Read the same Windows volume, file identity and change times that Node
// obtains through libuv, opening the reparse point itself for link metadata.
func workspaceWindowsPath(location string) string {
  location = filepath.Clean(location)
  if !strings.HasPrefix(location, `\\?\`) {
    if tail, ok := strings.CutPrefix(location, `\\`); ok {
      location = `\\?\UNC\` + tail
    } else {
      location = `\\?\` + location
    }
  }
  return location
}

func (input pluginWorkspaceFile) current() bool {
  location := workspaceWindowsPath(input.location)
  name, err := windows.UTF16PtrFromString(location)
  if err != nil {
    return false
  }
  flags := uint32(windows.FILE_FLAG_BACKUP_SEMANTICS)
  if input.Kind == "link" {
    flags |= windows.FILE_FLAG_OPEN_REPARSE_POINT
  }
  handle, err := windows.CreateFile(name, windows.FILE_READ_ATTRIBUTES,
    windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
    nil, windows.OPEN_EXISTING, flags, 0)
  if err != nil {
    if input.Kind != "link" &&
      (err == windows.ERROR_ACCESS_DENIED || err == windows.ERROR_SHARING_VIOLATION) {
      info, ok := windowsWorkspaceParentMetadata(location)
      if ok {
        if !input.matchesWindowsMetadata(info) {
          return false
        }
        if input.physical == "" {
          return true
        }
        handle, err := windows.CreateFile(name, 0,
          windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
          nil, windows.OPEN_EXISTING, flags, 0)
        if err != nil {
          return false
        }
        defer windows.CloseHandle(handle)
        return input.windowsPhysicalDirectoryCurrent(handle)
      }
    }
    return input.Mode == nil
  }
  defer windows.CloseHandle(handle)
  var info windows.ByHandleFileInformation
  if windows.GetFileInformationByHandle(handle, &info) != nil {
    return input.Mode == nil
  }
  directory := info.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0
  if input.Kind == "directory" && !directory {
    return input.Mode == nil
  }
  if input.Kind == "link" {
    target, err := os.Readlink(input.location)
    if err != nil {
      return input.Mode == nil
    }
    if target != input.target {
      return false
    }
  }
  metadata := workspaceWindowsMetadata{
    attributes: info.FileAttributes,
    device:     info.VolumeSerialNumber,
    inode:      uint64(info.FileIndexHigh)<<32 | uint64(info.FileIndexLow),
    size:       uint64(info.FileSizeHigh)<<32 | uint64(info.FileSizeLow),
    modified:   info.LastWriteTime.Nanoseconds(),
  }
  if input.Changed != "" {
    var basic struct {
      creation, access, modified, changed int64
      attributes                          uint32
      _                                   uint32
    }
    err = windows.GetFileInformationByHandleEx(handle, windows.FileBasicInfo,
      (*byte)(unsafe.Pointer(&basic)), uint32(unsafe.Sizeof(basic)))
    if err != nil {
      return false
    }
    metadata.changed = basic.changed
  }
  return input.matchesWindowsMetadata(metadata) && input.windowsPhysicalDirectoryCurrent(handle)
}

type workspaceWindowsMetadata struct {
  attributes, device uint32
  inode, size        uint64
  modified, changed  int64
}

func (input pluginWorkspaceFile) matchesWindowsMetadata(info workspaceWindowsMetadata) bool {
  directory := info.attributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0
  if input.Kind == "directory" && !directory {
    return input.Mode == nil
  }
  typeMode := uint32(0o100000)
  if input.Kind == "link" {
    typeMode = 0o120000
  } else if directory {
    typeMode = 0o040000
  }
  return input.Mode != nil && *input.Mode&0o170000 == typeMode &&
    (*input.Mode&0o200 == 0) == (info.attributes&windows.FILE_ATTRIBUTE_READONLY != 0) &&
    (input.Device == "" || fmt.Sprint(info.device) == input.Device) &&
    (input.Inode == "" || fmt.Sprint(info.inode) == input.Inode) &&
    (directory || input.Kind == "link" || input.Size == "" || fmt.Sprint(info.size) == input.Size) &&
    (input.Modified == "" || fmt.Sprint(info.modified) == input.Modified) &&
    (input.Changed == "" || fmt.Sprint(workspaceWindowsNanoseconds(info.changed)) == input.Changed)
}

// Compare the final DOS spelling, including the actual case and UNC form.
func (input pluginWorkspaceFile) windowsPhysicalDirectoryCurrent(handle windows.Handle) bool {
  if input.physical == "" {
    return true
  }
  buffer := make([]uint16, windows.MAX_PATH)
  for {
    length, err := windows.GetFinalPathNameByHandle(handle, &buffer[0], uint32(len(buffer)), 0)
    if err != nil {
      return false
    }
    if length < uint32(len(buffer)) {
      return projectInputFilesystemPath(windows.UTF16ToString(buffer[:length])) == input.physical
    }
    buffer = make([]uint16, length+1)
  }
}
