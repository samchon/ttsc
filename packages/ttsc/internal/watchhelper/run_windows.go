//go:build windows

package watchhelper

import (
  "bufio"
  "encoding/binary"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "runtime"
  "sort"
  "sync"
  "unicode/utf16"

  "golang.org/x/sys/windows"
)

// Windows compiler-input watching deliberately omits LAST_ACCESS. A read can
// update NTFS access time and libuv reports that as an indistinguishable change
// (#1719). NEVER filter a delivered change by equal hashes/metadata instead:
// that loses real A-B-A writes. Preserve every other libuv mutation filter.
const windowsWatchMask = windows.FILE_NOTIFY_CHANGE_FILE_NAME |
  windows.FILE_NOTIFY_CHANGE_DIR_NAME | windows.FILE_NOTIFY_CHANGE_ATTRIBUTES |
  windows.FILE_NOTIFY_CHANGE_SIZE | windows.FILE_NOTIFY_CHANGE_LAST_WRITE |
  windows.FILE_NOTIFY_CHANGE_CREATION | windows.FILE_NOTIFY_CHANGE_SECURITY

// windowsBrokerRequest is the existing unplugin broker wire shape. Linux retains
// its original protocol. Registration readiness and drain replies carry independent
// IDs; the helper observes native mutations, never compiler/cache state.
type windowsBrokerRequest struct {
  // Op selects add, remove, or drain.
  Op string `json:"op"`

  // ID names an independent registration or drain.
  ID int64 `json:"id"`

  // AllEvents admits content changes as well as structural notifications.
  AllEvents bool `json:"allEvents"`

  // Locations name canonical native directory subscriptions.
  Locations []windowsWatchLocation `json:"locations"`
}

// windowsWatchLocation identifies an exact native directory and recursion policy.
// The parent supplies canonical spelling; no universal case folding is performed.
// A shallow subscriber cannot borrow recursive coverage, while independently
// spelled aliases may conservatively keep separate handles.
type windowsWatchLocation struct {
  // Directory is the native absolute directory, already canonicalized by the caller.
  Directory string `json:"directory"`

  // Recursive requests notifications below descendants.
  Recursive bool `json:"recursive"`
}

// windowsDirectoryWatch separates live subscriber ownership from pending kernel
// ownership. One exact directory/recursion key shares its native handle and 64 KiB
// buffer among subscribers with distinct event policies.
//
// NEVER release or reuse the overlapped record or buffer until its completion,
// including cancellation. Closing the handle or removing its last subscriber does
// not end that memory lifetime. The completion index keeps retiring watches rooted.
type windowsDirectoryWatch struct {
  location    windowsWatchLocation
  handle      windows.Handle
  overlapped  windows.Overlapped
  buffer      []byte
  subscribers map[int64]bool
  ordered     []int64
  pending     bool
  retiring    bool
}

// windowsBroker owns one completion port and all subscription state on one loop.
// Location, completion and registration indexes serve acquisition, native memory
// ownership and independent subscriber removal respectively.
//
// Completion keys are never reused: a late cancellation must not address a newly
// opened watch. Active subscriptions have no numeric cap; removal and cancellation
// completion reclaim them. Native observation is shared, not per-owner readiness.
type windowsBroker struct {
  port          windows.Handle
  nextKey       uintptr
  watches       map[uintptr]*windowsDirectoryWatch
  locations     map[windowsWatchLocation]uintptr
  registrations map[int64]map[uintptr]struct{}
  out           *bufio.Writer
  encoder       *json.Encoder
}

// run serves Windows watches without Node access-time notifications. A bounded
// stdin reader posts wakes; one OS-thread-locked loop owns handles and ordered
// output. Each request follows a drain to the currently observed empty completion
// port. This does not atomically classify concurrent kernel writes; no quiet delay
// can replace that native frontier.
//
// EOF retires all watches and waits for cancellation completions before releasing
// buffers and the port. Wake posting is synchronized with closure, and return
// cancels queued sends. A library caller still owns closing blocked stdin/output.
// Scanner framing is limited to 16 MiB and requests to 256 queued values; active
// subscriptions and output backpressure retain caller-dependent lifetimes.
func run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  // IOCP associates the receiving OS thread with its concurrency budget.
  // A migrating goroutine can leave an old thread active and block its next
  // receive behind that same budget. Keep the one native owner on one thread.
  runtime.LockOSThread()
  defer runtime.UnlockOSThread()
  port, err := windows.CreateIoCompletionPort(windows.InvalidHandle, 0, 0, 1)
  if err != nil {
    fmt.Fprintln(stderr, err)
    return 1
  }
  out := bufio.NewWriter(stdout)
  h := &windowsBroker{port: port, nextKey: 1, watches: map[uintptr]*windowsDirectoryWatch{}, locations: map[windowsWatchLocation]uintptr{}, registrations: map[int64]map[uintptr]struct{}{}, out: out, encoder: json.NewEncoder(out)}
  requests := make(chan windowsBrokerRequest, 256)
  done := make(chan struct{})
  var wakeMu sync.Mutex
  wake := func() {
    wakeMu.Lock()
    defer wakeMu.Unlock()
    select {
    case <-done:
      return
    default:
      _ = windows.PostQueuedCompletionStatus(port, 0, 0, nil)
    }
  }
  defer func() {
    wakeMu.Lock()
    close(done)
    wakeMu.Unlock()
    for key, watch := range h.watches {
      h.retire(key, watch)
    }
    for len(h.watches) > 0 {
      if _, err := h.completion(windows.INFINITE); err != nil {
        break
      }
    }
    _ = windows.CloseHandle(port)
  }()
  go func() {
    defer wake()
    defer close(requests)
    scanner := bufio.NewScanner(stdin)
    scanner.Buffer(make([]byte, 64*1024), 16*1024*1024)
    for scanner.Scan() {
      var request windowsBrokerRequest
      if json.Unmarshal(scanner.Bytes(), &request) != nil {
        continue
      }
      select {
      case requests <- request:
        wake()
      case <-done:
        return
      }
    }
  }()
  for {
    if err := h.drain(); err != nil {
      fmt.Fprintln(stderr, err)
      return 1
    }
    select {
    case request, open := <-requests:
      if !open {
        _ = out.Flush()
        return 0
      }
      if err := h.request(request); err != nil {
        fmt.Fprintln(stderr, err)
        return 1
      }
    default:
      if err := out.Flush(); err != nil {
        return 0
      }
      if _, err := h.completion(windows.INFINITE); err != nil {
        fmt.Fprintln(stderr, err)
        return 1
      }
    }
  }
}

// request dispatches an operation after the loop consumed queued completions.
// A new subscriber cannot receive those older batches. Ready follows actual native
// arming; drain replies follow a current empty-queue observation, not elapsed time.
//
// Add shares exact live location/recursion handles. Partial acquisition rolls back
// the entire registration and reports failure; it cannot lend partial coverage.
// Remove visits only that owner's keys and preserves other subscribers.
func (h *windowsBroker) request(request windowsBrokerRequest) error {
  switch request.Op {
  case "add":
    h.remove(request.ID)
    keys := map[uintptr]struct{}{}
    h.registrations[request.ID] = keys
    for _, location := range request.Locations {
      key, err := h.acquire(location)
      if err != nil {
        h.remove(request.ID)
        return h.encoder.Encode(map[string]any{"id": request.ID, "ready": true, "failed": true})
      }
      keys[key] = struct{}{}
      h.watches[key].subscribers[request.ID] = request.AllEvents
      h.watches[key].ordered = nil
    }
    return h.encoder.Encode(map[string]any{"id": request.ID, "ready": true, "failed": false})
  case "remove":
    h.remove(request.ID)
  case "drain":
    if err := h.drain(); err != nil {
      return err
    }
    return h.encoder.Encode(map[string]any{"id": request.ID, "drained": true, "unproven": []any{}})
  }
  return nil
}

// acquire shares an exact live directory/recursion key or opens, validates and
// arms a native directory before publishing readiness. UTF-16 conversion, native
// directory attributes, port association and initial read have one rollback owner.
// Cold acquisition allocates one handle and 64 KiB without traversing input files;
// alternate spellings may conservatively remain separate watches.
func (h *windowsBroker) acquire(location windowsWatchLocation) (uintptr, error) {
  if key, ok := h.locations[location]; ok {
    return key, nil
  }
  native, err := windows.UTF16PtrFromString(location.Directory)
  if err != nil {
    return 0, err
  }
  handle, err := windows.CreateFile(native, windows.FILE_LIST_DIRECTORY, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OVERLAPPED, 0)
  if err != nil {
    return 0, err
  }
  var info windows.ByHandleFileInformation
  if err = windows.GetFileInformationByHandle(handle, &info); err != nil || info.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY == 0 {
    _ = windows.CloseHandle(handle)
    if err == nil {
      err = windows.ERROR_DIRECTORY
    }
    return 0, err
  }
  key := h.nextKey
  h.nextKey++
  if _, err = windows.CreateIoCompletionPort(handle, h.port, key, 1); err != nil {
    _ = windows.CloseHandle(handle)
    return 0, err
  }
  watch := &windowsDirectoryWatch{location: location, handle: handle, buffer: make([]byte, 64*1024), subscribers: map[int64]bool{}}
  if err = watch.arm(); err != nil {
    _ = windows.CloseHandle(handle)
    return 0, err
  }
  h.watches[key] = watch
  h.locations[location] = key
  return key, nil
}

// arm transfers the retained buffer to one overlapped native read. Initial and
// subsequent reads use the same mutation mask and recursion policy. Only successful
// arming marks pending; a caller must keep the watch rooted through completion.
// Reuse is allowed only after the preceding batch was decoded, never while the
// kernel still owns its buffer. The shared mask explains access versus A-B-A writes.
func (watch *windowsDirectoryWatch) arm() error {
  watch.overlapped = windows.Overlapped{}
  err := windows.ReadDirectoryChanges(watch.handle, &watch.buffer[0], uint32(len(watch.buffer)), watch.location.Recursive, windowsWatchMask, nil, &watch.overlapped, 0)
  if err == nil {
    watch.pending = true
  }
  return err
}

// remove releases this registration alone through its indexed watch keys.
// Remaining subscribers keep their native handle; membership changes invalidate
// only sorted fanout identities. Last detach removes live location authority and
// retires the handle, while pending completion memory remains rooted. Removing a
// map entry is not a native close/completion acknowledgment.
func (h *windowsBroker) remove(id int64) {
  keys := h.registrations[id]
  delete(h.registrations, id)
  for key := range keys {
    if watch := h.watches[key]; watch != nil {
      delete(watch.subscribers, id)
      watch.ordered = nil
      if len(watch.subscribers) == 0 {
        h.retire(key, watch)
      }
    }
  }
}

// retire withdraws live coverage and attempts cancellation/close once. Pending
// watches remain in the completion index until their actual completion; nonpending
// watches can leave immediately. Native cancellation/close attempts alone do not
// certify success. The key is never reused, so late native completion cannot lend
// a retired buffer or event to another subscription.
func (h *windowsBroker) retire(key uintptr, watch *windowsDirectoryWatch) {
  if watch.retiring {
    return
  }
  watch.retiring = true
  delete(h.locations, watch.location)
  _ = windows.CancelIoEx(watch.handle, &watch.overlapped)
  _ = windows.CloseHandle(watch.handle)
  if !watch.pending {
    delete(h.watches, key)
  }
}

// drain consumes currently available native completions and wake packets until
// the port reports empty. Each batch is consumed once; work follows decoded bytes
// and subscriber fanout, with no event-count or time shortcut. Continuous activity
// can prolong the drain. Native/output errors propagate instead of upgrading an
// unavailable frontier to silent success; no historical results are retained.
func (h *windowsBroker) drain() error {
  for {
    available, err := h.completion(0)
    if err != nil || !available {
      return err
    }
  }
}

// completion selects the rooted buffer by native key and overlapped identity,
// decodes before reuse, then rearms before output backpressure can block. Every
// actual mutation survives, including A-B-A. Zero bytes, malformed records and
// unrepresentable names emit a gap; failed reads/rearming withdraw coverage and
// retire the handle. Neither loss nor partial success becomes empty proof.
//
// One batch is decoded once for all subscribers. Ordered IDs are sorted once per
// membership epoch, then reused. Work follows native bytes, subscriber count and
// encoded name bytes. Canceled watches remain rooted until completion; only
// detached decoded text can outlive buffer reuse.
func (h *windowsBroker) completion(timeout uint32) (bool, error) {
  var count uint32
  var key uintptr
  var overlapped *windows.Overlapped
  err := windows.GetQueuedCompletionStatus(h.port, &count, &key, &overlapped, timeout)
  if overlapped == nil {
    if errors.Is(err, windows.WAIT_TIMEOUT) {
      return false, nil
    }
    return true, err
  }
  watch := h.watches[key]
  if watch == nil || overlapped != &watch.overlapped {
    return true, fmt.Errorf("unknown native directory completion")
  }
  watch.pending = false
  if watch.retiring {
    delete(h.watches, key)
    return true, nil
  }
  if err != nil {
    for id := range watch.subscribers {
      if encodeErr := h.encoder.Encode(map[string]any{"id": id, "failed": true}); encodeErr != nil {
        return true, encodeErr
      }
    }
    h.retire(key, watch)
    return true, nil
  }
  var events []windowsNotification
  complete := false
  if uint64(count) <= uint64(len(watch.buffer)) {
    events, complete = decodeWindowsNotifications(watch.buffer[:count])
  }
  // The handle's native buffer retains changes between requests. Rearm before
  // output can block, keeping caller backpressure out of the subscription gap.
  if err := watch.arm(); err != nil {
    for id := range watch.subscribers {
      if encodeErr := h.encoder.Encode(map[string]any{"id": id, "failed": true}); encodeErr != nil {
        return true, encodeErr
      }
    }
    h.retire(key, watch)
    return true, nil
  }
  if watch.ordered == nil {
    watch.ordered = make([]int64, 0, len(watch.subscribers))
    for id := range watch.subscribers {
      watch.ordered = append(watch.ordered, id)
    }
    sort.Slice(watch.ordered, func(i, j int) bool { return watch.ordered[i] < watch.ordered[j] })
  }
  for _, id := range watch.ordered {
    if !complete {
      if err := h.encoder.Encode(map[string]any{"id": id, "gap": true}); err != nil {
        return true, err
      }
    }
    for _, event := range events {
      if event.kind == "change" && !watch.subscribers[id] && !watch.location.Recursive {
        continue
      }
      if err := h.encoder.Encode(map[string]any{"id": id, "directory": watch.location.Directory, "eventType": event.kind, "filename": event.name}); err != nil {
        return true, err
      }
    }
  }
  return true, nil
}

// windowsNotification carries detached kind/name text, never a slice of the
// rearmed native buffer. The decoder owns Windows action and UTF-16 validation;
// unknown or unrepresentable identities cannot become guessed successful names.
type windowsNotification struct{ kind, name string }

// decodeWindowsNotifications validates linked FILE_NOTIFY_INFORMATION records
// with one forward scan. Bounds and aligned advancing offsets prevent overlap,
// overflow and cycles. Known actions and paired UTF-16 preserve native relative
// names; an unpaired surrogate cannot be losslessly represented in Go/JSON.
//
// Zero/truncated/unknown/malformed batches withdraw completeness even when earlier
// records were valid. Only detached events escape; the completion owner shares that
// parse with subscribers and retains the input buffer. Temporary storage follows
// name bytes, with no historical parse memo or filesystem traversal.
func decodeWindowsNotifications(buffer []byte) ([]windowsNotification, bool) {
  if len(buffer) == 0 {
    return nil, false
  }
  events := []windowsNotification{}
  for offset := 0; ; {
    if offset > len(buffer)-12 {
      return events, false
    }
    record := buffer[offset:]
    next, action, size := binary.LittleEndian.Uint32(record), binary.LittleEndian.Uint32(record[4:]), binary.LittleEndian.Uint32(record[8:])
    if size == 0 || size%2 != 0 || uint64(size)+12 > uint64(len(record)) {
      return events, false
    }
    end := 12 + int(size)
    units := make([]uint16, size/2)
    for i := range units {
      units[i] = binary.LittleEndian.Uint16(record[12+i*2:])
    }
    // Windows can represent an unpaired surrogate. JSON/Go replacement text
    // cannot preserve that exact native identity, so withdraw coverage instead.
    for i := 0; i < len(units); i++ {
      if units[i] >= 0xd800 && units[i] <= 0xdbff {
        if i+1 == len(units) || units[i+1] < 0xdc00 || units[i+1] > 0xdfff {
          return events, false
        }
        i++
      } else if units[i] >= 0xdc00 && units[i] <= 0xdfff {
        return events, false
      }
    }
    name := string(utf16.Decode(units))
    kind := "rename"
    if action == windows.FILE_ACTION_MODIFIED {
      kind = "change"
    } else if action < windows.FILE_ACTION_ADDED || action > windows.FILE_ACTION_RENAMED_NEW_NAME {
      return events, false
    }
    events = append(events, windowsNotification{kind: kind, name: name})
    if next == 0 {
      return events, true
    }
    if next%4 != 0 || uint64(next) < uint64(end) || uint64(next) >= uint64(len(record)) {
      return events, false
    }
    offset += int(next)
  }
}
