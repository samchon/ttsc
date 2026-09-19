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
// events, typed as libuv types them, until one is removed.
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
      found = found || line.ID == id
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

  // The descriptor is released, so a later event reaches nobody through it.
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
func TestAddReportsAnUnwatchableDirectory(t *testing.T) {
  s := start(t)
  s.send(Request{Op: "add", ID: 1, Path: filepath.Join(t.TempDir(), "missing")})
  lines := s.until(func(r Response) bool { return r.ID == 1 })
  if last := lines[len(lines)-1]; last.Error == "" || last.Ready {
    t.Fatalf("missing directory: %+v", last)
  }
}

// The helper exits cleanly once its client closes stdin.
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

// The event decoder: an overflow reaches every subscription at once, a
// directory entry's attribute change is a rename as libuv reports it, a
// nameless event and an unknown descriptor are dropped, and the end of a watch
// is reported once.
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
