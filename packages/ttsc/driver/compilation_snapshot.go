package driver

import (
  "encoding/base64"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "sync"
  "time"
  "unicode/utf8"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
)

// compilationSnapshotFS retains the first compiler text, identity and directory
// answers of one invocation. Sequential native check and transform stages share
// its private document; a new invocation receives a new document. This is a
// read-once compiler view, not an atomic snapshot of the whole physical volume.
// Writes remain with the underlying filesystem and cannot replace captured reads.
// The invocation owns the uncapped captured text and removes its document after
// all stages finish. The mutex serializes native compiler readers within a stage;
// the owning JS coordinator runs stages sequentially, never concurrent writers.
type compilationSnapshotFS struct {
  vfs.FS
  mu    sync.Mutex
  path  string
  data  compilationSnapshotData
  dirty bool
}

type compilationSnapshotData struct {
  Version     int                                 `json:"version"`
  ID          string                              `json:"id"`
  Reads       map[string]compilationSnapshotRead  `json:"reads"`
  Files       map[string]bool                     `json:"files"`
  Directories map[string]bool                     `json:"directories"`
  Entries     map[string]vfs.Entries              `json:"entries"`
  Realpaths   map[string]string                   `json:"realpaths"`
  Stats       map[string]*compilationSnapshotInfo `json:"stats"`
}

type compilationSnapshotInfo struct {
  Filename string      `json:"name"`
  Length   int64       `json:"size"`
  Bits     os.FileMode `json:"mode"`
  Modified time.Time   `json:"modified"`
}

func (i *compilationSnapshotInfo) Name() string       { return i.Filename }
func (i *compilationSnapshotInfo) Size() int64        { return i.Length }
func (i *compilationSnapshotInfo) Mode() os.FileMode  { return i.Bits }
func (i *compilationSnapshotInfo) ModTime() time.Time { return i.Modified }
func (i *compilationSnapshotInfo) IsDir() bool        { return i.Bits.IsDir() }
func (i *compilationSnapshotInfo) Sys() any           { return nil }

type compilationSnapshotRead struct {
  Text string `json:"text"`
  OK   bool   `json:"ok"`
}

// compilationSnapshotReadWire keeps normal UTF-8 readable and encodes only
// text JSON cannot represent losslessly. Decoding happens once when opening a
// stage, not on each cached compiler read.
type compilationSnapshotReadWire struct {
  Text     string `json:"text"`
  OK       bool   `json:"ok"`
  Encoding string `json:"encoding,omitempty"`
}

func (r compilationSnapshotRead) MarshalJSON() ([]byte, error) {
  value := compilationSnapshotReadWire{Text: r.Text, OK: r.OK}
  if !utf8.ValidString(value.Text) {
    value.Text = base64.StdEncoding.EncodeToString([]byte(value.Text))
    value.Encoding = "base64"
  }
  return json.Marshal(value)
}

func (r *compilationSnapshotRead) UnmarshalJSON(bytes []byte) error {
  var value compilationSnapshotReadWire
  if err := json.Unmarshal(bytes, &value); err != nil {
    return err
  }
  switch value.Encoding {
  case "":
  case "base64":
    decoded, err := base64.StdEncoding.DecodeString(value.Text)
    if err != nil {
      return fmt.Errorf("invalid compilation snapshot text: %w", err)
    }
    value.Text = string(decoded)
  default:
    return fmt.Errorf("unknown compilation snapshot text encoding %q", value.Encoding)
  }
  r.Text, r.OK = value.Text, value.OK
  return nil
}

// openCompilationSnapshot accepts only an invocation-owned versioned document.
// Invalid or unreadable transport is an error, never permission to read live
// inputs under another stage's snapshot identity.
func openCompilationSnapshot(inner vfs.FS, path string) (*compilationSnapshotFS, error) {
  bytes, err := os.ReadFile(path)
  if err != nil {
    return nil, err
  }
  var data compilationSnapshotData
  if err := json.Unmarshal(bytes, &data); err != nil {
    return nil, err
  }
  if data.Version != 1 || data.ID == "" || data.Reads == nil || data.Files == nil || data.Directories == nil || data.Entries == nil || data.Realpaths == nil || data.Stats == nil {
    return nil, fmt.Errorf("invalid compilation snapshot %q", path)
  }
  return &compilationSnapshotFS{FS: inner, path: path, data: data}, nil
}

func (s *compilationSnapshotFS) key(path string) string {
  return shimtspath.Canonicalize(vfs.CaseSensitivityOf(s.FS), shimtspath.NormalizePath(path))
}

func (s *compilationSnapshotFS) realpath(path shimtspath.RootedPath) shimtspath.RootedPath {
  key := s.key(string(path))
  if value, ok := s.data.Realpaths[key]; ok {
    return shimtspath.RootedPath(value)
  }
  value := s.FS.Realpath(path)
  s.data.Realpaths[key] = string(value)
  s.dirty = true
  return value
}

func (s *compilationSnapshotFS) Realpath(path shimtspath.RootedPath) shimtspath.RootedPath {
  s.mu.Lock()
  defer s.mu.Unlock()
  return s.realpath(path)
}

func (s *compilationSnapshotFS) ReadFile(path shimtspath.RootedFilePath) (string, bool) {
  s.mu.Lock()
  defer s.mu.Unlock()
  key := s.key(string(path))
  if value, ok := s.data.Reads[key]; ok {
    return value.Text, value.OK
  }
  physical := s.realpath(shimtspath.RootedPath(path))
  physicalKey := s.key(string(physical))
  if value, ok := s.data.Reads[physicalKey]; ok {
    s.data.Reads[key] = value
    s.dirty = true
    return value.Text, value.OK
  }
  text, ok := s.FS.ReadFile(path)
  value := compilationSnapshotRead{Text: text, OK: ok}
  s.data.Reads[key] = value
  s.dirty = true
  if ok && filepath.IsAbs(string(physical)) {
    s.data.Reads[physicalKey] = value
    s.dirty = true
  }
  return text, ok
}

func (s *compilationSnapshotFS) FileExists(path shimtspath.RootedFilePath) bool {
  s.mu.Lock()
  defer s.mu.Unlock()
  key := s.key(string(path))
  if value, ok := s.data.Files[key]; ok {
    return value
  }
  value := s.FS.FileExists(path)
  s.data.Files[key] = value
  s.dirty = true
  if value {
    s.realpath(shimtspath.RootedPath(path))
  }
  return value
}

func (s *compilationSnapshotFS) DirectoryExists(path shimtspath.RootedDirectoryPath) bool {
  s.mu.Lock()
  defer s.mu.Unlock()
  key := s.key(string(path))
  if value, ok := s.data.Directories[key]; ok {
    return value
  }
  value := s.FS.DirectoryExists(path)
  s.data.Directories[key] = value
  s.dirty = true
  if value {
    s.realpath(shimtspath.RootedPath(path))
  }
  return value
}

func (s *compilationSnapshotFS) Stat(path shimtspath.RootedPath) vfs.FileInfo {
  s.mu.Lock()
  defer s.mu.Unlock()
  key := s.key(string(path))
  value, found := s.data.Stats[key]
  if !found {
    info := s.FS.Stat(path)
    if info != nil {
      value = &compilationSnapshotInfo{Filename: info.Name(), Length: info.Size(), Bits: info.Mode(), Modified: info.ModTime()}
    }
    s.data.Stats[key] = value
    s.dirty = true
    if info != nil {
      s.realpath(path)
    }
  }
  if value == nil {
    return nil
  }
  return value
}

func (s *compilationSnapshotFS) GetAccessibleEntries(path shimtspath.RootedDirectoryPath) vfs.Entries {
  s.mu.Lock()
  defer s.mu.Unlock()
  key := s.key(string(path))
  value, ok := s.data.Entries[key]
  if !ok {
    value = s.FS.GetAccessibleEntries(path)
    value.Files = append([]string{}, value.Files...)
    value.Directories = append([]string{}, value.Directories...)
    s.data.Entries[key] = value
    s.dirty = true
  }
  // The compiler owns its returned slices and may sort them in place.
  value.Files = append([]string{}, value.Files...)
  value.Directories = append([]string{}, value.Directories...)
  if value.Symlinks != nil {
    copied := make(map[string]struct{}, len(value.Symlinks))
    for key := range value.Symlinks {
      copied[key] = struct{}{}
    }
    value.Symlinks = copied
  }
  return value
}

// save transfers actual read answers to the next sequential native stage. A
// complete temporary file is renamed over the private document; no reader is
// allowed to start until this stage returns. Failed publication leaves no new
// snapshot authority and the stage reports the native failure.
func (s *compilationSnapshotFS) save() error {
  s.mu.Lock()
  defer s.mu.Unlock()
  if !s.dirty {
    return nil
  }
  bytes, err := json.Marshal(s.data)
  if err != nil {
    return err
  }
  staging := s.path + ".next"
  if err := os.WriteFile(staging, bytes, 0600); err != nil {
    return err
  }
  if err := os.Rename(staging, s.path); err != nil {
    return err
  }
  s.dirty = false
  return nil
}
