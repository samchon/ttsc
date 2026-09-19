// Package watchhelper implements `ttsc __watch`, the directory notification
// helper the unplugin adapter runs on Linux (samchon/ttsc#1426).
//
// An inotify instance holds a bounded queue. When it fills, the kernel drops
// every later event and queues one IN_Q_OVERFLOW event, which libuv, and so
// Node's `fs.watch`, discards. A watch opened there can lose events without
// notice. The helper owns its own inotify instance and reports the overflow,
// so the adapter can stop trusting its watches' silence instead.
//
// The protocol is newline-delimited JSON over stdio. The client writes
// requests:
//
//   - `{"op":"add","id":N,"path":"/abs/dir"}` watches one directory. The reply
//     is `{"id":N,"ready":true}` once the watch is live, or
//     `{"id":N,"error":"..."}`.
//   - `{"op":"remove","id":N}` ends a subscription. It has no reply.
//   - `{"op":"sync","id":N}` is answered with `{"id":N,"synced":true}` only
//     after the helper has read its instance empty, so every event queued
//     before the request is on stdout ahead of the answer.
//
// The helper writes events:
//
//   - `{"id":N,"type":"rename"|"change","name":"entry"}` for an entry of a
//     watched directory, typed as libuv types it.
//   - `{"id":N,"gone":true}` once a watched directory is deleted, moved, or
//     unmounted, after which the subscription hears nothing more.
//   - `{"overflow":true}` when the queue overflowed, for every subscription.
//
// Two subscriptions of one directory share its watch descriptor. The helper
// exits when stdin closes.
package watchhelper

// Request is one line the client writes to the helper.
type Request struct {
  // Op is `add`, `remove`, or `sync`.
  Op string `json:"op"`
  // ID names the subscription, or the sync being answered.
  ID int64 `json:"id"`
  // Path is the directory an `add` watches.
  Path string `json:"path,omitempty"`
}

// Response is one line the helper writes to the client.
type Response struct {
  // ID names the subscription or the sync the line concerns. An overflow
  // concerns every subscription and carries none.
  ID int64 `json:"id,omitempty"`
  // Ready answers an `add` whose watch is live.
  Ready bool `json:"ready,omitempty"`
  // Error answers an `add` that could not watch its directory.
  Error string `json:"error,omitempty"`
  // Type is an event's `rename` or `change`.
  Type string `json:"type,omitempty"`
  // Name is the entry an event concerns, relative to the watched directory.
  Name string `json:"name,omitempty"`
  // Gone reports that the watched directory itself went away.
  Gone bool `json:"gone,omitempty"`
  // Overflow reports that events were dropped.
  Overflow bool `json:"overflow,omitempty"`
  // Synced answers a `sync`.
  Synced bool `json:"synced,omitempty"`
}
