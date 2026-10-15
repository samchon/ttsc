package driver

import (
  "bytes"
  "io"
  "os"
)

// writeFileWithWatchMode preserves an unchanged regular output only for a
// watch-owned write. A failed comparison does not replace the default writer's
// errors or its behavior for symlinks, special files and absent parents.
func writeFileWithWatchMode(fileName, text string, watch bool) error {
  if watch && unchangedRegularOutput(fileName, text) {
    return nil
  }
  return defaultWriteFile(fileName, text)
}

// unchangedRegularOutput compares through a read/write descriptor so a file
// that the normal writer cannot open for writing is never treated as success.
// Identity and metadata checks reject a file replaced during the comparison;
// a later independent filesystem mutation remains a caller-visible race.
func unchangedRegularOutput(fileName, text string) bool {
  before, err := os.Lstat(fileName)
  if err != nil || !before.Mode().IsRegular() || before.Size() != int64(len(text)) {
    return false
  }
  file, err := os.OpenFile(fileName, os.O_RDWR, 0)
  if err != nil {
    return false
  }
  same := matchesOpenRegularOutput(file, fileName, before, text)
  if err := file.Close(); err != nil {
    return false
  }
  return same
}

func matchesOpenRegularOutput(file *os.File, fileName string, before os.FileInfo, text string) bool {
  opened, err := file.Stat()
  if err != nil || !opened.Mode().IsRegular() || !os.SameFile(before, opened) || opened.Size() != int64(len(text)) {
    return false
  }
  var buffer [32 * 1024]byte
  for offset := 0; offset < len(text); {
    count := min(len(buffer), len(text)-offset)
    read, err := io.ReadFull(file, buffer[:count])
    if err != nil || !bytes.Equal(buffer[:read], []byte(text[offset:offset+read])) {
      return false
    }
    offset += read
  }
  if _, err := file.Read(buffer[:1]); err != io.EOF {
    return false
  }
  afterOpen, err := file.Stat()
  if err != nil {
    return false
  }
  afterPath, err := os.Lstat(fileName)
  if err != nil {
    return false
  }
  return afterPath.Mode().IsRegular() &&
    os.SameFile(opened, afterOpen) && os.SameFile(opened, afterPath) &&
    afterOpen.Mode() == opened.Mode() && afterPath.Mode() == opened.Mode() &&
    afterOpen.Size() == opened.Size() && afterPath.Size() == opened.Size() &&
    afterOpen.ModTime().Equal(opened.ModTime()) && afterPath.ModTime().Equal(opened.ModTime())
}
