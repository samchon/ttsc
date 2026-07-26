//go:build windows

package lspserver

import (
  "path/filepath"
  "strings"
  "unsafe"

  "golang.org/x/sys/windows"
)

type windowsProjectInputPath struct {
  found    bool
  missing  []string
  physical string
}

// projectInputPathKey resolves existing spelling through the filesystem and
// applies case folding to each segment according to the directory that owns
// that name. Windows case semantics are per directory, not per volume or OS.
func projectInputPathKey(location string) string {
  normalized := filepath.Clean(projectInputFilesystemPath(location))
  if !filepath.IsAbs(normalized) {
    return strings.ToLower(filepath.ToSlash(normalized))
  }
  volume := filepath.VolumeName(normalized)
  segments := splitWindowsProjectInputSegments(
    strings.TrimPrefix(normalized, volume),
  )
  current := windowsProjectInputVolumeRoot(volume)
  sensitive := false
  for index, segment := range segments {
    if currentSensitivity, ok :=
      tryQueryProjectInputDirectoryCaseSensitivity(current); ok {
      sensitive = currentSensitivity
    }
    if !sensitive {
      segments[index] = strings.ToLower(segments[index])
    }
    current = filepath.Join(current, segment)
  }
  return windowsProjectInputKey(normalized, segments)
}

func resolveWindowsProjectInputPath(location string) windowsProjectInputPath {
  normalized := filepath.Clean(projectInputFilesystemPath(location))
  if !filepath.IsAbs(normalized) {
    return windowsProjectInputPath{physical: normalized}
  }
  probe := normalized
  missing := []string{}
  for {
    physical, err := filepath.EvalSymlinks(probe)
    if err == nil {
      return windowsProjectInputPath{
        found:    true,
        missing:  reverseWindowsProjectInputSegments(missing),
        physical: filepath.Clean(physical),
      }
    }
    parent := filepath.Dir(probe)
    if parent == probe {
      return windowsProjectInputPath{physical: normalized}
    }
    missing = append(missing, filepath.Base(probe))
    probe = parent
  }
}

func windowsProjectInputSegments(
  resolved windowsProjectInputPath,
) ([]string, []bool) {
  volume := filepath.VolumeName(resolved.physical)
  existing := splitWindowsProjectInputSegments(
    strings.TrimPrefix(resolved.physical, volume),
  )
  segments := append(append([]string{}, existing...), resolved.missing...)
  sensitivities := make([]bool, 0, len(segments))
  current := windowsProjectInputVolumeRoot(volume)
  for _, segment := range existing {
    sensitivities = append(
      sensitivities,
      queryProjectInputDirectoryCaseSensitivity(current),
    )
    current = filepath.Join(current, segment)
  }
  if len(resolved.missing) != 0 {
    missingSensitivity := queryProjectInputDirectoryCaseSensitivity(
      resolved.physical,
    )
    for range resolved.missing {
      sensitivities = append(sensitivities, missingSensitivity)
    }
  }
  return segments, sensitivities
}

func windowsProjectInputKey(location string, segments []string) string {
  volume := filepath.VolumeName(location)
  prefix := strings.ToLower(filepath.ToSlash(volume))
  if len(segments) == 0 {
    return prefix + "/"
  }
  return prefix + "/" + strings.Join(segments, "/")
}

func windowsProjectInputVolumeRoot(volume string) string {
  if strings.HasSuffix(volume, `\`) || strings.HasSuffix(volume, "/") {
    return volume
  }
  return volume + `\`
}

func splitWindowsProjectInputSegments(location string) []string {
  return strings.FieldsFunc(location, func(character rune) bool {
    return character == '/' || character == '\\'
  })
}

func reverseWindowsProjectInputSegments(segments []string) []string {
  reversed := make([]string, len(segments))
  for index := range segments {
    reversed[len(segments)-index-1] = segments[index]
  }
  return reversed
}

func queryProjectInputDirectoryCaseSensitivity(directory string) bool {
  sensitive, _ := tryQueryProjectInputDirectoryCaseSensitivity(directory)
  return sensitive
}

func tryQueryProjectInputDirectoryCaseSensitivity(
  directory string,
) (bool, bool) {
  pointer, err := windows.UTF16PtrFromString(directory)
  if err != nil {
    return false, false
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
    return false, false
  }
  defer windows.CloseHandle(handle)

  var flags uint32
  if err := windows.GetFileInformationByHandleEx(
    handle,
    windows.FileCaseSensitiveInfo,
    (*byte)(unsafe.Pointer(&flags)),
    uint32(unsafe.Sizeof(flags)),
  ); err != nil {
    return false, false
  }
  return flags&windows.FILE_CS_FLAG_CASE_SENSITIVE_DIR != 0, true
}
