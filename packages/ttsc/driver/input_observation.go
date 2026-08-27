package driver

import (
  "crypto/sha256"
  "encoding/hex"
  "path/filepath"
  "sync"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
)

var observedDirectoryDigest = func() string {
  digest := sha256.Sum256([]byte("ttsc:host-input:directory\x00"))
  return hex.EncodeToString(digest[:])
}()

type observedInputKind uint8

type inputProofFailure string

const (
  inputProofContentChanged       inputProofFailure = "content-changed"
  inputProofContentUnavailable   inputProofFailure = "content-unavailable"
  inputProofInvalidPath          inputProofFailure = "invalid-path"
  inputProofKindChanged          inputProofFailure = "kind-changed"
  inputProofRealpathChanged      inputProofFailure = "realpath-changed"
  inputProofRealpathUnavailable  inputProofFailure = "realpath-unavailable"
  inputProofUnobserved           inputProofFailure = "unobserved"
  inputProofUnsupportedInputKind inputProofFailure = "unsupported-input-kind"
)

const (
  observedInputMissing observedInputKind = iota
  observedInputFile
  observedInputDirectory
)

type observedInput struct {
  contentHash *string
  failure     inputProofFailure
  kind        observedInputKind
  realpath    *string
}

// inputObservationFS records the exact disk state returned through the
// compiler filesystem. A later transform envelope can therefore prove which
// bytes and resolution-candidate states produced its resident Program instead
// of attaching post-compile disk hashes to an earlier result.
type inputObservationFS struct {
  vfs.FS
  caseSensitive bool
  mu            sync.Mutex
  observations  map[string]observedInput
}

func newInputObservationFS(inner vfs.FS) *inputObservationFS {
  return &inputObservationFS{
    FS:            inner,
    caseSensitive: inner.UseCaseSensitiveFileNames(),
    observations:  map[string]observedInput{},
  }
}

func (fs *inputObservationFS) FileExists(path string) bool {
  exists := fs.FS.FileExists(path)
  if exists {
    // Existence participates in resolution, but only ReadFile returns bytes
    // that can influence the resident Program. Do not duplicate every
    // resolver probe with an eager file read.
    fs.observe(path, observedInput{
      kind:     observedInputFile,
      realpath: fs.currentRealpath(path),
    })
  } else {
    fs.observe(path, observedInput{kind: observedInputMissing})
  }
  return exists
}

func (fs *inputObservationFS) ReadFile(path string) (string, bool) {
  contents, ok := fs.FS.ReadFile(path)
  if ok {
    digest := sha256.Sum256([]byte(contents))
    hash := hex.EncodeToString(digest[:])
    fs.observe(path, observedInput{
      contentHash: &hash,
      kind:        observedInputFile,
      realpath:    fs.currentRealpath(path),
    })
  } else {
    fs.observe(path, observedInput{kind: observedInputMissing})
  }
  return contents, ok
}

func (fs *inputObservationFS) DirectoryExists(path string) bool {
  exists := fs.FS.DirectoryExists(path)
  if exists {
    fs.observe(path, observedInput{
      kind:     observedInputDirectory,
      realpath: fs.currentRealpath(path),
    })
  } else {
    fs.observe(path, observedInput{kind: observedInputMissing})
  }
  return exists
}

func (fs *inputObservationFS) GetAccessibleEntries(path string) vfs.Entries {
  // DirectoryExists records directory identity on the ordinary compiler path.
  // An empty listing alone cannot distinguish a missing directory from an
  // existing empty one without issuing an extra stat for every enumeration.
  return fs.FS.GetAccessibleEntries(path)
}

func (fs *inputObservationFS) Stat(path string) vfs.FileInfo {
  info := fs.FS.Stat(path)
  if info == nil {
    fs.observe(path, observedInput{kind: observedInputMissing})
  } else if info.IsDir() {
    fs.observe(path, observedInput{
      kind:     observedInputDirectory,
      realpath: fs.currentRealpath(path),
    })
  } else {
    fs.observe(path, observedInput{
      kind:     observedInputFile,
      realpath: fs.currentRealpath(path),
    })
  }
  return info
}

func (fs *inputObservationFS) Realpath(path string) string {
  realpath := fs.FS.Realpath(path)
  if realpath != "" {
    resolved := filepath.Clean(realpath)
    fs.observeRealpath(path, &resolved)
  }
  return realpath
}

func (fs *inputObservationFS) currentRealpath(path string) *string {
  realpath := fs.FS.Realpath(path)
  if realpath == "" {
    return nil
  }
  resolved := filepath.Clean(realpath)
  return &resolved
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
  keys := []string{key}
  // A compiler read can arrive through an 8.3, case-variant, or already-real
  // spelling while resolution recorded the selected lexical alias. Index the
  // returned bytes by the final physical path too, so proof can join the two
  // observations without another disk read.
  if next.contentHash != nil && next.realpath != nil {
    physicalKey := fs.observationKey(*next.realpath)
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
  if previous.kind != next.kind {
    fs.failObservation(key, previous, inputProofKindChanged)
    return
  }
  if !sameOptionalString(previous.realpath, next.realpath) {
    fs.failObservation(key, previous, inputProofRealpathChanged)
    return
  }
  if previous.contentHash != nil && next.contentHash != nil && *previous.contentHash != *next.contentHash {
    fs.failObservation(key, previous, inputProofContentChanged)
    return
  }
  if previous.contentHash == nil && next.contentHash != nil {
    previous.contentHash = next.contentHash
  }
  fs.observations[key] = previous
}

func (fs *inputObservationFS) failObservation(key string, observed observedInput, failure inputProofFailure) {
  observed.contentHash = nil
  observed.failure = failure
  observed.realpath = nil
  fs.observations[key] = observed
}

func (fs *inputObservationFS) observeRealpath(path string, realpath *string) {
  key := fs.observationKey(path)
  if key == "" {
    return
  }
  fs.mu.Lock()
  defer fs.mu.Unlock()
  previous, found := fs.observations[key]
  if !found {
    // A realpath by itself cannot prove whether the path was a file or
    // directory. The ordinary resolver probes record that state separately.
    return
  }
  if previous.failure != "" {
    return
  }
  if !sameOptionalString(previous.realpath, realpath) {
    fs.failObservation(key, previous, inputProofRealpathChanged)
  }
}

func sameOptionalString(left, right *string) bool {
  if left == nil || right == nil {
    return left == nil && right == nil
  }
  return *left == *right
}

// proof returns a stable compiler-time state. A nil hash/realpath with an empty
// failure is an explicit JSON null for a path observed missing; a non-empty
// failure explains why no complete, internally consistent proof exists.
func (fs *inputObservationFS) proof(path string) (hash, realpath *string, failure inputProofFailure) {
  key := fs.observationKey(path)
  if key == "" {
    return nil, nil, inputProofInvalidPath
  }
  fs.mu.Lock()
  observation, found := fs.observations[key]
  // TypeScript-Go can probe a lexical symlink candidate and then read the
  // selected source by its physical filename. Reuse that exact observed read
  // for the alias instead of issuing an eager duplicate read from FileExists.
  if found && observation.failure == "" && observation.kind == observedInputFile && observation.contentHash == nil && observation.realpath != nil {
    targetKey := fs.observationKey(*observation.realpath)
    target, targetFound := fs.observations[targetKey]
    if targetFound && target.failure == "" && target.kind == observedInputFile && target.contentHash != nil && sameOptionalString(target.realpath, observation.realpath) {
      targetHash := *target.contentHash
      observation.contentHash = &targetHash
    }
  }
  fs.mu.Unlock()
  if !found {
    return nil, nil, inputProofUnobserved
  }
  if observation.failure != "" {
    return nil, nil, observation.failure
  }
  switch observation.kind {
  case observedInputMissing:
    return nil, nil, ""
  case observedInputDirectory:
    hash := observedDirectoryDigest
    if observation.realpath == nil {
      return nil, nil, inputProofRealpathUnavailable
    }
    realpath := *observation.realpath
    return &hash, &realpath, ""
  case observedInputFile:
    if observation.contentHash == nil || observation.realpath == nil {
      if observation.contentHash == nil {
        return nil, nil, inputProofContentUnavailable
      }
      return nil, nil, inputProofRealpathUnavailable
    }
    hash := *observation.contentHash
    realpath := *observation.realpath
    return &hash, &realpath, ""
  default:
    return nil, nil, inputProofUnsupportedInputKind
  }
}
