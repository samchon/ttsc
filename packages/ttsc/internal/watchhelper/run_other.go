//go:build !linux

package watchhelper

import (
  "fmt"
  "io"
)

// run reports that the helper serves Linux only. Windows and macOS watch in
// the adapter's own broker instead.
// This alternative acquires no watch or reader task and returns usage code 2.
func run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  fmt.Fprintln(stderr, "ttsc __watch: only Linux is supported")
  return 2
}
