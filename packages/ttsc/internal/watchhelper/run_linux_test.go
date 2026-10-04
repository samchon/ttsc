//go:build linux

package watchhelper

import (
  "bufio"
  "bytes"
  "encoding/binary"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strconv"
  "strings"
  "testing"
  "time"

  "golang.org/x/sys/unix"
)

// session drives one helper over in-memory pipes.
type session struct {
  t      *testing.T
  stdin  *io.PipeWriter
  lines  chan Response
  exited chan int
}

func start(t *testing.T) *session {
  t.Helper()
  stdinReader, stdinWriter := io.Pipe()
  stdoutReader, stdoutWriter := io.Pipe()
  s := &session{
    t:      t,
    stdin:  stdinWriter,
    lines:  make(chan Response, 1024),
    exited: make(chan int, 1),
  }
  go func() {
    code := Run(stdinReader, stdoutWriter, io.Discard)
    stdoutWriter.Close()
    s.exited <- code
  }()
  go func() {
    scanner := bufio.NewScanner(stdoutReader)
    for scanner.Scan() {
      var response Response
      if err := json.Unmarshal(scanner.Bytes(), &response); err != nil {
        t.Errorf("malformed line %q: %v", scanner.Text(), err)
        continue
      }
      s.lines <- response
    }
    close(s.lines)
  }()
  t.Cleanup(func() { s.stdin.Close() })
  return s
}

func (s *session) send(request Request) {
  s.t.Helper()
  line, _ := json.Marshal(request)
  if _, err := s.stdin.Write(append(line, '\n')); err != nil {
    s.t.Fatalf("send %+v: %v", request, err)
  }
}

// until collects every line up to and including the first `matches` accepts.
func (s *session) until(matches func(Response) bool) []Response {
  s.t.Helper()
  var seen []Response
  deadline := time.After(10 * time.Second)
  for {
    select {
    case response, open := <-s.lines:
      if !open {
        s.t.Fatalf("helper exited; saw %+v", seen)
      }
      seen = append(seen, response)
      if matches(response) {
        return seen
      }
    case <-deadline:
      s.t.Fatalf("timed out; saw %+v", seen)
    }
  }
}

// sync asks for a sync and returns the lines that preceded its answer.
func (s *session) sync(id int64) []Response {
  s.t.Helper()
  s.send(Request{Op: "sync", ID: id})
  lines := s.until(func(r Response) bool { return r.ID == id && r.Synced })
  return lines[:len(lines)-1]
}

func (s *session) add(id int64, path string) {
  s.t.Helper()
  s.send(Request{Op: "add", ID: id, Path: path})
  lines := s.until(func(r Response) bool { return r.ID == id })
  if last := lines[len(lines)-1]; !last.Ready {
    s.t.Fatalf("add %d: %+v", id, last)
  }
}

func named(lines []Response, name string) []Response {
  var matched []Response
  for _, line := range lines {
    if line.Name == name {
      matched = append(matched, line)
    }
  }
  return matched
}

// Shared watch descriptors: two subscriptions of one directory each hear its
// events as rename/change responses until one is removed.
//
// @evidence contracts/testing.md#behavioral-verification Both subscription IDs receive a rename response for native creation and a change response for modification; after removal of ID 1, deletion responses for the file contain only ID 2 with type rename. Actual libuv execution and exact native descriptor identity are not observed.
// @evidence contracts/testing.md#independent-expectations The expected event types and subscription ids are literals from the helper protocol.
// @evidence contracts/testing.md#distinguishing-cases Native creation/modification are checked for both IDs; explicit removal followed by a sync barrier leaves only the remaining ID observing deletion. Exact response counts and physical descriptor sharing are not asserted.
// @evidence contracts/testing.md#execution-ownership TestSharedDescriptorsAndRemoval is a Go unit test built only on Linux: it runs the helper's Run in-process over pipes against a real inotify instance and a temporary directory, without starting a built binary.
func TestSharedDescriptorsAndRemoval(t *testing.T) {
  root := t.TempDir()
  s := start(t)
  s.add(1, root)
  s.add(2, root)

  file := filepath.Join(root, "a.ts")
  if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
    t.Fatal(err)
  }
  created := named(s.sync(100), "a.ts")
  if len(created) == 0 || created[0].Type != "rename" {
    t.Fatalf("creation: %+v", created)
  }
  for _, id := range []int64{1, 2} {
    found := false
    for _, line := range created {
      found = found || (line.ID == id && line.Type == "rename")
    }
    if !found {
      t.Fatalf("subscription %d missed the creation: %+v", id, created)
    }
  }

  if err := os.WriteFile(file, []byte("y"), 0o644); err != nil {
    t.Fatal(err)
  }
  modified := named(s.sync(101), "a.ts")
  if len(modified) == 0 || modified[0].Type != "change" {
    t.Fatalf("modification: %+v", modified)
  }
  for _, id := range []int64{1, 2} {
    found := false
    for _, line := range modified {
      found = found || (line.ID == id && line.Type == "change")
    }
    if !found {
      t.Fatalf("subscription %d missed the modification: %+v", id, modified)
    }
  }

  // Requests are served in order, so once this sync is answered the removal
  // has been applied, and the deletion below reaches only subscription 2.
  s.send(Request{Op: "remove", ID: 1})
  s.sync(150)
  if err := os.Remove(file); err != nil {
    t.Fatal(err)
  }
  removed := named(s.sync(102), "a.ts")
  if len(removed) == 0 {
    t.Fatal("the remaining subscription missed the removal")
  }
  for _, line := range removed {
    if line.ID != 2 || line.Type != "rename" {
      t.Fatalf("after removal: %+v", removed)
    }
  }
}

// Sync reads the instance empty first, so an edit made before it is answered
// is reported ahead of the answer.
//
// @evidence contracts/testing.md#behavioral-verification A sync answer is preceded by all 200 events for files created before it.
// @evidence contracts/testing.md#independent-expectations The expected count of 200 distinct names is the number of files the test wrote.
// @evidence contracts/testing.md#distinguishing-cases A helper that answered sync before draining its instance would report fewer names.
// @evidence contracts/testing.md#execution-ownership TestSyncFollowsEveryQueuedEvent is a Go unit test built only on Linux: it runs the helper's Run in-process over pipes against a real inotify instance and a temporary directory, without starting a built binary.
func TestSyncFollowsEveryQueuedEvent(t *testing.T) {
  root := t.TempDir()
  s := start(t)
  s.add(1, root)
  for index := 0; index < 200; index++ {
    name := filepath.Join(root, fmt.Sprintf("f%03d", index))
    if err := os.WriteFile(name, []byte("x"), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  lines := s.sync(100)
  names := map[string]bool{}
  for _, line := range lines {
    names[line.Name] = true
  }
  if len(names) != 200 {
    t.Fatalf("heard %d of 200 entries before the sync answer", len(names))
  }
}

// A deleted directory ends its subscription with `gone`, and its parent hears
// the deletion as a rename of the entry.
//
// @evidence contracts/testing.md#behavioral-verification Native deletion yields a gone response for child ID 2 and a parent ID 1 rename for child. After an explicit remove request for ID 2, recreation yields no response for that ID before the next sync reply; this does not independently certify automatic helper-map cleanup before explicit removal.
// @evidence contracts/testing.md#independent-expectations Authored IDs 1/2, name child, type rename and gone=true are checked in decoded responses, then any ID-2 response is forbidden in the next sync interval. These are semantic field expectations rather than literal full JSON lines or exact response counts.
// @evidence contracts/testing.md#distinguishing-cases Watched child deletion, simultaneous parent attention and recreation after explicit removal have different expected responses. Gone/rename ordering and duplicate response counts are not asserted.
// @evidence contracts/testing.md#execution-ownership TestSelfDeletionEndsTheSubscription is a Go unit test built only on Linux: it runs the helper's Run in-process over pipes against a real inotify instance and a temporary directory, without starting a built binary.
func TestSelfDeletionEndsTheSubscription(t *testing.T) {
  root := t.TempDir()
  child := filepath.Join(root, "child")
  if err := os.Mkdir(child, 0o755); err != nil {
    t.Fatal(err)
  }
  s := start(t)
  s.add(1, root)
  s.add(2, child)
  if err := os.Remove(child); err != nil {
    t.Fatal(err)
  }
  lines := s.sync(100)
  gone, renamed := false, false
  for _, line := range lines {
    gone = gone || (line.ID == 2 && line.Gone)
    renamed = renamed || (line.ID == 1 && line.Name == "child" && line.Type == "rename")
  }
  if !gone || !renamed {
    t.Fatalf("gone=%v renamed=%v: %+v", gone, renamed, lines)
  }

  // Explicit removal precedes recreation; ID 2 must not hear the later event.
  s.send(Request{Op: "remove", ID: 2})
  if err := os.Mkdir(child, 0o755); err != nil {
    t.Fatal(err)
  }
  for _, line := range s.sync(101) {
    if line.ID == 2 {
      t.Fatalf("a gone subscription heard %+v", line)
    }
  }
}

// A directory that cannot be watched is answered with an error.
//
// @evidence contracts/testing.md#behavioral-verification Adding a path that does not exist answers with an error and no ready reply.
// @evidence contracts/testing.md#independent-expectations A missing temporary subdirectory cannot be watched by the kernel, so the error reply is the contract.
// @evidence contracts/testing.md#distinguishing-cases A missing directory contrasts with the watchable directories of sibling tests.
// @evidence contracts/testing.md#execution-ownership TestAddReportsAnUnwatchableDirectory is a Go unit test built only on Linux: it runs the helper's Run in-process over pipes against a real inotify instance and a temporary directory, without starting a built binary.
func TestAddReportsAnUnwatchableDirectory(t *testing.T) {
  s := start(t)
  s.send(Request{Op: "add", ID: 1, Path: filepath.Join(t.TempDir(), "missing")})
  lines := s.until(func(r Response) bool { return r.ID == 1 })
  if last := lines[len(lines)-1]; last.Error == "" || last.Ready {
    t.Fatalf("missing directory: %+v", last)
  }
}

// The helper exits cleanly once its client closes stdin.
//
// @evidence contracts/testing.md#behavioral-verification Actual in-process Run returns code 0 and its session wrapper reports that result within ten seconds after the input pipe is closed. A built child-process exit, output-reader join and descendant shutdown are not exercised.
// @evidence contracts/testing.md#independent-expectations Exit code 0 is the documented clean-shutdown status.
// @evidence contracts/testing.md#distinguishing-cases A helper that kept running would fail the timeout branch.
// @evidence contracts/testing.md#execution-ownership The Linux-only discoverable Go unit runs actual Run in a goroutine over owned input/output pipes and a real inotify instance. Closing the writer delivers EOF; the wrapper closes its output writer before reporting the return code. No temporary filesystem fixture, native child or built product host is started, and the output-reader goroutine's completion is not asserted.
func TestExitsWhenStdinCloses(t *testing.T) {
  s := start(t)
  s.stdin.Close()
  select {
  case code := <-s.exited:
    if code != 0 {
      t.Fatalf("exit code %d", code)
    }
  case <-time.After(10 * time.Second):
    t.Fatal("the helper outlived its client")
  }
}

// The event decoder: an overflow produces one unscoped overflow response, a
// directory entry's attribute change produces a rename response, a
// nameless event and an unknown descriptor are dropped, and the end of a watch
// is reported once.
//
// @evidence contracts/testing.md#behavioral-verification Actual dispatch emits ordered change/rename responses for two subscribers, one unscoped overflow response, and one gone response per subscriber, then forgets both subscription maps. A nameless attribute, unknown descriptor and post-ignored event emit nothing. Actual kernel generation, libuv execution and downstream overflow fan-out are not observed.
// @evidence contracts/testing.md#independent-expectations Seven complete Response values and empty subscription maps are authored expectations. Input headers are independently hand-encoded with native byte order and declared inotify masks; actual JSON output is decoded before comparing semantic values rather than byte formatting.
// @evidence contracts/testing.md#distinguishing-cases Modify, directory-attribute, nameless attribute, unknown descriptor, queue overflow, ignored-watch and post-ignored create events cover distinct branches. Two out-of-order inserted subscriber IDs require ascending response order. Truncated headers/payloads and native descriptor removal are not exercised.
// @evidence contracts/testing.md#execution-ownership TestDispatchMapsEventsAsLibuvDoes is a Go unit test built only on Linux: it feeds hand-encoded inotify event bytes to the decoder of an in-process helper and starts no process.
func TestDispatchMapsEventsAsLibuvDoes(t *testing.T) {
  var out bytes.Buffer
  h := newHelper(-1, &out)
  h.watches[7] = map[int64]struct{}{3: {}, 1: {}}
  h.descriptors[1] = 7
  h.descriptors[3] = 7

  var data []byte
  add := func(wd int32, mask uint32, name string) {
    padded := []byte(name)
    if len(padded) != 0 {
      padded = append(padded, make([]byte, 16-len(padded)%16)...)
    }
    header := make([]byte, unix.SizeofInotifyEvent)
    binary.NativeEndian.PutUint32(header[0:], uint32(wd))
    binary.NativeEndian.PutUint32(header[4:], mask)
    binary.NativeEndian.PutUint32(header[12:], uint32(len(padded)))
    data = append(append(data, header...), padded...)
  }
  add(7, unix.IN_MODIFY, "a.ts")
  add(7, unix.IN_ATTRIB|unix.IN_ISDIR, "sub")
  add(7, unix.IN_ATTRIB, "")
  add(9, unix.IN_CREATE, "elsewhere.ts")
  add(-1, unix.IN_Q_OVERFLOW, "")
  add(7, unix.IN_IGNORED, "")
  add(7, unix.IN_CREATE, "after.ts")
  h.dispatch(data)
  h.out.Flush()

  var lines []Response
  for _, line := range bytes.Split(bytes.TrimSpace(out.Bytes()), []byte("\n")) {
    var response Response
    if err := json.Unmarshal(line, &response); err != nil {
      t.Fatal(err)
    }
    lines = append(lines, response)
  }
  want := []Response{
    {ID: 1, Type: "change", Name: "a.ts"},
    {ID: 3, Type: "change", Name: "a.ts"},
    {ID: 1, Type: "rename", Name: "sub"},
    {ID: 3, Type: "rename", Name: "sub"},
    {Overflow: true},
    {ID: 1, Gone: true},
    {ID: 3, Gone: true},
  }
  if len(lines) != len(want) {
    t.Fatalf("lines %+v, want %+v", lines, want)
  }
  for index := range want {
    if lines[index] != want[index] {
      t.Fatalf("line %d: %+v, want %+v", index, lines[index], want[index])
    }
  }
  if len(h.watches) != 0 || len(h.descriptors) != 0 {
    t.Fatalf("an ended watch is forgotten: %v %v", h.watches, h.descriptors)
  }
}

// A real kernel overflow: an instance nobody reads fills past
// fs.inotify.max_queued_events, the kernel drops the rest and queues one
// IN_Q_OVERFLOW event, and the helper's own read and decode report it.
//
// @evidence contracts/testing.md#behavioral-verification A real kernel overflow, created by filling an unread inotify instance past fs.inotify.max_queued_events, is reported by the helper's own drain and decode as an overflow response.
// @evidence contracts/testing.md#independent-expectations The kernel's queue limit is read from /proc and exceeded by one creation, so the overflow is produced by the kernel and not by the test's encoding.
// @evidence contracts/testing.md#distinguishing-cases Distinct file names fill an unread native queue through its configured limit and one extra creation; decoded output must contain an overflow response. No synthetic event is substituted and a large native limit is not a reason to skip this case. Exact overflow count and downstream invalidation are not asserted.
// @evidence contracts/testing.md#execution-ownership The Linux-only discoverable Go unit owns a real inotify descriptor and temporary directory, creates limit+1 distinct empty files before draining actual helper output, and defers native descriptor close. File and output populations scale with the configured queue limit; no separate test cap or kernel setting change is applied, and no child process or product host runs.
func TestReportsARealKernelOverflow(t *testing.T) {
  setting, err := os.ReadFile("/proc/sys/fs/inotify/max_queued_events")
  if err != nil {
    t.Fatalf("read the queue limit: %v", err)
  }
  limit, err := strconv.Atoi(strings.TrimSpace(string(setting)))
  if err != nil {
    t.Fatalf("parse the queue limit %q: %v", setting, err)
  }
  fd, err := unix.InotifyInit1(unix.IN_NONBLOCK | unix.IN_CLOEXEC)
  if err != nil {
    t.Fatal(err)
  }
  defer unix.Close(fd)
  root := t.TempDir()
  wd, err := unix.InotifyAddWatch(fd, root, watchMask)
  if err != nil {
    t.Fatal(err)
  }
  var out bytes.Buffer
  h := newHelper(fd, &out)
  h.watches[int32(wd)] = map[int64]struct{}{1: {}}
  h.descriptors[1] = int32(wd)
  // Each creation queues one event under its own name, so none coalesce.
  for index := 0; index <= limit; index++ {
    file, err := os.Create(filepath.Join(root, fmt.Sprintf("f%06d", index)))
    if err != nil {
      t.Fatal(err)
    }
    if err := file.Close(); err != nil {
      t.Fatal(err)
    }
  }
  if err := h.drain(); err != nil {
    t.Fatal(err)
  }
  h.out.Flush()
  overflowed := false
  for _, line := range bytes.Split(bytes.TrimSpace(out.Bytes()), []byte("\n")) {
    var response Response
    if err := json.Unmarshal(line, &response); err != nil {
      t.Fatal(err)
    }
    overflowed = overflowed || response.Overflow
  }
  if !overflowed {
    t.Fatalf("no overflow reported after %d creations", limit+1)
  }
}
