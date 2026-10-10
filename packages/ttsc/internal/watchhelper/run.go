package watchhelper

import "io"

// Run serves the platform watch protocol over caller-owned stdin and stdout.
// End of scanned input, including a scanner error, ends the request stream;
// backend failures or an output flush failure can also end service.
//
// Linux uses the inotify protocol. One loop polls the instance and a wake pipe
// the stdin reader writes after queueing each request. A sync drains the instance
// to an observed empty read before answering. Windows uses the unplugin broker
// protocol. One OS-thread-locked completion loop drains currently queued native
// completions before a request, so a joining subscriber does not receive those
// older events. Neither frontier totally orders concurrent kernel writes and
// request arrival, nor guarantees no event arrives after the empty observation.
// Continuous activity can prolong either drain; elapsed quiet is never proof.
//
// Windows excludes access-only notifications at native acquisition (#1719).
// NEVER discard an actual mutation by comparing its final hash or timestamps:
// edits restored to the original bytes still invalidate compiler input proof.
// Overflow, malformed notifications, directory loss and native failures also
// withdraw coverage. Linux retains its native loss and directory-loss semantics.
//
// The backend owns its native handles. Linux closes its inotify and wake
// descriptors on return. Windows cancels reads, retains each overlapped buffer
// until its completion, then closes the completion port. A mutex synchronizes
// reader wakes with closure, and queued sends are canceled on return. A reader
// can remain blocked on caller input after early backend failure: the command
// exits when Run returns, while a library caller must close that input. Blocking
// output also remains caller-owned; this function has no independent deadline.
//
// @evidence contracts/common.md#principled-implementation Native inotify/completion queues establish the actual observation frontier; loss and native failure withdraw coverage. Windows omits access semantics at subscription rather than erasing delivered mutations. A joining subscriber is attached only after currently queued completions were consumed, under the documented concurrent-write limit.
// @evidence contracts/common.md#clear-and-simple-design A stdin reader only decodes and queues requests; one backend loop owns watch state, ordered emission and synchronization. Platform protocol and kernel handles remain behind this native boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported native APIs supply watch capabilities; no runtime method or system access-time setting is changed. Equal final bytes do not excuse A-B-A writes, and no test event substitutes for native ready/drain authority.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state each protocol, frontier limits, mutation policy, EOF cleanup and caller stream ownership. The package documents protocol messages separately; private backend comments explain acquisition, fanout, loss and pending buffer ownership.
// @evidence contracts/portability.md#os-neutral-implementation Build constraints isolate Linux inotify/poll and Windows overlapped completion APIs. Paths remain native API inputs, not shell text. Other native helper platforms return explicit usage code 2; the unplugin macOS adapter owns its separate FSEvents broker.
// @evidence contracts/performance.md#efficient-algorithms Each native batch is decoded linearly in its bytes; fanout visits K subscribers and encoded name bytes. Sorting O(K log K) is shared until membership changes. Indexed native descriptors/keys serve removal and completion without userspace project traversal. Continuous activity can prolong drains; native calls and caller writes can block independently of event counts.
// @evidence contracts/performance.md#reuse-equivalent-work Linux descriptors and Windows exact directory/recursion keys share native observation among subscribers. Ordered subscriber IDs are invalidated on membership changes; each owner retains distinct readiness and event policy. One loop serializes mutation, and Windows completion keys are never reused for another watch.
// @evidence contracts/performance.md#bound-retention-and-release-resources Deferred cleanup cancels queued sends and closes owned handles, retaining Windows buffers until cancellation completion. A mutex prevents late wake operations against a closed/reused native handle. The request channel holds at most 256 values, scanner framing is limited to 16 MiB and native buffers use 64 KiB each. Active subscriptions/order slices have no numeric cap; removal/loss reclaim live entries, with retiring Windows entries retained until completion. Caller stream blocking has no independent bound. Linux callers must remove before reusing an ID for a different descriptor, or its earlier subscription lasts until loss or process exit.
func Run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  return run(stdin, stdout, stderr)
}
