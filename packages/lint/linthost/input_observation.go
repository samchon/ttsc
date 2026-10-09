package linthost

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

// inputProofFailure names the reason one observed key cannot authorize reuse.
// Empty means no recorded failure, not proof that the key was observed.
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

// transformInputReadObservation reports one compiler ReadFile predicate's
// success and the digest of its returned text. This is not necessarily a raw
// disk-byte digest: the native VFS decodes UTF-16 and removes a UTF-8 BOM before
// returning text. A failed read carries OK=false and no guessed filesystem kind.
type transformInputReadObservation struct {
  // OK reports whether the compiler's ReadFile call successfully returned text.
  OK bool `json:"ok"`

  // Hash is lowercase SHA-256 of the returned string's bytes, absent on failure.
  Hash string `json:"hash,omitempty"`
}

// transformInputRealpathObservation reports the filesystem adapter's Realpath
// result, either queried directly or beside a successful existence predicate.
// A nonempty result is cleaned and marked OK; the native VFS can return the
// requested spelling when physical resolution fails, so OK alone is not an
// independent certificate that every alias resolved physically.
type transformInputRealpathObservation struct {
  // OK reports a nonempty adapter path, including any adapter lexical fallback.
  OK bool `json:"ok"`

  // Path is the cleaned native adapter result, not independent physical proof.
  Path string `json:"path,omitempty"`
}

// transformInputEntriesObservation is the exact result of one compiler
// GetAccessibleEntries predicate. Both lists retain returned lexical child
// names. The native VFS returns sorted entries and follows recognizable links
// when target stat succeeds; errors or unclassifiable entries can be omitted.
// An empty list pair is not an independent successful-enumeration certificate.
type transformInputEntriesObservation struct {
  // Directories contains the observed accessible child-directory names.
  Directories []string `json:"directories"`

  // Files contains the observed accessible child-file names.
  Files []string `json:"files"`
}

// transformInputObservation preserves independent compiler filesystem
// predicates for one lexical path. False FileExists and true DirectoryExists
// are compatible constraints, not a path-kind race.
type transformInputObservation struct {
  NativePredicates []nativeInputPredicate `json:"nativePredicates,omitempty"`
  // AccessibleEntries records a requested directory-membership predicate.
  AccessibleEntries *transformInputEntriesObservation `json:"accessibleEntries,omitempty"`

  // DirectoryExists records the requested directory predicate, including false.
  DirectoryExists *bool `json:"directoryExists,omitempty"`

  // FileExists records the requested file predicate, including false.
  FileExists *bool `json:"fileExists,omitempty"`

  // ReadFile records read success and the digest of returned compiler text.
  ReadFile *transformInputReadObservation `json:"readFile,omitempty"`

  // Realpath records the adapter result, including any nonempty lexical fallback.
  Realpath *transformInputRealpathObservation `json:"realpath,omitempty"`

  // Stat records "missing" for a null adapter result, otherwise directory/file.
  Stat *string `json:"stat,omitempty"`
}

// observedInput keeps partial predicates beside a sticky failure so a later
// matching answer cannot erase an earlier within-generation contradiction.
type observedInput struct {
  failure inputProofFailure
  proof   transformInputObservation
}

// inputObservationFS records the predicates actually returned through the
// compiler filesystem. ReadFile hashes returned compiler text, not raw disk
// bytes. Publication can retain those construction-time answers without
// attaching post-compile filesystem answers to an earlier Program.
// Its maps retain one record per canonical observed key until the Program is
// released; returned listing/text sizes still determine retained bytes.
type inputObservationFS struct {
  vfs.FS
  caseSensitivity      shimtspath.CaseSensitivity
  mu                   sync.Mutex
  observations         map[string]observedInput
  observationOrder     []string
  observationSpellings map[string]string
}

// newInputObservationFS borrows the supplied VFS and its actual case policy.
// Each constructor call starts an empty ledger rather than a historical cache.
func newInputObservationFS(inner vfs.FS) *inputObservationFS {
  return &inputObservationFS{
    FS:                   inner,
    caseSensitivity:      inner.CaseSensitivity(),
    observations:         map[string]observedInput{},
    observationSpellings: map[string]string{},
  }
}

// FileExists records the returned existence answer; a true answer additionally
// records the same VFS's identity spelling without inventing file contents.
func (fs *inputObservationFS) FileExists(path shimtspath.RootedFilePath) bool {
  exists := fs.FS.FileExists(path)
  proof := transformInputObservation{FileExists: boolPointer(exists)}
  if exists {
    // Existence participates in resolution, but only ReadFile returns bytes
    // that can influence the resident Program. Do not duplicate every
    // resolver probe with an eager file read.
    proof.Realpath = fs.currentRealpath(path.AsPath())
  }
  fs.observe(path.AsString(), observedInput{proof: proof})
  return exists
}

// ReadFile hashes the text actually returned by the compiler VFS. A failed read
// records failure without hashing a second read or guessing the path's kind.
func (fs *inputObservationFS) ReadFile(path shimtspath.RootedFilePath) (string, bool) {
  contents, ok := fs.FS.ReadFile(path)
  if ok {
    digest := sha256.Sum256([]byte(contents))
    hash := hex.EncodeToString(digest[:])
    fs.observe(path.AsString(), observedInput{
      proof: transformInputObservation{
        ReadFile: &transformInputReadObservation{OK: true, Hash: hash},
        Realpath: fs.currentRealpath(path.AsPath()),
      },
    })
  } else {
    fs.observe(path.AsString(), observedInput{
      proof: transformInputObservation{
        ReadFile: &transformInputReadObservation{OK: false},
      },
    })
  }
  return contents, ok
}

// DirectoryExists records existence independently of FileExists, since a
// false file predicate and a true directory predicate are compatible.
func (fs *inputObservationFS) DirectoryExists(path shimtspath.RootedDirectoryPath) bool {
  exists := fs.FS.DirectoryExists(path)
  proof := transformInputObservation{DirectoryExists: boolPointer(exists)}
  if exists {
    proof.Realpath = fs.currentRealpath(path.AsPath())
  }
  fs.observe(path.AsString(), observedInput{proof: proof})
  return exists
}

// GetAccessibleEntries copies the returned lists before retaining them so the
// caller cannot mutate the witness. It does not add an unconsumed traversal.
func (fs *inputObservationFS) GetAccessibleEntries(path shimtspath.RootedDirectoryPath) vfs.Entries {
  entries := fs.FS.GetAccessibleEntries(path)
  fs.observe(path.AsString(), observedInput{
    proof: transformInputObservation{
      AccessibleEntries: &transformInputEntriesObservation{
        Directories: append([]string{}, entries.Directories...),
        Files:       append([]string{}, entries.Files...),
      },
    },
  })
  return entries
}

// Stat records the supplied VFS's nil/file/directory distinction and its
// identity spelling for existing objects, preserving the returned FileInfo.
func (fs *inputObservationFS) Stat(path shimtspath.RootedPath) vfs.FileInfo {
  info := fs.FS.Stat(path)
  kind := "missing"
  if info == nil {
    fs.observe(path.AsString(), observedInput{
      proof: transformInputObservation{Stat: &kind},
    })
  } else if info.IsDir() {
    kind = "directory"
    fs.observe(path.AsString(), observedInput{
      proof: transformInputObservation{
        Stat:     &kind,
        Realpath: fs.currentRealpath(path),
      },
    })
  } else {
    kind = "file"
    fs.observe(path.AsString(), observedInput{
      proof: transformInputObservation{
        Stat:     &kind,
        Realpath: fs.currentRealpath(path),
      },
    })
  }
  return info
}

// Realpath records the adapter's answer and returns it unchanged; a lexical
// fallback remains an adapter answer, not separately proven physical identity.
func (fs *inputObservationFS) Realpath(path shimtspath.RootedPath) shimtspath.RootedPath {
  realpath := fs.FS.Realpath(path)
  fs.observe(path.AsString(), observedInput{
    proof: transformInputObservation{Realpath: realpathObservation(realpath.AsString())},
  })
  return realpath
}

// currentRealpath obtains the identity predicate beside an existing-object
// query without routing that supporting call back through the observer.
func (fs *inputObservationFS) currentRealpath(path shimtspath.RootedPath) *transformInputRealpathObservation {
  return realpathObservation(fs.FS.Realpath(path).AsString())
}

// realpathObservation distinguishes an empty adapter result from its cleaned
// native spelling. It does not claim the adapter resolved every link.
func realpathObservation(realpath string) *transformInputRealpathObservation {
  if realpath == "" {
    return &transformInputRealpathObservation{OK: false}
  }
  return &transformInputRealpathObservation{
    OK:   true,
    Path: filepath.Clean(realpath),
  }
}

// boolPointer retains false as a present predicate, distinct from no query.
func boolPointer(value bool) *bool {
  return &value
}

// observationKey accepts absolute call addresses and uses the supplied VFS's
// case policy for canonical keys; relative inputs remain unproved.
func (fs *inputObservationFS) observationKey(path string) string {
  if !filepath.IsAbs(path) {
    return ""
  }
  return fs.caseSensitivity.Canonicalize(shimtspath.NormalizePath(path))
}

// observe merges under the ledger lock and preserves first lexical spelling.
// A successful read may also populate its observed physical alias key; mere
// existence does not create a content witness for that alias.
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
// Repeated answers must agree predicate by predicate. Different predicate
// kinds can coexist only when their combined constraints remain compatible.
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

// sameEntriesObservation compares both ordered native lists without flattening
// file and directory names into an indistinguishable set.
func sameEntriesObservation(left, right *transformInputEntriesObservation) bool {
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

// observedAccessibleEntries distinguishes a consumed empty listing from an
// absent query; existence alone does not count as a listing.
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
// It snapshots the source ledger before locking the receiver, then uses the
// same sticky merge policy rather than silently replacing earlier witnesses.
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

// failObservation retains the preceding predicates beside the refusal reason;
// callers hold the ledger lock and later merges cannot clear this failure.
func (fs *inputObservationFS) failObservation(key string, observed observedInput, failure inputProofFailure) {
  observed.failure = failure
  fs.observations[key] = observed
}

// sameReadObservation compares success and returned-text hash, preserving a
// failed read as a distinct result from successful empty text.
func sameReadObservation(left, right *transformInputReadObservation) bool {
  return left.OK == right.OK && left.Hash == right.Hash
}

// sameRealpathObservation requires both success state and cleaned spelling to
// agree; equal empty strings alone cannot equate success with failure.
func sameRealpathObservation(left, right *transformInputRealpathObservation) bool {
  return left.OK == right.OK && left.Path == right.Path
}

// transformInputObservationCompatible checks cross-kind logical constraints.
// A nonempty listing implies directory semantics, and a successful file read
// cannot coexist with a consumed missing/directory result.
func transformInputObservationCompatible(observation transformInputObservation) bool {
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
// A lexical existence key may borrow an already consumed read only from its
// matching observed physical key and identical identity predicate. It performs
// no new read and never repairs either key's recorded failure.
func (fs *inputObservationFS) predicateProof(path string) (transformInputObservation, inputProofFailure) {
  key := fs.observationKey(path)
  if key == "" {
    return transformInputObservation{}, inputProofInvalidPath
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
    return transformInputObservation{}, inputProofUnobserved
  }
  if observation.failure != "" {
    return transformInputObservation{}, observation.failure
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
