//go:build !linux && !windows

package watchhelper

import (
  "fmt"
  "io"
)

// run reports that the helper serves Linux and Windows. macOS uses the
// adapter's FSEvents broker instead.
// This alternative acquires no watch or reader task and returns usage code 2.
func run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  fmt.Fprintln(stderr, "ttsc __watch: only Linux and Windows are supported")
  return 2
}
