package watchhelper

import "io"

// Run serves the protocol over stdin and stdout and returns an exit code.
// End of scanned input, including a scanner error, ends the request stream;
// backend failures or an output flush failure can also end service.
//
// On Linux one loop polls the inotify instance and a wake pipe the stdin reader writes
// after queueing each request. That loop serializes emitted messages and a
// `sync` drains the instance to an observed empty read before answering. This
// is not a total ordering of kernel event creation and request arrival, nor a
// guarantee that no event arrives after that read.
//
// Windows serves the unplugin broker protocol through a completion port, with
// access-only notifications omitted. Drains consume the currently queued native
// completions; EOF cancels reads and retains their buffers until completion.
//
// stdin and the output streams remain caller-owned. The Linux helper owns its inotify
// and wake descriptors and attempts their closure on every return. Its reader can remain
// blocked on caller input after an early backend failure; the command process
// ends when Run returns, while a library caller must close its input.
// Queue sends are canceled on return, and wake writes are synchronized with
// descriptor closure so a delayed reader cannot write to a reused descriptor.
//
// @evidence contracts/common.md#principled-implementation The Linux inotify instance reports actual overflow and directory loss. One poll loop drains queued events before acknowledging sync, preserving the protocol's observation ordering without guessing that quiet means unchanged.
// @evidence contracts/common.md#clear-and-simple-design A stdin reader only decodes and queues requests; one helper loop owns watch state, ordered emission and synchronization. Kernel handles remain behind this native backend.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported syscalls supply watch capabilities; no foreign runtime method is replaced and no test event substitutes for an actual ready or drain boundary.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state ordering, exit and stream ownership, including the blocked-reader limitation. The package describes every protocol message separately under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation A Linux build constraint isolates inotify and poll. Native directory paths remain syscall inputs, not shell text; Windows selects its native completion-port implementation and other platforms select an explicit unsupported implementation that reports usage code 2.
// @evidence contracts/performance.md#efficient-algorithms Each kernel batch is decoded linearly in its bytes; fanout visits K subscribers and JSON output also costs the repeated name bytes. Sorting O(K log K) is shared until membership changes. Removal uses indexed descriptor lookup, and the loop performs no userspace directory traversal. A drain has no event-count or time cap and may keep reading under continuous activity; native syscalls and caller writes have their own blocking costs.
// @evidence contracts/performance.md#reuse-equivalent-work Kernel watch descriptors are shared by subscribers of the same directory. Ordered subscriber IDs are cached per descriptor and invalidated on add, remove or directory loss; all mutation belongs to the same event loop.
// @evidence contracts/performance.md#bound-retention-and-release-resources Deferred cleanup cancels queued reader sends and attempts closure of all three owned descriptors; a mutex prevents late wake writes after closure. Blocking input reads and output writes remain caller-owned. The request channel holds at most 256 values, the scanner buffer is limited to 16 MiB, and event decoding reuses 64 KiB. Subscription maps and order slices have no independent numeric cap; matching remove/gone paths reclaim entries and process exit releases state. Reusing an ID for another descriptor without removal can leave its earlier subscription until that directory is gone or the process exits.
func Run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  return run(stdin, stdout, stderr)
}
