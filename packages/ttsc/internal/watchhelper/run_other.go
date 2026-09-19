//go:build !linux

package watchhelper

import (
  "fmt"
  "io"
)

// Run reports that the helper serves Linux only. Windows and macOS watch in
// the adapter's own broker instead.
func Run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  fmt.Fprintln(stderr, "ttsc __watch: only Linux is supported")
  return 2
}
