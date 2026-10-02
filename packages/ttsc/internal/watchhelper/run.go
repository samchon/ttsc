package watchhelper

import "io"

// Run serves the protocol over stdin and stdout until stdin closes, and
// returns the process exit code.
//
// One loop polls the inotify instance and a wake pipe the stdin reader writes
// after queueing each request, so events and replies leave in the order they
// were produced, and a `sync` can read the instance empty before it answers.
//
// stdin and the output streams remain caller-owned. The helper owns and closes
// its inotify and wake descriptors on every return. Its reader can remain
// blocked on caller input after an early backend failure; the command process
// ends when Run returns, while a library caller must close its input.
// Queue sends are canceled on return, and wake writes are synchronized with
// descriptor closure so a delayed reader cannot write to a reused descriptor.
//
// @evidence contracts/common.md#principled-implementation The Linux inotify instance reports actual overflow and directory loss. One poll loop drains queued events before acknowledging sync, preserving the protocol's observation ordering without guessing that quiet means unchanged.
// @evidence contracts/common.md#clear-and-simple-design A stdin reader only decodes and queues requests; one helper loop owns watch state, ordered emission and synchronization. Kernel handles remain behind this native backend.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported syscalls supply watch capabilities; no foreign runtime method is replaced and no test event substitutes for an actual ready or drain boundary.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state ordering, exit and stream ownership, including the blocked-reader limitation. The package describes every protocol message separately under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation A Linux build constraint isolates inotify and poll. Native directory paths remain syscall inputs, not shell text; other platforms select an explicit unsupported implementation that reports usage code 2 and use adapter-owned watching.
// @evidence contracts/performance.md#efficient-algorithms Each kernel batch is decoded linearly; fanout visits its K subscribers. Sorting O(K log K) is shared until membership changes instead of repeated for every event. Removing a subscription uses indexed descriptor lookup, and no polling traversal scans watched directories.
// @evidence contracts/performance.md#reuse-equivalent-work Kernel watch descriptors are shared by subscribers of the same directory. Ordered subscriber IDs are cached per descriptor and invalidated on add, remove or directory loss; all mutation belongs to the same event loop.
// @evidence contracts/performance.md#bound-retention-and-release-resources Deferred cleanup cancels queued reader sends and closes all three owned descriptors; a mutex prevents late wake writes after closure. A blocking input read remains caller-owned. The request channel holds at most 256 values, the scanner accepts at most a 16 MiB line, and event decoding reuses 64 KiB. Subscription maps and order slices grow with live client subscriptions and are released on remove/gone or process exit; subscriptions have no independent numeric cap.
func Run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  return run(stdin, stdout, stderr)
}
