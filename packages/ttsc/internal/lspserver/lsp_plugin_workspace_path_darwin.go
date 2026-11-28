package lspserver

import (
  "bytes"
  "runtime"
  "unsafe"

  "golang.org/x/sys/unix"
)

// F_GETPATH obtains the spelling from the resolved directory, including the
// filesystem's canonical casing and normalization.
func workspacePhysicalDirectory(location string) (string, error) {
  fd, err := unix.Open(location, unix.O_EVTONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
  if err != nil {
    return "", err
  }
  defer unix.Close(fd)
  // Darwin's F_GETPATH requires a MAXPATHLEN-sized byte buffer.
  buffer := new([1024]byte)
  var pinner runtime.Pinner
  pinner.Pin(buffer)
  defer pinner.Unpin()
  _, err = unix.FcntlInt(uintptr(fd), unix.F_GETPATH, int(uintptr(unsafe.Pointer(buffer))))
  if err != nil {
    return "", err
  }
  if end := bytes.IndexByte(buffer[:], 0); end >= 0 {
    return string(buffer[:end]), nil
  }
  return "", unix.ENAMETOOLONG
}
