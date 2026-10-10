//go:build windows

package watchhelper

import (
  "bufio"
  "bytes"
  "encoding/binary"
  "encoding/json"
  "io"
  "os"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
  "time"

  "golang.org/x/sys/windows"
)

// TestWindowsNotificationsPreserveMutationsWithoutAccessNoise verifies the
// actual native notification boundary without a runtime or compiler child.
// A delivered marker establishes a positive stream frontier; elapsed quiet is
// never used to certify that access or earlier writes were filtered correctly.
//
//  1. Force actual access-time updates and reads, then observe a native marker.
//  2. Preserve A-B-A writes, recursion, Unicode rename/removal and separate owners.
//  3. Refuse missing/file roots, classify literal malformed/lost batches as gaps,
//     and stream ready/drain, subscriber joins/removal and EOF retirement.
//
// @evidence contracts/testing.md#behavioral-verification The actual Windows broker acquires handles, receives native notifications and emits decoded wire results; assertions distinguish access noise, real changes, recursion, independent registrations, failed acquisition, loss and actual streaming ready/drain/join/remove/EOF retirement.
// @evidence contracts/testing.md#independent-expectations Authored file names, native access timestamps and literal malformed notification bytes establish expectations independently of the implementation's mask or decoded results.
// @evidence contracts/testing.md#distinguishing-cases Real access-only updates contrast with content-preserving A-B-A writes; shallow and recursive registrations contrast on one native tree; live and removed owners, pre-join and shared mutations across actual request/reply frontiers, valid Unicode names and malformed/truncated batches distinguish coverage and loss.
// @evidence contracts/testing.md#execution-ownership This direct Go unit invokes the owning native broker and run in process using temporary files and memory streams; it installs no package and launches no compiler, runtime or helper child.
func TestWindowsNotificationsPreserveMutationsWithoutAccessNoise(t *testing.T) {
  t.Run("access and ABA", func(t *testing.T) {
    root := t.TempDir()
    source := filepath.Join(root, "source.ts")
    original := []byte("export const value = 1;\n")
    if err := os.WriteFile(source, original, 0600); err != nil {
      t.Fatal(err)
    }
    h, output := newWindowsTestBroker(t)
    if err := h.request(windowsBrokerRequest{Op: "add", ID: 1, AllEvents: true, Locations: []windowsWatchLocation{{Directory: root}}}); err != nil {
      t.Fatal(err)
    }
    // SetFileTime with nil last-write changes access alone, unlike utimes,
    // which can round or write modification time and legitimately notify.
    native, _ := windows.UTF16PtrFromString(source)
    handle, err := windows.CreateFile(native, windows.FILE_WRITE_ATTRIBUTES, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil, windows.OPEN_EXISTING, 0, 0)
    if err != nil {
      t.Fatal(err)
    }
    access := windows.NsecToFiletime(time.Date(2001, 1, 1, 0, 0, 0, 0, time.UTC).UnixNano())
    err = windows.SetFileTime(handle, nil, &access, nil)
    var observed windows.ByHandleFileInformation
    if err == nil {
      err = windows.GetFileInformationByHandle(handle, &observed)
    }
    _ = windows.CloseHandle(handle)
    if err != nil {
      t.Fatal(err)
    }
    if observed.LastAccessTime != access {
      t.Fatalf("native access update was not established: %+v", observed.LastAccessTime)
    }
    if _, err := os.ReadFile(source); err != nil {
      t.Fatal(err)
    }
    rows := windowsTestFrontier(t, h, output, root, "after-access")
    for _, row := range rows {
      if row["filename"] == "source.ts" {
        t.Fatalf("access-only update/read became mutation: %+v", row)
      }
    }
    if err := os.WriteFile(source, []byte("export const value = 2;\n"), 0600); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(source, original, 0600); err != nil {
      t.Fatal(err)
    }
    rows = windowsTestFrontier(t, h, output, root, "after-ABA")
    found := false
    for _, row := range rows {
      if row["filename"] == "source.ts" && row["eventType"] == "change" {
        found = true
      }
    }
    if !found {
      t.Fatalf("actual A-B-A writes disappeared: %+v", rows)
    }
    current, err := os.ReadFile(source)
    if err != nil || !bytes.Equal(current, original) {
      t.Fatalf("authored source restoration: %q, %v", current, err)
    }
  })
  t.Run("live native directory loss", func(t *testing.T) {
    parent := t.TempDir()
    root := filepath.Join(parent, "watched")
    if err := os.Mkdir(root, 0700); err != nil {
      t.Fatal(err)
    }
    h, output := newWindowsTestBroker(t)
    if err := h.request(windowsBrokerRequest{Op: "add", ID: 1, AllEvents: true, Locations: []windowsWatchLocation{{Directory: root}}}); err != nil {
      t.Fatal(err)
    }
    if err := os.Remove(root); err != nil {
      t.Fatal(err)
    }
    until := time.Now().Add(10 * time.Second)
    for {
      if err := h.drain(); err != nil {
        t.Fatal(err)
      }
      _ = h.out.Flush()
      rows := decodeWindowsTestRows(t, output)
      failed := false
      for _, row := range rows {
        failed = failed || row["failed"] == true
      }
      if failed {
        break
      }
      if time.Now().After(until) {
        t.Fatalf("deleted native directory retained silent authority: %+v", rows)
      }
      time.Sleep(time.Millisecond)
    }
    if len(h.locations) != 0 {
      t.Fatal("failed native watch remained live")
    }
  })
  t.Run("sharing recursion and retirement", func(t *testing.T) {
    root := t.TempDir()
    child := filepath.Join(root, "child")
    if err := os.Mkdir(child, 0700); err != nil {
      t.Fatal(err)
    }
    h, output := newWindowsTestBroker(t)
    for _, id := range []int64{1, 2, 3} {
      if err := h.request(windowsBrokerRequest{Op: "add", ID: id, AllEvents: true, Locations: []windowsWatchLocation{{Directory: root, Recursive: id == 3}}}); err != nil {
        t.Fatal(err)
      }
    }
    if len(h.locations) != 2 {
      t.Fatalf("shallow owners must share while recursion remains distinct: %d", len(h.locations))
    }
    deep := filepath.Join(child, "한글.ts")
    if err := os.WriteFile(deep, []byte("x"), 0600); err != nil {
      t.Fatal(err)
    }
    rows := windowsTestFrontier(t, h, output, root, "after-deep")
    found := false
    for _, row := range rows {
      if row["filename"] != filepath.Join("child", "한글.ts") {
        continue
      }
      if row["id"] != float64(3) {
        t.Fatalf("shallow owner heard deep entry: %+v", row)
      }
      found = true
    }
    if !found {
      t.Fatalf("recursive Unicode creation missing: %+v", rows)
    }
    h.remove(1)
    file := filepath.Join(root, "rename-before.ts")
    renamed := filepath.Join(root, "rename-after.ts")
    if err := os.WriteFile(file, []byte("x"), 0600); err != nil {
      t.Fatal(err)
    }
    if err := os.Rename(file, renamed); err != nil {
      t.Fatal(err)
    }
    if err := os.Remove(renamed); err != nil {
      t.Fatal(err)
    }
    rows = windowsTestFrontier(t, h, output, root, "after-retirement")
    old, next := false, false
    for _, row := range rows {
      if row["id"] == float64(1) {
        t.Fatalf("retired owner heard later events: %+v", row)
      }
      if row["id"] != float64(2) || row["eventType"] != "rename" {
        continue
      }
      old = old || row["filename"] == "rename-before.ts"
      next = next || row["filename"] == "rename-after.ts"
    }
    if !old || !next {
      t.Fatalf("remaining shared owner lost structural events: %+v", rows)
    }
    h.remove(2)
    h.remove(3)
    if len(h.locations) != 0 || len(h.registrations) != 0 {
      t.Fatalf("last owner did not retire native registry")
    }
  })
  t.Run("streaming ready drain sharing and EOF", func(t *testing.T) {
    root := t.TempDir()
    input, requests := io.Pipe()
    responses, output := io.Pipe()
    rows := make(chan map[string]any, 256)
    scanResult := make(chan error, 1)
    finished := make(chan int, 1)
    stopScan := make(chan struct{})
    go func() {
      code := Run(input, output, io.Discard)
      _ = input.Close()
      _ = output.Close()
      finished <- code
    }()
    go func() {
      defer close(rows)
      scanner := bufio.NewScanner(responses)
      for scanner.Scan() {
        var row map[string]any
        if err := json.Unmarshal(scanner.Bytes(), &row); err != nil {
          scanResult <- err
          return
        }
        select {
        case rows <- row:
        case <-stopScan:
          scanResult <- nil
          return
        }
      }
      scanResult <- scanner.Err()
    }()
    joined := false
    scannerJoined := false
    t.Cleanup(func() {
      _ = requests.Close()
      // Caller-owned pipe closure unblocks native output and the scanner on
      // failure. Join both owned goroutines before temporary cleanup.
      if !joined {
        _ = responses.Close()
        select {
        case <-finished:
        case <-time.After(10 * time.Second):
          t.Error("streaming native owner did not retire after caller closure")
        }
      }
      close(stopScan)
      _ = responses.Close()
      if !scannerJoined {
        select {
        case <-scanResult:
        case <-time.After(10 * time.Second):
          t.Error("protocol scanner did not retire after caller closure")
        }
      }
    })
    encoder := json.NewEncoder(requests)
    send := func(request windowsBrokerRequest) {
      t.Helper()
      if err := encoder.Encode(request); err != nil {
        t.Fatal(err)
      }
    }
    observed := []map[string]any{}
    until := func(predicate func(map[string]any) bool) {
      t.Helper()
      deadline := time.NewTimer(10 * time.Second)
      defer deadline.Stop()
      for {
        select {
        case row, open := <-rows:
          if !open {
            t.Fatal("protocol output ended before its positive frontier")
          }
          observed = append(observed, row)
          if row["failed"] == true || row["gap"] == true {
            t.Fatalf("unexpected native coverage loss: %+v", row)
          }
          if predicate(row) {
            return
          }
        case <-deadline.C:
          t.Fatalf("streaming native frontier stalled: %+v", observed)
        }
      }
    }
    ready := func(id int64) {
      t.Helper()
      send(windowsBrokerRequest{Op: "add", ID: id, AllEvents: true, Locations: []windowsWatchLocation{{Directory: root}}})
      until(func(row map[string]any) bool { return row["id"] == float64(id) && row["ready"] == true })
    }
    drain := func(id int64) {
      t.Helper()
      send(windowsBrokerRequest{Op: "drain", ID: id})
      until(func(row map[string]any) bool { return row["id"] == float64(id) && row["drained"] == true })
    }
    write := func(name string) {
      t.Helper()
      if err := os.WriteFile(filepath.Join(root, name), []byte("actual native mutation"), 0600); err != nil {
        t.Fatal(err)
      }
    }
    ready(1)
    write("before-join.ts")
    until(func(row map[string]any) bool { return row["id"] == float64(1) && row["filename"] == "before-join.ts" })
    drain(100)
    ready(2)
    write("shared.ts")
    seen := map[float64]bool{}
    until(func(row map[string]any) bool {
      if row["filename"] == "shared.ts" {
        id, ok := row["id"].(float64)
        if ok {
          seen[id] = true
        }
      }
      return seen[1] && seen[2]
    })
    drain(101)
    for _, row := range observed {
      if row["id"] == float64(2) && row["filename"] == "before-join.ts" {
        t.Fatalf("new owner received a mutation before its observed join frontier: %+v", row)
      }
    }
    send(windowsBrokerRequest{Op: "remove", ID: 1})
    drain(102)
    observed = nil
    write("after-remove.ts")
    until(func(row map[string]any) bool { return row["id"] == float64(2) && row["filename"] == "after-remove.ts" })
    drain(103)
    for _, row := range observed {
      if row["id"] == float64(1) {
        t.Fatalf("removed owner received a later native row: %+v", row)
      }
    }
    if err := requests.Close(); err != nil {
      t.Fatal(err)
    }
    select {
    case code := <-finished:
      joined = true
      if code != 0 {
        t.Fatalf("actual armed protocol did not retire successfully: %d", code)
      }
    case <-time.After(10 * time.Second):
      t.Fatal("EOF did not retire the actual native loop")
    }
    err := <-scanResult
    scannerJoined = true
    if err != nil {
      t.Fatalf("actual protocol framing failed: %v", err)
    }
    // A directory handle with no sharing cannot coexist with the helper's
    // retired FILE_LIST_DIRECTORY handle. This checks actual native closure.
    native, err := windows.UTF16PtrFromString(root)
    if err != nil {
      t.Fatal(err)
    }
    exclusive, err := windows.CreateFile(native, windows.FILE_LIST_DIRECTORY, 0, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
    if err != nil {
      t.Fatalf("EOF retained a native directory owner: %v", err)
    }
    if err := windows.CloseHandle(exclusive); err != nil {
      t.Fatal(err)
    }
  })

  t.Run("failure loss and EOF", func(t *testing.T) {
    root := t.TempDir()
    file := filepath.Join(root, "file")
    if err := os.WriteFile(file, []byte("x"), 0600); err != nil {
      t.Fatal(err)
    }
    h, output := newWindowsTestBroker(t)
    for index, location := range []string{filepath.Join(root, "missing"), file} {
      if err := h.request(windowsBrokerRequest{Op: "add", ID: int64(index + 1), Locations: []windowsWatchLocation{{Directory: root}, {Directory: location}}}); err != nil {
        t.Fatal(err)
      }
    }
    _ = h.out.Flush()
    rows := decodeWindowsTestRows(t, output)
    if len(rows) != 2 || rows[0]["failed"] != true || rows[1]["failed"] != true || len(h.locations) != 0 {
      t.Fatalf("failed partial acquisition retained success: %+v", rows)
    }
    for _, buffer := range [][]byte{nil, {0}, make([]byte, 12), windowsTestRecord(6, "x"), windowsTestRecord(3, "x")[:13]} {
      if _, complete := decodeWindowsNotifications(buffer); complete {
        t.Fatalf("malformed/lost native bytes became complete: %v", buffer)
      }
    }
    valid := windowsTestRecord(3, "한글.ts")
    decoded, complete := decodeWindowsNotifications(valid)
    if !complete || len(decoded) != 1 || decoded[0].name != "한글.ts" || decoded[0].kind != "change" {
      t.Fatalf("valid native record: %+v, %v", decoded, complete)
    }
    binary.LittleEndian.PutUint32(valid, 4)
    if _, complete := decodeWindowsNotifications(valid); complete {
      t.Fatal("overlapping native next offset accepted")
    }
    invalidName := windowsTestRecord(3, "x")
    binary.LittleEndian.PutUint16(invalidName[12:], 0xd800)
    if _, complete := decodeWindowsNotifications(invalidName); complete {
      t.Fatal("unrepresentable native identity accepted")
    }
    request, _ := json.Marshal(windowsBrokerRequest{Op: "add", ID: 7, AllEvents: true, Locations: []windowsWatchLocation{{Directory: root}}})
    var protocol bytes.Buffer
    if code := run(strings.NewReader(string(request)+"\n"), &protocol, io.Discard); code != 0 {
      t.Fatalf("EOF did not retire an armed native watch: %d", code)
    }
    if !strings.Contains(protocol.String(), `"ready":true`) {
      t.Fatalf("actual native ready missing: %s", protocol.String())
    }
  })
}

// newWindowsTestBroker opens a real completion port and retires every pending
// overlapped read before the test can release its buffer memory.
func newWindowsTestBroker(t *testing.T) (*windowsBroker, *bytes.Buffer) {
  t.Helper()
  runtime.LockOSThread()
  t.Cleanup(runtime.UnlockOSThread)
  port, err := windows.CreateIoCompletionPort(windows.InvalidHandle, 0, 0, 1)
  if err != nil {
    t.Fatal(err)
  }
  output := &bytes.Buffer{}
  out := bufio.NewWriter(output)
  h := &windowsBroker{port: port, nextKey: 1, watches: map[uintptr]*windowsDirectoryWatch{}, locations: map[windowsWatchLocation]uintptr{}, registrations: map[int64]map[uintptr]struct{}{}, out: out, encoder: json.NewEncoder(out)}
  t.Cleanup(func() {
    for key, watch := range h.watches {
      h.retire(key, watch)
    }
    for len(h.watches) != 0 {
      if _, err := h.completion(windows.INFINITE); err != nil {
        t.Errorf("native cleanup: %v", err)
        break
      }
    }
    _ = windows.CloseHandle(port)
  })
  return h, output
}

// windowsTestFrontier waits for an actual marker from every live registration,
// collecting all earlier native rows. Its deadline only refuses stalled delivery.
func windowsTestFrontier(t *testing.T, h *windowsBroker, output *bytes.Buffer, root, marker string) []map[string]any {
  t.Helper()
  if err := os.WriteFile(filepath.Join(root, marker), []byte("frontier"), 0600); err != nil {
    t.Fatal(err)
  }
  rows := []map[string]any{}
  seen := map[int64]bool{}
  until := time.Now().Add(10 * time.Second)
  for {
    if err := h.drain(); err != nil {
      t.Fatal(err)
    }
    if err := h.out.Flush(); err != nil {
      t.Fatal(err)
    }
    batch := decodeWindowsTestRows(t, output)
    rows = append(rows, batch...)
    for _, row := range batch {
      if row["filename"] == marker {
        seen[int64(row["id"].(float64))] = true
      }
      if row["failed"] == true || row["gap"] == true {
        t.Fatalf("unexpected lost coverage: %+v", row)
      }
    }
    if len(seen) == len(h.registrations) {
      return rows
    }
    if time.Now().After(until) {
      t.Fatalf("native frontier stalled: %+v", rows)
    }
    time.Sleep(time.Millisecond)
  }
}

// decodeWindowsTestRows reads actual encoded broker output and resets only the
// test's observation buffer, never backend state.
func decodeWindowsTestRows(t *testing.T, output *bytes.Buffer) []map[string]any {
  t.Helper()
  var rows []map[string]any
  decoder := json.NewDecoder(bytes.NewReader(output.Bytes()))
  for decoder.More() {
    var row map[string]any
    if err := decoder.Decode(&row); err != nil {
      t.Fatal(err)
    }
    rows = append(rows, row)
  }
  output.Reset()
  return rows
}

// windowsTestRecord authors one literal FILE_NOTIFY_INFORMATION layout.
func windowsTestRecord(action uint32, name string) []byte {
  units, _ := windows.UTF16FromString(name)
  units = units[:len(units)-1]
  buffer := make([]byte, 12+len(units)*2)
  binary.LittleEndian.PutUint32(buffer[4:], action)
  binary.LittleEndian.PutUint32(buffer[8:], uint32(len(units)*2))
  for i, unit := range units {
    binary.LittleEndian.PutUint16(buffer[12+i*2:], unit)
  }
  return buffer
}
