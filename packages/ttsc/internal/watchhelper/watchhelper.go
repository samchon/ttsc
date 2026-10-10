// Package watchhelper implements `ttsc __watch`, the directory notification
// helper the unplugin adapter runs on Linux and Windows.
//
// An inotify instance holds a bounded queue. Events beyond its capacity are
// dropped and an IN_Q_OVERFLOW event reports that loss, which libuv, and so
// Node's `fs.watch`, discards. A watch opened there can lose events without
// notice. The helper owns its own inotify instance and reports the overflow,
// so the adapter can stop trusting its watches' silence instead.
//
// On Windows the same command serves the unplugin broker add/remove/drain
// protocol over ordered JSON lines. Its completion-port backend shares directory
// and recursion keys, omits access-time notifications, reports loss as gap and
// acquisition/read failure as failed, and retains canceled buffers until native
// completion. No compiler state is stored in either backend.
//
// The Linux protocol is newline-delimited JSON over stdio. The client writes
// requests:
//
//   - `{"op":"add","id":N,"path":"/abs/dir"}` watches one directory. The reply
//     is `{"id":N,"ready":true}` once the watch is live, or
//     `{"id":N,"error":"..."}`.
//   - `{"op":"remove","id":N}` ends a subscription. It has no reply.
//   - `{"op":"sync","id":N}` is answered with `{"id":N,"synced":true}` only
//     after the helper has read its instance empty. Emitted events from that
//     drain precede the answer; concurrent later arrivals remain possible.
//
// The helper writes events:
//
//   - `{"id":N,"type":"rename"|"change","name":"entry"}` for an entry of a
//     watched directory, typed as libuv types it.
//   - `{"id":N,"gone":true}` once a watched directory is deleted, moved, or
//     unmounted, after which the subscription hears nothing more.
//   - `{"overflow":true}` when the queue overflowed, for every subscription.
//
// Two subscriptions of one directory share its watch descriptor. Use distinct
// live subscription IDs and remove one before reusing its ID for another
// directory. End of scanned input ends requests; backend and output failures
// can also end service.
package watchhelper

// Request is one line the client writes to the helper.
// Paths refer to host directories; the adapter supplies absolute names. The
// operation determines whether Path is meaningful, while ID identifies the
// subscription or synchronization barrier rather than a kernel descriptor.
//
// @evidence contracts/common.md#principled-implementation The operation discriminant selects add/remove/sync semantics, and a signed integer carries the client's identifier independently of the kernel watch descriptor.
// @evidence contracts/common.md#clear-and-simple-design One wire object groups operation, identity and the add-only path; it does not duplicate the helper's subscription state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The names and JSON fields are the shared helper protocol, not consumer-specific directory guesses or expected test messages.
// @evidence contracts/common.md#meaningful-documentation Package protocol prose and separate field comments explain operation-dependent paths, barrier identity and host directory spelling under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Path carries a native directory supplied by the adapter. The Linux backend consumes that native spelling, while other platforms use their own adapter backend.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wire value selects no processing strategy; the serving loop owns dispatch.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The request does not own watch sharing or synchronization across clients.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The helper owns subscriptions and descriptors; this value only identifies a requested operation.
type Request struct {
  // Op selects `add`, `remove`, or `sync`; unknown operations are ignored.
  Op string `json:"op"`

  // ID names the subscription, or the sync being answered.
  ID int64 `json:"id"`

  // Path is the directory an `add` watches.
  Path string `json:"path,omitempty"`
}

// Response is one line the helper writes to the client.
// Individual replies and events carry an ID; overflow concerns the entire
// inotify instance and intentionally carries none. The backend constructs the
// relevant fields rather than treating their zero values as separate events.
//
// @evidence contracts/common.md#principled-implementation Optional JSON fields encode ready/error, change/rename, termination and synchronization messages, with instance-wide overflow distinct from one subscriber's event.
// @evidence contracts/common.md#clear-and-simple-design One protocol value separates correlation from event payload; native watch descriptors stay private to the helper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Ready and sync are emitted at actual backend boundaries, and overflow is reported from the kernel event rather than inferred from a quiet watcher.
// @evidence contracts/common.md#meaningful-documentation Native protocol prose and field comments distinguish global overflow, add failure, directory loss and synchronization under the documentation skill's optional-state guidance.
// @evidence contracts/portability.md#os-neutral-implementation Name is relative to the native watched directory; this wire value does not fold case or reinterpret a file name as a URL. The Linux-only backend boundary is explicit.
// @evidenceExclude contracts/performance.md#efficient-algorithms This response describes an outcome without choosing the dispatch algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Shared watch descriptors and barrier coordination belong to the helper rather than to the response value.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This response owns no subscription or open descriptor lifetime.
type Response struct {
  // ID names the subscription or the sync the line concerns. An overflow
  // concerns every subscription and carries none. The JSON field is also
  // omitted for a zero ID, so field absence alone does not identify overflow.
  ID int64 `json:"id,omitempty"`

  // Ready answers an `add` whose watch is live.
  Ready bool `json:"ready,omitempty"`

  // Error answers an `add` that could not watch its directory.
  Error string `json:"error,omitempty"`

  // Type is an event's `rename` or `change`.
  Type string `json:"type,omitempty"`

  // Name is the entry an event concerns, relative to the watched directory.
  Name string `json:"name,omitempty"`

  // Gone reports an end-mask event, including directory move, deletion,
  // unmount or watch removal; the subscription will receive no later events.
  Gone bool `json:"gone,omitempty"`

  // Overflow reports that events were dropped.
  Overflow bool `json:"overflow,omitempty"`

  // Synced answers a `sync` after a drain observes an empty instance, not a
  // promise that no later event arrives.
  Synced bool `json:"synced,omitempty"`
}
