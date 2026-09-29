//go:build !linux

package watchhelper

import (
  "fmt"
  "io"
)

// Run reports that the helper serves Linux only. Windows and macOS watch in
// the adapter's own broker instead.
// This alternative acquires no watch or reader task and returns usage code 2.
//
// @evidence contracts/common.md#principled-implementation A Go build constraint selects the unsupported native alternative, which reports the actual capability boundary and usage exit code.
// @evidence contracts/common.md#clear-and-simple-design The stub states unsupported capability; it does not imitate inotify with a second polling implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fabricated ready or synchronized message disguises the absence of this Linux helper on another platform.
// @evidence contracts/common.md#meaningful-documentation Native prose explains alternative backend ownership and the absence of resource acquisition under the documentation skill's capability and failure guidance.
// @evidence contracts/portability.md#os-neutral-implementation Native differences are isolated by build constraints. Windows and macOS adapter backends provide watching; this Linux-specific entry point rejects invocation explicitly.
// @evidenceExclude contracts/performance.md#efficient-algorithms This unsupported backend reports one fixed diagnostic without a watch-processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work No native watching computation is available to coordinate through this stub.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The stub acquires no watch, handle or reader task and retains no state.
func Run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  fmt.Fprintln(stderr, "ttsc __watch: only Linux is supported")
  return 2
}
