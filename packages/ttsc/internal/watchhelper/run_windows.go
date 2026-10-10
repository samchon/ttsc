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

// The Windows backend speaks the existing unplugin broker protocol. The Linux
// helper retains its own original wire format. Neither observes compiler state.
// @evidence contracts/common.md#principled-implementation Operations carry actual registration identities and native location/recursion inputs; readiness and drains are separate replies.
// @evidence contracts/common.md#clear-and-simple-design One private wire shape describes broker requests without duplicating tracker state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Fields match the maintained broker protocol, not fixture-specific paths or success values.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies platform protocol ownership; fields describe native selection and event policy.
// @evidence contracts/portability.md#os-neutral-implementation Native Windows paths are supplied by the broker's canonicalization boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wire shape chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Subscription sharing belongs to the backend.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The backend owns handles and request lifetime.
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

// windowsWatchLocation is a native directory subscription's identity.
// @evidence contracts/common.md#principled-implementation Recursion is part of the watch key, so a shallow subscription cannot borrow recursive coverage.
// @evidence contracts/common.md#clear-and-simple-design The comparable shape is both wire input and exact-spelling native registry key.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No filename prefilter assumes native event aliases are equivalent or different.
// @evidence contracts/common.md#meaningful-documentation Fields distinguish native directory spelling from recursion capability.
// @evidence contracts/portability.md#os-neutral-implementation Windows supplies event names without universal case folding.
// @evidenceExclude contracts/performance.md#efficient-algorithms This value declares identity, not processing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Registry acquisition owns sharing.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This value owns no handle.
type windowsWatchLocation struct {
  // Directory is the native absolute directory, already canonicalized by the caller.
  Directory string `json:"directory"`
  // Recursive requests notifications below descendants.
  Recursive bool `json:"recursive"`
}

// windowsDirectoryWatch retains its buffer until its last overlapped completion,
// including cancellation. Closing a handle alone does not free kernel ownership.
// @evidence contracts/common.md#principled-implementation Pending and retiring separate native completion ownership from live subscription ownership.
// @evidence contracts/common.md#clear-and-simple-design One watch owns its handle, buffer and subscriber policies; the loop owns all mutations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Readiness is not inferred from a map entry and retired buffers are not reused.
// @evidence contracts/common.md#meaningful-documentation Native prose and fields explain pending kernel ownership and cancellation.
// @evidence contracts/portability.md#os-neutral-implementation Native overlapped handles remain inside the Windows backend.
// @evidenceExclude contracts/performance.md#efficient-algorithms The serving loop owns processing.
// @evidence contracts/performance.md#reuse-equivalent-work Subscribers share one exact directory/recursion handle while maintaining distinct policies.
// @evidence contracts/performance.md#bound-retention-and-release-resources One 64 KiB buffer and overlapped record remain rooted until completion, even after close.
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

// windowsBroker owns one completion port and all its subscriptions. Numeric
// completion keys are never reused, so late cancellation cannot address a new watch.
// @evidence contracts/common.md#principled-implementation One loop serializes native completion, request dispatch and ordered output.
// @evidence contracts/common.md#clear-and-simple-design Location, completion and registration indexes serve distinct lifetime lookups.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Native queue drainage, not a quiet delay, establishes the reply frontier.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes completion identity and live subscription lifetime.
// @evidence contracts/portability.md#os-neutral-implementation Windows completion ownership is confined to this backend.
// @evidence contracts/performance.md#efficient-algorithms Indexed location acquisition and completion lookup avoid scanning project inputs; fanout follows actual subscribers.
// @evidence contracts/performance.md#reuse-equivalent-work Exact directory/recursion keys share native work, not registration readiness or drain authority.
// @evidence contracts/performance.md#bound-retention-and-release-resources Registrations and watches grow with active caller demand without a numeric cap; removal and cancellation completion reclaim them.
type windowsBroker struct {
  port          windows.Handle
  nextKey       uintptr
  watches       map[uintptr]*windowsDirectoryWatch
  locations     map[windowsWatchLocation]uintptr
  registrations map[int64]map[uintptr]struct{}
  out           *bufio.Writer
  encoder       *json.Encoder
}

// run serves Windows watches without Node's access-time notifications. A stdin
// reader posts wake packets; one completion loop owns every handle and output.
// A drain consumes currently queued completions to an observed empty port. This
// is not atomic classification of concurrent kernel writes. No delay is a proof.
// EOF retires every watch and waits for cancellation completions before buffers
// can be released. A library caller still owns closing a blocked stdin reader.
// @evidence contracts/common.md#principled-implementation Native completion and cancellation establish ordering and resource ownership; failed reads and loss withdraw coverage.
// @evidence contracts/common.md#clear-and-simple-design One existing native helper command provides an isolated backend to all unplugin registrations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The selected Windows notification mask excludes only access semantics, without replacing runtime methods or ignoring actual changes.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state drain limits, EOF cleanup and blocked reader ownership.
// @evidence contracts/portability.md#os-neutral-implementation Build constraints isolate Windows handles; Linux and macOS retain their supported owners.
// @evidence contracts/performance.md#efficient-algorithms One completion loop decodes actual native bytes and fans out to subscribers; it never enumerates the project tree. Continuous mutation can prolong a drain.
// @evidence contracts/performance.md#reuse-equivalent-work Exact location/recursion keys share handles within this helper, while every newly joined registration first drains prior events before attaching.
// @evidence contracts/performance.md#bound-retention-and-release-resources Deferred cleanup closes cancellation-completed watches and the port; a bounded 256-request channel and 16 MiB scanner limit framing, while active subscriptions and output backpressure have caller-dependent lifetime.
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

// request applies one broker operation after the loop's native drain. A joining
// subscriber cannot receive old completions queued before its add was processed.
// @evidence contracts/common.md#principled-implementation Ready follows actual native watch acquisition; a drain reply follows actual empty-queue observation.
// @evidence contracts/common.md#clear-and-simple-design One dispatcher owns add/remove/drain without tracker-specific decisions.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Partial opening rolls back and reports failure rather than claiming partial coverage.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the new subscriber's temporal boundary and rollback.
// @evidence contracts/portability.md#os-neutral-implementation Protocol spelling is preserved through native directory ownership.
// @evidence contracts/performance.md#efficient-algorithms Add/remove visit their actual location/key population, not all watched files; cold acquisition pays native handles and 64 KiB per watch.
// @evidence contracts/performance.md#reuse-equivalent-work Existing matching watches are shared after preceding completions have been drained; each registration still gets its own ready.
// @evidence contracts/performance.md#bound-retention-and-release-resources Failed partial acquisition removes the whole registration; last subscriber retirement preserves pending kernel buffers until completion.
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

// acquire opens an exact directory/recursion key or returns its live handle.
// @evidence contracts/common.md#principled-implementation ReadDirectoryChanges is armed before readiness and failed acquisition never enters the live registry.
// @evidence contracts/common.md#clear-and-simple-design Native creation, port association and initial read have one rollback owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Only directory handles are supported and every other filter retains native mutation semantics.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies exact sharing and arming boundary.
// @evidence contracts/portability.md#os-neutral-implementation UTF-16 native paths and directory attributes are checked at the Windows boundary.
// @evidence contracts/performance.md#efficient-algorithms Warm acquisition uses location lookup; cold acquisition performs native open/metadata/port/read operations without tree traversal.
// @evidence contracts/performance.md#reuse-equivalent-work Only an exact live location and recursion pair shares a handle; alternate spellings can remain separate entries.
// @evidence contracts/performance.md#bound-retention-and-release-resources Failed acquisition closes its handle before publication; an armed buffer is held in the completion index until its completion.
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

// arm gives the kernel exclusive ownership of the retained buffer until completion.
//
// @evidence contracts/common.md#principled-implementation The supported overlapped read transfers its rooted buffer until one completion; the pending flag changes only after successful native acquisition.
// @evidence contracts/common.md#clear-and-simple-design One method owns reset and arming for both initial opening and subsequent completion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The native filter excludes access semantics at subscription, without erasing delivered writes or replacing runtime APIs.
// @evidence contracts/common.md#meaningful-documentation The native comment states the exclusive buffer lifetime; the shared mask warning explains why equal content cannot filter actual events.
// @evidence contracts/portability.md#os-neutral-implementation Windows overlapped APIs and recursion stay within the native backend.
// @evidence contracts/performance.md#efficient-algorithms Arming submits one fixed-size buffer; native filesystem and queue costs remain external.
// @evidence contracts/performance.md#reuse-equivalent-work The same watch and buffer are reused only after their preceding completion has been decoded.
// @evidence contracts/performance.md#bound-retention-and-release-resources The caller retains the watch in the completion index while pending; failure leaves no newly armed operation.
func (watch *windowsDirectoryWatch) arm() error {
  watch.overlapped = windows.Overlapped{}
  err := windows.ReadDirectoryChanges(watch.handle, &watch.buffer[0], uint32(len(watch.buffer)), watch.location.Recursive, windowsWatchMask, nil, &watch.overlapped, 0)
  if err == nil {
    watch.pending = true
  }
  return err
}

// remove releases this registration alone; another subscriber keeps its watch.
//
// @evidence contracts/common.md#principled-implementation Only the named registration loses ownership; remaining subscribers retain their actual native watch.
// @evidence contracts/common.md#clear-and-simple-design One registration index identifies exactly the watches to update.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Removal does not manufacture a native close acknowledgment or suppress another owner.
// @evidence contracts/common.md#meaningful-documentation The native comment distinguishes individual removal from last-subscriber retirement.
// @evidence contracts/portability.md#os-neutral-implementation Native handle retirement delegates to the Windows owner without interpreting path aliases.
// @evidence contracts/performance.md#efficient-algorithms Removal visits the registration's K watch keys; it does not scan graph inputs or other registrations.
// @evidence contracts/performance.md#reuse-equivalent-work Remaining subscribers share their live handle; sorted fanout identity is invalidated when membership changes.
// @evidence contracts/performance.md#bound-retention-and-release-resources Last detach retires the handle and its location key while pending completion memory remains rooted.
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

// retire cancels pending I/O but keeps its memory rooted until native completion.
//
// @evidence contracts/common.md#principled-implementation Retiring separates inaccessible live coverage from the kernel's still-pending memory ownership.
// @evidence contracts/common.md#clear-and-simple-design One idempotent closer owns location removal, cancellation and handle close.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A local map deletion is not represented as completion; pending buffers remain indexed.
// @evidence contracts/common.md#meaningful-documentation The native comment explicitly warns that cancellation does not release pending memory.
// @evidence contracts/portability.md#os-neutral-implementation Supported CancelIoEx and CloseHandle calls remain in the Windows boundary.
// @evidence contracts/performance.md#efficient-algorithms Retirement uses indexed location and completion keys plus native cancellation/close; it performs no filesystem walk.
// @evidence contracts/performance.md#reuse-equivalent-work A retired key is not reused and cannot lend its late completion to another subscription.
// @evidence contracts/performance.md#bound-retention-and-release-resources Pending watches are reclaimed by their completion; nonpending watches are removed immediately. Native cancellation/close attempts do not independently certify success.
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

// drain consumes every currently available completion, including wake packets.
//
// @evidence contracts/common.md#principled-implementation The observed empty native completion port establishes only a current queue frontier, not absence of concurrent future writes.
// @evidence contracts/common.md#clear-and-simple-design One loop delegates all native result classification to completion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No elapsed quiet or retry count upgrades an unavailable native frontier into proof.
// @evidence contracts/common.md#meaningful-documentation The native comment names wake packets as well as notification completions.
// @evidence contracts/portability.md#os-neutral-implementation Native nonblocking completion polling is confined to Windows.
// @evidence contracts/performance.md#efficient-algorithms Work follows available completion batches and their decoded bytes/fanout; continuous activity can prolong a drain.
// @evidence contracts/performance.md#reuse-equivalent-work Each completion is consumed once; registration-level sharing remains with the broker request owner.
// @evidence contracts/performance.md#bound-retention-and-release-resources The loop retains no historical results and propagates native/output failures to the helper owner.
func (h *windowsBroker) drain() error {
  for {
    available, err := h.completion(0)
    if err != nil || !available {
      return err
    }
  }
}

// completion receives one native result. It decodes before rearming the same
// buffer, preserves every actual change (including A-B-A), and marks overflow or
// malformed native bytes as a gap. Zero bytes is Windows' explicit loss signal.
//
// @evidence contracts/common.md#principled-implementation Native completion identity selects its rooted buffer; loss, invalid names, malformed bytes and failed reads withdraw coverage before silence can be trusted.
// @evidence contracts/common.md#clear-and-simple-design One completion owner decodes, rearms, fans out and retires native results.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Actual change events survive equal current bytes, and a failed or incomplete batch never becomes a successful empty observation.
// @evidence contracts/common.md#meaningful-documentation Native prose explains decoding before buffer reuse and rearming before output backpressure.
// @evidence contracts/portability.md#os-neutral-implementation Windows completion/action/UTF-16 semantics stay inside the backend; consumers receive unchanged relative names or explicit loss.
// @evidence contracts/performance.md#efficient-algorithms Decoding follows B native bytes and fanout follows K subscribers and event-name bytes. Subscriber ordering is sorted once per membership epoch, then reused.
// @evidence contracts/performance.md#reuse-equivalent-work The shared native batch is decoded once and fanout ordering remains cached until subscriber membership changes.
// @evidence contracts/performance.md#bound-retention-and-release-resources Canceled watches remain rooted until their completion. Successful reads rearm the same buffer; decoded text transfers to output and failure retires handles.
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

// windowsNotification carries detached decoded text, never kernel buffer memory.
//
// @evidence contracts/common.md#principled-implementation Detached text preserves decoded event meaning without aliasing a rearmed kernel buffer.
// @evidence contracts/common.md#clear-and-simple-design A private pair carries only event kind and relative name.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No filename or success state is invented when native decoding fails.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies detached storage and its kernel boundary.
// @evidence contracts/portability.md#os-neutral-implementation UTF-16 conversion and validation belong to the decoder rather than this value.
// @evidenceExclude contracts/performance.md#efficient-algorithms This detached wire value owns no processing, sharing or native lifetime.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This detached wire value owns no processing, sharing or native lifetime.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This detached wire value owns no processing, sharing or native lifetime.
type windowsNotification struct{ kind, name string }

// decodeWindowsNotifications validates linked FILE_NOTIFY_INFORMATION records.
// Unknown actions, truncated/unaligned offsets and empty batches withdraw proof;
// even valid preceding events cannot turn an incomplete batch into silence.
//
// @evidence contracts/common.md#principled-implementation Bounded offsets, valid UTF-16 and known actions establish complete native records; any malformed or zero-length batch withdraws proof.
// @evidence contracts/common.md#clear-and-simple-design One decoder owns FILE_NOTIFY_INFORMATION layout and returns events separately from completeness.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Partial valid records never erase a later loss; unrepresentable names refuse coverage rather than guessing an alias.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain linked records, invalid offsets, partial batches and surrogate uncertainty.
// @evidence contracts/portability.md#os-neutral-implementation Windows action constants and UTF-16 decoding stay at this explicit native boundary.
// @evidence contracts/performance.md#efficient-algorithms One forward scan processes B bytes with detached text storage proportional to names; offset validation prevents overlap, overflow or cycles.
// @evidence contracts/performance.md#reuse-equivalent-work One decoded batch is shared across all subscribers by the completion owner; the decoder keeps no historical memo.
// @evidence contracts/performance.md#bound-retention-and-release-resources Only detached events escape; the caller retains the input buffer and reclaims temporary UTF-16 arrays after conversion.
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
