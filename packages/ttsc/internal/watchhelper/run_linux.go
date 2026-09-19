//go:build linux

package watchhelper

import (
  "bufio"
  "encoding/binary"
  "encoding/json"
  "fmt"
  "io"
  "sort"

  "golang.org/x/sys/unix"
)

// watchMask is libuv's mask for a directory watch (src/unix/linux.c), so the
// helper hears exactly what `fs.watch` heard.
const watchMask = unix.IN_ATTRIB | unix.IN_CREATE | unix.IN_MODIFY |
  unix.IN_DELETE | unix.IN_DELETE_SELF | unix.IN_MOVE_SELF |
  unix.IN_MOVED_FROM | unix.IN_MOVED_TO

// endMask holds the events after which a watch reports nothing more about the
// directory it was opened on.
const endMask = unix.IN_IGNORED | unix.IN_DELETE_SELF | unix.IN_MOVE_SELF |
  unix.IN_UNMOUNT

// Run serves the protocol over stdin and stdout until stdin closes, and
// returns the process exit code.
//
// One loop polls the inotify instance and a wake pipe the stdin reader writes
// after queueing each request, so events and replies leave in the order they
// were produced, and a `sync` can read the instance empty before it answers.
func Run(stdin io.Reader, stdout io.Writer, stderr io.Writer) int {
  fd, err := unix.InotifyInit1(unix.IN_NONBLOCK | unix.IN_CLOEXEC)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc __watch: %v\n", err)
    return 1
  }
  defer unix.Close(fd)
  var wake [2]int
  if err := unix.Pipe2(wake[:], unix.O_NONBLOCK|unix.O_CLOEXEC); err != nil {
    fmt.Fprintf(stderr, "ttsc __watch: %v\n", err)
    return 1
  }
  defer unix.Close(wake[0])
  defer unix.Close(wake[1])

  requests := make(chan Request, 256)
  go readRequests(stdin, requests, wake[1])

  h := newHelper(fd, stdout)
  fds := []unix.PollFd{
    {Fd: int32(fd), Events: unix.POLLIN},
    {Fd: int32(wake[0]), Events: unix.POLLIN},
  }
  for {
    fds[0].Revents, fds[1].Revents = 0, 0
    if _, err := unix.Poll(fds, -1); err != nil {
      if err == unix.EINTR {
        continue
      }
      fmt.Fprintf(stderr, "ttsc __watch: %v\n", err)
      return 1
    }
    if fds[0].Revents != 0 {
      if err := h.drain(); err != nil {
        fmt.Fprintf(stderr, "ttsc __watch: %v\n", err)
        return 1
      }
    }
    if fds[1].Revents != 0 {
      emptyWake(wake[0])
      for pending := true; pending; {
        select {
        case request, open := <-requests:
          if !open {
            h.out.Flush()
            return 0
          }
          if err := h.handle(request); err != nil {
            fmt.Fprintf(stderr, "ttsc __watch: %v\n", err)
            return 1
          }
        default:
          pending = false
        }
      }
    }
    // A client that went away cannot be told anything more.
    if err := h.out.Flush(); err != nil {
      return 0
    }
  }
}

// readRequests decodes stdin into requests, waking the loop after each, and
// closes the channel at the end of input.
func readRequests(stdin io.Reader, requests chan<- Request, wake int) {
  scanner := bufio.NewScanner(stdin)
  scanner.Buffer(make([]byte, 64*1024), 16*1024*1024)
  for scanner.Scan() {
    var request Request
    if json.Unmarshal(scanner.Bytes(), &request) != nil {
      continue
    }
    requests <- request
    // A full pipe already holds a wake-up.
    unix.Write(wake, []byte{0})
  }
  close(requests)
  unix.Write(wake, []byte{0})
}

// emptyWake reads the wake pipe empty.
func emptyWake(fd int) {
  var buffer [64]byte
  for {
    n, err := unix.Read(fd, buffer[:])
    if err == unix.EINTR {
      continue
    }
    if err != nil || n <= 0 {
      return
    }
  }
}

// helper holds one inotify instance and the subscriptions sharing its watch
// descriptors.
type helper struct {
  fd      int
  out     *bufio.Writer
  encoder *json.Encoder
  // watches maps a watch descriptor to the subscriptions it serves.
  watches map[int32]map[int64]struct{}
  // descriptors maps a subscription to its watch descriptor.
  descriptors map[int64]int32
  buffer      []byte
}

func newHelper(fd int, stdout io.Writer) *helper {
  out := bufio.NewWriter(stdout)
  return &helper{
    fd:          fd,
    out:         out,
    encoder:     json.NewEncoder(out),
    watches:     map[int32]map[int64]struct{}{},
    descriptors: map[int64]int32{},
    buffer:      make([]byte, 64*1024),
  }
}

func (h *helper) emit(response Response) {
  // Encoding these fields cannot fail, and a write error surfaces at the
  // loop's flush.
  h.encoder.Encode(response)
}

func (h *helper) handle(request Request) error {
  switch request.Op {
  case "add":
    h.add(request.ID, request.Path)
  case "remove":
    h.remove(request.ID)
  case "sync":
    if err := h.drain(); err != nil {
      return err
    }
    h.emit(Response{ID: request.ID, Synced: true})
  }
  return nil
}

func (h *helper) add(id int64, path string) {
  wd, err := unix.InotifyAddWatch(h.fd, path, watchMask)
  if err != nil {
    h.emit(Response{ID: id, Error: err.Error()})
    return
  }
  descriptor := int32(wd)
  subscriptions := h.watches[descriptor]
  if subscriptions == nil {
    subscriptions = map[int64]struct{}{}
    h.watches[descriptor] = subscriptions
  }
  subscriptions[id] = struct{}{}
  h.descriptors[id] = descriptor
  h.emit(Response{ID: id, Ready: true})
}

func (h *helper) remove(id int64) {
  descriptor, ok := h.descriptors[id]
  if !ok {
    return
  }
  delete(h.descriptors, id)
  subscriptions := h.watches[descriptor]
  delete(subscriptions, id)
  if len(subscriptions) != 0 {
    return
  }
  delete(h.watches, descriptor)
  // The kernel may have removed the watch already; its IN_IGNORED then finds
  // no subscription.
  unix.InotifyRmWatch(h.fd, uint32(descriptor))
}

// drain reads the instance until it is empty.
func (h *helper) drain() error {
  for {
    n, err := unix.Read(h.fd, h.buffer)
    if err == unix.EINTR {
      continue
    }
    if err == unix.EAGAIN {
      return nil
    }
    if err != nil {
      return err
    }
    if n <= 0 {
      return nil
    }
    h.dispatch(h.buffer[:n])
  }
}

// dispatch reports every event in one read of the instance.
func (h *helper) dispatch(data []byte) {
  for offset := 0; offset+unix.SizeofInotifyEvent <= len(data); {
    wd := int32(binary.NativeEndian.Uint32(data[offset:]))
    mask := binary.NativeEndian.Uint32(data[offset+4:])
    length := int(binary.NativeEndian.Uint32(data[offset+12:]))
    start := offset + unix.SizeofInotifyEvent
    end := start + length
    if end > len(data) {
      return
    }
    name := data[start:end]
    for len(name) != 0 && name[len(name)-1] == 0 {
      name = name[:len(name)-1]
    }
    h.event(wd, mask, string(name))
    offset = end
  }
}

// event reports one inotify event to the subscriptions it concerns.
func (h *helper) event(wd int32, mask uint32, name string) {
  if mask&unix.IN_Q_OVERFLOW != 0 {
    h.emit(Response{Overflow: true})
    return
  }
  subscriptions := h.watches[wd]
  if len(subscriptions) == 0 {
    return
  }
  ids := sortedIDs(subscriptions)
  if mask&endMask != 0 {
    for _, id := range ids {
      delete(h.descriptors, id)
      h.emit(Response{ID: id, Gone: true})
    }
    delete(h.watches, wd)
    // A moved directory keeps its watch, which now follows another path.
    if mask&unix.IN_IGNORED == 0 {
      unix.InotifyRmWatch(h.fd, uint32(wd))
    }
    return
  }
  // The directory's own attributes say nothing about its entries.
  if name == "" {
    return
  }
  // libuv reports CHANGE only for an event that is nothing but an attribute
  // or content change, and RENAME for every other.
  kind := "change"
  if mask&^uint32(unix.IN_ATTRIB|unix.IN_MODIFY) != 0 {
    kind = "rename"
  }
  for _, id := range ids {
    h.emit(Response{ID: id, Type: kind, Name: name})
  }
}

func sortedIDs(subscriptions map[int64]struct{}) []int64 {
  ids := make([]int64, 0, len(subscriptions))
  for id := range subscriptions {
    ids = append(ids, id)
  }
  sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
  return ids
}
