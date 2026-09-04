package driver

import (
  "crypto/sha256"
  "encoding/hex"
  "path/filepath"
  "slices"
  "sync"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
)

var observedDirectoryDigest = func() string {
  digest := sha256.Sum256([]byte("ttsc:host-input:directory\x00"))
  return hex.EncodeToString(digest[:])
}()

type inputProofFailure string

const (
  inputProofAccessibleEntriesChanged inputProofFailure = "accessible-entries-changed"
  inputProofContentChanged           inputProofFailure = "content-changed"
  inputProofContentUnavailable       inputProofFailure = "content-unavailable"
  inputProofDirectoryExistsChanged   inputProofFailure = "directory-exists-changed"
  inputProofFileExistsChanged        inputProofFailure = "file-exists-changed"
  inputProofInvalidPath              inputProofFailure = "invalid-path"
  inputProofPredicateConflict        inputProofFailure = "predicate-conflict"
  inputProofResolutionChanged        inputProofFailure = "resolution-changed"
  inputProofRealpathChanged          inputProofFailure = "realpath-changed"
  inputProofRealpathUnavailable      inputProofFailure = "realpath-unavailable"
  inputProofStatChanged              inputProofFailure = "stat-changed"
  inputProofUnobserved               inputProofFailure = "unobserved"
  inputProofUnsupportedInputKind     inputProofFailure = "unsupported-input-kind"
)

// TransformInputReadObservation is the exact result of one compiler ReadFile
// predicate. A failed read carries OK=false and no guessed filesystem kind.
type TransformInputReadObservation struct {
  OK   bool   `json:"ok"`
  Hash string `json:"hash,omitempty"`
}

// TransformInputRealpathObservation is the exact result of one compiler
// Realpath predicate or an identity read already performed beside a successful
// existence predicate.
type TransformInputRealpathObservation struct {
  OK   bool   `json:"ok"`
  Path string `json:"path,omitempty"`
}

// TransformInputEntriesObservation is the exact result of one compiler
// GetAccessibleEntries predicate. Both lists retain TypeScript-Go's sorted
// lexical child names, including followed directory links and junctions.
type TransformInputEntriesObservation struct {
  Directories []string `json:"directories"`
  Files       []string `json:"files"`
}

// TransformInputObservation preserves independent compiler filesystem
// predicates for one lexical path. False FileExists and true DirectoryExists
// are compatible constraints, not a path-kind race.
type TransformInputObservation struct {
  AccessibleEntries *TransformInputEntriesObservation  `json:"accessibleEntries,omitempty"`
  DirectoryExists   *bool                              `json:"directoryExists,omitempty"`
  FileExists        *bool                              `json:"fileExists,omitempty"`
  ReadFile          *TransformInputReadObservation     `json:"readFile,omitempty"`
  Realpath          *TransformInputRealpathObservation `json:"realpath,omitempty"`
  Stat              *string                            `json:"stat,omitempty"`
}

type observedInput struct {
  failure inputProofFailure
  proof   TransformInputObservation
}

// inputObservationFS records the exact disk state returned through the
// compiler filesystem. A later transform envelope can therefore prove which
// bytes and resolution-candidate states produced its resident Program instead
// of attaching post-compile disk hashes to an earlier result.
type inputObservationFS struct {
  vfs.FS
  caseSensitive        bool
  mu                   sync.Mutex
  observations         map[string]observedInput
  observationOrder     []string
  observationSpellings map[string]string
}

func newInputObservationFS(inner vfs.FS) *inputObservationFS {
  return &inputObservationFS{
    FS:                   inner,
    caseSensitive:        inner.UseCaseSensitiveFileNames(),
    observations:         map[string]observedInput{},
    observationSpellings: map[string]string{},
  }
}

func (fs *inputObservationFS) FileExists(path string) bool {
  exists := fs.FS.FileExists(path)
  proof := TransformInputObservation{FileExists: boolPointer(exists)}
  if exists {
    // Existence participates in resolution, but only ReadFile returns bytes
    // that can influence the resident Program. Do not duplicate every
    // resolver probe with an eager file read.
    proof.Realpath = fs.currentRealpath(path)
  }
  fs.observe(path, observedInput{proof: proof})
  return exists
}

func (fs *inputObservationFS) ReadFile(path string) (string, bool) {
  contents, ok := fs.FS.ReadFile(path)
  if ok {
    digest := sha256.Sum256([]byte(contents))
    hash := hex.EncodeToString(digest[:])
    fs.observe(path, observedInput{
      proof: TransformInputObservation{
        ReadFile: &TransformInputReadObservation{OK: true, Hash: hash},
        Realpath: fs.currentRealpath(path),
      },
    })
  } else {
    fs.observe(path, observedInput{
      proof: TransformInputObservation{
        ReadFile: &TransformInputReadObservation{OK: false},
      },
    })
  }
  return contents, ok
}

func (fs *inputObservationFS) DirectoryExists(path string) bool {
  exists := fs.FS.DirectoryExists(path)
  proof := TransformInputObservation{DirectoryExists: boolPointer(exists)}
  if exists {
    proof.Realpath = fs.currentRealpath(path)
  }
  fs.observe(path, observedInput{proof: proof})
  return exists
}

func (fs *inputObservationFS) GetAccessibleEntries(path string) vfs.Entries {
  entries := fs.FS.GetAccessibleEntries(path)
  fs.observe(path, observedInput{
    proof: TransformInputObservation{
      AccessibleEntries: &TransformInputEntriesObservation{
        Directories: append([]string{}, entries.Directories...),
        Files:       append([]string{}, entries.Files...),
      },
    },
  })
  return entries
}

func (fs *inputObservationFS) Stat(path string) vfs.FileInfo {
  info := fs.FS.Stat(path)
  kind := "missing"
  if info == nil {
    fs.observe(path, observedInput{
      proof: TransformInputObservation{Stat: &kind},
    })
  } else if info.IsDir() {
    kind = "directory"
    fs.observe(path, observedInput{
      proof: TransformInputObservation{
        Stat:     &kind,
        Realpath: fs.currentRealpath(path),
      },
    })
  } else {
    kind = "file"
    fs.observe(path, observedInput{
      proof: TransformInputObservation{
        Stat:     &kind,
        Realpath: fs.currentRealpath(path),
      },
    })
  }
  return info
}

func (fs *inputObservationFS) Realpath(path string) string {
  realpath := fs.FS.Realpath(path)
  fs.observe(path, observedInput{
    proof: TransformInputObservation{Realpath: realpathObservation(realpath)},
  })
  return realpath
}

func (fs *inputObservationFS) currentRealpath(path string) *TransformInputRealpathObservation {
  return realpathObservation(fs.FS.Realpath(path))
}

func realpathObservation(realpath string) *TransformInputRealpathObservation {
  if realpath == "" {
    return &TransformInputRealpathObservation{OK: false}
  }
  return &TransformInputRealpathObservation{
    OK:   true,
    Path: filepath.Clean(realpath),
  }
}

func boolPointer(value bool) *bool {
  return &value
}

func (fs *inputObservationFS) observationKey(path string) string {
  if !filepath.IsAbs(path) {
    return ""
  }
  return shimtspath.GetCanonicalFileName(
    shimtspath.NormalizePath(path),
    fs.caseSensitive,
  )
}

func (fs *inputObservationFS) observe(path string, next observedInput) {
  key := fs.observationKey(path)
  if key == "" {
    return
  }
  fs.mu.Lock()
  defer fs.mu.Unlock()
  if _, found := fs.observationSpellings[key]; !found {
    fs.observationSpellings[key] = filepath.Clean(path)
    fs.observationOrder = append(fs.observationOrder, key)
  }
  keys := []string{key}
  // A compiler read can arrive through an 8.3, case-variant, or already-real
  // spelling while resolution recorded the selected lexical alias. Index the
  // returned bytes by the final physical path too, so proof can join the two
  // observations without another disk read.
  if next.proof.ReadFile != nil && next.proof.ReadFile.OK && next.proof.Realpath != nil && next.proof.Realpath.OK {
    physicalKey := fs.observationKey(next.proof.Realpath.Path)
    if physicalKey != "" && physicalKey != key {
      keys = append(keys, physicalKey)
    }
  }
  for _, observationKey := range keys {
    fs.mergeObservation(observationKey, next)
  }
}

// mergeObservation merges one observation key while the caller holds fs.mu.
func (fs *inputObservationFS) mergeObservation(key string, next observedInput) {
  previous, found := fs.observations[key]
  if !found {
    fs.observations[key] = next
    return
  }
  if previous.failure != "" {
    return
  }
  if next.failure != "" {
    fs.failObservation(key, previous, next.failure)
    return
  }
  if previous.proof.FileExists != nil && next.proof.FileExists != nil && *previous.proof.FileExists != *next.proof.FileExists {
    fs.failObservation(key, previous, inputProofFileExistsChanged)
    return
  }
  if previous.proof.DirectoryExists != nil && next.proof.DirectoryExists != nil && *previous.proof.DirectoryExists != *next.proof.DirectoryExists {
    fs.failObservation(key, previous, inputProofDirectoryExistsChanged)
    return
  }
  if previous.proof.Stat != nil && next.proof.Stat != nil && *previous.proof.Stat != *next.proof.Stat {
    fs.failObservation(key, previous, inputProofStatChanged)
    return
  }
  if previous.proof.ReadFile != nil && next.proof.ReadFile != nil && !sameReadObservation(previous.proof.ReadFile, next.proof.ReadFile) {
    fs.failObservation(key, previous, inputProofContentChanged)
    return
  }
  if previous.proof.Realpath != nil && next.proof.Realpath != nil && !sameRealpathObservation(previous.proof.Realpath, next.proof.Realpath) {
    fs.failObservation(key, previous, inputProofRealpathChanged)
    return
  }
  if previous.proof.AccessibleEntries != nil && next.proof.AccessibleEntries != nil && !sameEntriesObservation(previous.proof.AccessibleEntries, next.proof.AccessibleEntries) {
    fs.failObservation(key, previous, inputProofAccessibleEntriesChanged)
    return
  }
  if previous.proof.AccessibleEntries == nil {
    previous.proof.AccessibleEntries = next.proof.AccessibleEntries
  }
  if previous.proof.FileExists == nil {
    previous.proof.FileExists = next.proof.FileExists
  }
  if previous.proof.DirectoryExists == nil {
    previous.proof.DirectoryExists = next.proof.DirectoryExists
  }
  if previous.proof.Stat == nil {
    previous.proof.Stat = next.proof.Stat
  }
  if previous.proof.ReadFile == nil {
    previous.proof.ReadFile = next.proof.ReadFile
  }
  if previous.proof.Realpath == nil {
    previous.proof.Realpath = next.proof.Realpath
  }
  if !transformInputObservationCompatible(previous.proof) {
    fs.failObservation(key, previous, inputProofPredicateConflict)
    return
  }
  fs.observations[key] = previous
}

func sameEntriesObservation(left, right *TransformInputEntriesObservation) bool {
  return slices.Equal(left.Directories, right.Directories) && slices.Equal(left.Files, right.Files)
}

// observedPaths returns the exact lexical spellings on which this wrapper
// observed at least one filesystem predicate, in first-observation order.
func (fs *inputObservationFS) observedPaths() []string {
  fs.mu.Lock()
  defer fs.mu.Unlock()
  output := make([]string, 0, len(fs.observationOrder))
  for _, key := range fs.observationOrder {
    output = append(output, fs.observationSpellings[key])
  }
  return output
}

func (fs *inputObservationFS) observedAccessibleEntries(path string) bool {
  key := fs.observationKey(path)
  if key == "" {
    return false
  }
  fs.mu.Lock()
  defer fs.mu.Unlock()
  observation, found := fs.observations[key]
  return found && observation.proof.AccessibleEntries != nil
}

// mergeFrom joins a replay transaction into the compiler-time observation
// set. Any predicate that changed between construction and replay becomes a
// stable proof failure instead of authorizing output from mixed generations.
func (fs *inputObservationFS) mergeFrom(replay *inputObservationFS) {
  if replay == nil {
    return
  }
  replay.mu.Lock()
  observations := make(map[string]observedInput, len(replay.observations))
  for key, observation := range replay.observations {
    observations[key] = observation
  }
  order := append([]string{}, replay.observationOrder...)
  spellings := make(map[string]string, len(replay.observationSpellings))
  for key, spelling := range replay.observationSpellings {
    spellings[key] = spelling
  }
  replay.mu.Unlock()

  fs.mu.Lock()
  defer fs.mu.Unlock()
  for _, key := range order {
    if _, found := fs.observationSpellings[key]; !found {
      fs.observationSpellings[key] = spellings[key]
      fs.observationOrder = append(fs.observationOrder, key)
    }
  }
  for key, observation := range observations {
    fs.mergeObservation(key, observation)
  }
}

func (fs *inputObservationFS) failObservation(key string, observed observedInput, failure inputProofFailure) {
  observed.failure = failure
  fs.observations[key] = observed
}

func sameReadObservation(left, right *TransformInputReadObservation) bool {
  return left.OK == right.OK && left.Hash == right.Hash
}

func sameRealpathObservation(left, right *TransformInputRealpathObservation) bool {
  return left.OK == right.OK && left.Path == right.Path
}

func transformInputObservationCompatible(observation TransformInputObservation) bool {
  hasAccessibleEntries := observation.AccessibleEntries != nil &&
    (len(observation.AccessibleEntries.Directories) != 0 || len(observation.AccessibleEntries.Files) != 0)
  if hasAccessibleEntries &&
    ((observation.FileExists != nil && *observation.FileExists) ||
      (observation.DirectoryExists != nil && !*observation.DirectoryExists) ||
      (observation.Stat != nil && *observation.Stat != "directory") ||
      (observation.ReadFile != nil && observation.ReadFile.OK)) {
    return false
  }
  if observation.FileExists != nil && *observation.FileExists && observation.DirectoryExists != nil && *observation.DirectoryExists {
    return false
  }
  if observation.Stat != nil {
    switch *observation.Stat {
    case "directory":
      if (observation.FileExists != nil && *observation.FileExists) ||
        (observation.DirectoryExists != nil && !*observation.DirectoryExists) {
        return false
      }
    case "file":
      if (observation.FileExists != nil && !*observation.FileExists) ||
        (observation.DirectoryExists != nil && *observation.DirectoryExists) {
        return false
      }
    case "missing":
      if (observation.FileExists != nil && *observation.FileExists) ||
        (observation.DirectoryExists != nil && *observation.DirectoryExists) {
        return false
      }
    default:
      return false
    }
  }
  if observation.ReadFile != nil && observation.ReadFile.OK {
    if (observation.FileExists != nil && !*observation.FileExists) ||
      (observation.DirectoryExists != nil && *observation.DirectoryExists) ||
      (observation.Stat != nil && *observation.Stat != "file") {
      return false
    }
  }
  return true
}

// predicateProof returns every compatible compiler filesystem constraint for
// path without collapsing different predicates into a guessed object kind.
func (fs *inputObservationFS) predicateProof(path string) (TransformInputObservation, inputProofFailure) {
  key := fs.observationKey(path)
  if key == "" {
    return TransformInputObservation{}, inputProofInvalidPath
  }
  fs.mu.Lock()
  observation, found := fs.observations[key]
  // TypeScript-Go can probe a lexical symlink candidate and then read the
  // selected source by its physical filename. Reuse that exact observed read
  // for the alias instead of issuing an eager duplicate read from FileExists.
  if found && observation.failure == "" && observation.proof.FileExists != nil && *observation.proof.FileExists && observation.proof.ReadFile == nil && observation.proof.Realpath != nil && observation.proof.Realpath.OK {
    targetKey := fs.observationKey(observation.proof.Realpath.Path)
    target, targetFound := fs.observations[targetKey]
    if targetFound && target.failure == "" && target.proof.ReadFile != nil && target.proof.ReadFile.OK && target.proof.Realpath != nil && sameRealpathObservation(target.proof.Realpath, observation.proof.Realpath) {
      read := *target.proof.ReadFile
      observation.proof.ReadFile = &read
    }
  }
  fs.mu.Unlock()
  if !found {
    return TransformInputObservation{}, inputProofUnobserved
  }
  if observation.failure != "" {
    return TransformInputObservation{}, observation.failure
  }
  return observation.proof, ""
}

// proof returns a stable compiler-time state. A nil hash/realpath with an empty
// failure is an explicit JSON null for a path observed missing; a non-empty
// failure explains why no complete, internally consistent proof exists.
func (fs *inputObservationFS) proof(path string) (hash, realpath *string, failure inputProofFailure) {
  observation, failure := fs.predicateProof(path)
  if failure != "" {
    return nil, nil, failure
  }
  if observation.ReadFile != nil && observation.ReadFile.OK {
    if observation.Realpath == nil || !observation.Realpath.OK {
      return nil, nil, inputProofRealpathUnavailable
    }
    hash := observation.ReadFile.Hash
    realpath := observation.Realpath.Path
    return &hash, &realpath, ""
  }
  directory := (observation.Stat != nil && *observation.Stat == "directory") ||
    (observation.DirectoryExists != nil && *observation.DirectoryExists)
  if directory {
    hash := observedDirectoryDigest
    if observation.Realpath == nil || !observation.Realpath.OK {
      return nil, nil, inputProofRealpathUnavailable
    }
    realpath := observation.Realpath.Path
    return &hash, &realpath, ""
  }
  file := (observation.Stat != nil && *observation.Stat == "file") ||
    (observation.FileExists != nil && *observation.FileExists)
  if file {
    return nil, nil, inputProofContentUnavailable
  }
  missing := (observation.Stat != nil && *observation.Stat == "missing") ||
    (observation.FileExists != nil && !*observation.FileExists) ||
    (observation.DirectoryExists != nil && !*observation.DirectoryExists) ||
    (observation.ReadFile != nil && !observation.ReadFile.OK)
  if missing {
    return nil, nil, ""
  }
  return nil, nil, inputProofUnsupportedInputKind
}
