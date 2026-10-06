package linthost

import (
  "crypto/sha256"
  "encoding/hex"
  "errors"
  "io"
  "io/fs"
  "os"
  "path/filepath"
  "sort"
  "sync"
)

// projectInputReader records only contributor operations actually performed in
// one loaded Program cycle. Raw bytes stay independent of decoded compiler
// text. Unsupported native link predicates withdraw completeness; they never
// become guessed file content or an assumed successful enumeration.
// @evidence contracts/common.md#principled-implementation projectInputReader preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design projectInputReader owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts projectInputReader introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This private state/wire shape performs no native operation; the reader and publisher own native observations.
// @evidenceExclude contracts/performance.md#efficient-algorithms This type declares state rather than an algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This type supplies no independent cache/reuse decision.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The owning Program/reader or caller, rather than the declaration, owns stored observations.
type projectInputReader struct {
  compiler *inputObservationFS
  mu sync.Mutex
  inputs map[string]*string
  realpaths map[string]*string
  nativeInputs map[string]nativeInputPredicate
  incomplete bool
}

// @evidence contracts/common.md#principled-implementation newProjectInputReader preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design newProjectInputReader owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts newProjectInputReader introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Allocates only empty per-generation maps; later observation operations own population growth.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func newProjectInputReader(compiler *inputObservationFS) *projectInputReader {
  return &projectInputReader{compiler: compiler, inputs: map[string]*string{}, realpaths: map[string]*string{}, nativeInputs: map[string]nativeInputPredicate{}}
}

// @evidence contracts/common.md#principled-implementation Unavailable preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design Unavailable owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) Unavailable() {
  r.mu.Lock(); defer r.mu.Unlock()
  r.incomplete = true
}

// @evidence contracts/common.md#principled-implementation record preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design record owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts record introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms One map lookup/update plus digest/path comparison retains one current witness per cleaned input; conflicts stay incomplete.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) record(name string, digest *string, physical *string) {
  name = filepath.Clean(name)
  r.mu.Lock(); defer r.mu.Unlock()
  prior, seen := r.inputs[name]
  if seen && (!equalObservedString(prior, digest) || !equalObservedString(r.realpaths[name], physical)) { r.incomplete = true }
  r.inputs[name] = digest
  r.realpaths[name] = physical
}

// @evidence contracts/common.md#principled-implementation equalObservedString preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design equalObservedString owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts equalObservedString introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func equalObservedString(a, b *string) bool {
  return a == nil && b == nil || a != nil && b != nil && *a == *b
}

// @evidence contracts/common.md#principled-implementation ReadFile preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design ReadFile owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts ReadFile introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Hashes only returned raw bytes after the owned read; time and buffer size follow file bytes plus native metadata and identity queries.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) ReadFile(name string) ([]byte, error) {
  file, err := os.Open(name)
  if err != nil {
    if os.IsNotExist(err) { r.record(name, nil, nil) } else { r.Unavailable() }
    return nil, err
  }
  before, beforeErr := file.Stat()
  selectedBefore, selectedBeforeErr := os.Stat(name)
  physicalBefore, physicalBeforeErr := filepath.EvalSymlinks(name)
  content, readErr := io.ReadAll(file)
  after, afterErr := file.Stat()
  closeErr := file.Close()
  selected, selectedErr := os.Stat(name)
  physical, physicalErr := filepath.EvalSymlinks(name)
  stable := beforeErr == nil && afterErr == nil && selectedBeforeErr == nil && selectedErr == nil &&
    physicalBeforeErr == nil && physicalErr == nil && physicalBefore == physical &&
    os.SameFile(before, selectedBefore) && os.SameFile(before, after) && os.SameFile(after, selected) &&
    before.Mode() == after.Mode() && before.Size() == after.Size() && before.ModTime().Equal(after.ModTime())
  if readErr != nil || closeErr != nil || !stable { r.Unavailable(); return content, errors.Join(readErr, closeErr) }
  hash := sha256.Sum256(content)
  digest := hex.EncodeToString(hash[:])
  r.record(name, &digest, &physical)
  return content, readErr
}

// @evidence contracts/common.md#principled-implementation Stat preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design Stat owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Stat introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) Stat(name string) (os.FileInfo, error) {
  info, err := os.Stat(name)
  if err != nil {
    if os.IsNotExist(err) { r.compiler.observe(name, observedInput{proof: transformInputObservation{Stat: stringPointer("missing")}}) } else { r.Unavailable() }
    return info, err
  }
  kind := "file"
  if info.IsDir() { kind = "directory" } else if !info.Mode().IsRegular() { r.Unavailable() }
  physical, physicalErr := filepath.EvalSymlinks(name)
  if physicalErr != nil { r.Unavailable(); return info, err }
  r.compiler.observe(name, observedInput{proof: transformInputObservation{Stat: &kind, Realpath: &transformInputRealpathObservation{OK: true, Path: filepath.Clean(physical)}}})
  return info, err
}

// @evidence contracts/common.md#principled-implementation Lstat preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design Lstat owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Lstat introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) Lstat(name string) (os.FileInfo, error) {
  info, err := os.Lstat(name)
  if err != nil {
    if os.IsNotExist(err) { r.compiler.observe(name, observedInput{proof: transformInputObservation{Stat: stringPointer("missing")}}) } else { r.Unavailable() }
    return info, err
  }
  // A symlink's own metadata has no representation in the compiler protocol.
  // Preserve its native answer while declining reusable proof for this cycle.
  if info.Mode()&os.ModeSymlink != 0 { r.Unavailable(); return info, err }
  kind := "file"
  if info.IsDir() { kind = "directory" } else if !info.Mode().IsRegular() { r.Unavailable() }
  physical, physicalErr := filepath.EvalSymlinks(name)
  if physicalErr != nil { r.Unavailable(); return info, err }
  r.compiler.observe(name, observedInput{proof: transformInputObservation{Stat: &kind, Realpath: &transformInputRealpathObservation{OK: true, Path: filepath.Clean(physical)}}})
  return info, err
}

// @evidence contracts/common.md#principled-implementation stringPointer preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design stringPointer owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts stringPointer introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func stringPointer(value string) *string { return &value }

// @evidence contracts/common.md#principled-implementation ReadDir preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design ReadDir owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts ReadDir introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Copies and sorts only the returned child names, costing child/name bytes and O(N log N) comparisons.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) ReadDir(name string) ([]os.DirEntry, error) {
  entries, err := os.ReadDir(name)
  if err != nil { r.Unavailable(); return entries, err }
  files, directories := []string{}, []string{}
  for _, entry := range entries {
    if entry.Type()&os.ModeSymlink != 0 { r.Unavailable() }
    if entry.IsDir() { directories = append(directories, entry.Name()) } else { files = append(files, entry.Name()) }
  }
  sort.Strings(files); sort.Strings(directories)
  physical, physicalErr := filepath.EvalSymlinks(name)
  if physicalErr != nil { r.Unavailable(); return entries, err }
  r.compiler.observe(name, observedInput{proof: transformInputObservation{DirectoryExists: boolPointer(true), AccessibleEntries: &transformInputEntriesObservation{Files: files, Directories: directories}, Realpath: &transformInputRealpathObservation{OK: true, Path: filepath.Clean(physical)}}})
  return entries, err
}

// Readlink records the selected entry's kind or link bytes alongside its native
// answer. A changed entry or unexplained failure withdraws the whole generation.
// @evidence contracts/common.md#principled-implementation Readlink preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design Readlink owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Readlink introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Queries one entry and hashes its returned link bytes or kind marker, with cost proportional to path/link bytes.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) Readlink(name string) (string, error) {
  before, beforeErr := os.Lstat(name)
  target, err := os.Readlink(name)
  after, afterErr := os.Lstat(name)
  physical, physicalErr := filepath.EvalSymlinks(name)
  stable := beforeErr == nil && afterErr == nil && os.SameFile(before, after) && before.Mode() == after.Mode() && before.Size() == after.Size() && before.ModTime().Equal(after.ModTime())
  encoded := ""
  if stable {
    if err == nil { encoded = "symlink\x00" + target } else if before.Mode()&os.ModeSymlink == 0 {
      kind := "other"; if before.IsDir() { kind = "directory" } else if before.Mode().IsRegular() { kind = "file" }
      encoded = kind + "\x00"
    } else { stable = false }
  } else if os.IsNotExist(beforeErr) && os.IsNotExist(afterErr) && os.IsNotExist(err) {
    stable = true; encoded = "missing\x00"
  }
  var realpath *string
  if physicalErr == nil { realpath = &physical } else if !os.IsNotExist(physicalErr) { stable = false }
  if !stable { r.Unavailable(); return target, err }
  sum := sha256.Sum256([]byte(encoded))
  predicate := nativeInputPredicate{Version: 1, Kind: "entry", Digest: hex.EncodeToString(sum[:]), IdentityStable: true, Realpath: realpath, Scope: "cache"}
  r.mu.Lock()
  key := filepath.Clean(name)
  if prior, exists := r.nativeInputs[key]; exists && (prior.Digest != predicate.Digest || !equalObservedString(prior.Realpath, predicate.Realpath)) { r.incomplete = true }
  r.nativeInputs[key] = predicate
  r.mu.Unlock()
  return target, err
}

// @evidence contracts/common.md#principled-implementation EvalSymlinks preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design EvalSymlinks owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts EvalSymlinks introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) EvalSymlinks(name string) (string, error) {
  physical, err := filepath.EvalSymlinks(name)
  if err != nil { r.Unavailable(); return physical, err }
  r.compiler.observe(name, observedInput{proof: transformInputObservation{Realpath: &transformInputRealpathObservation{OK: true, Path: filepath.Clean(physical)}}})
  return physical, err
}

// WalkDir mirrors filepath.WalkDir using this reader's actual Lstat and ReadDir
// results. It does not enumerate a skipped directory or follow a linked entry.
// @evidence contracts/common.md#principled-implementation error preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design error owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts error introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) WalkDir(root string, visit fs.WalkDirFunc) error {
  info, err := r.Lstat(root)
  if err != nil { err = visit(root, nil, err) } else { err = r.walk(root, fs.FileInfoToDirEntry(info), visit) }
  if err == fs.SkipDir || err == fs.SkipAll { return nil }
  return err
}

// @evidence contracts/common.md#principled-implementation error preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design error owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts error introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (r *projectInputReader) walk(name string, entry fs.DirEntry, visit fs.WalkDirFunc) error {
  if err := visit(name, entry, nil); err != nil || !entry.IsDir() {
    if err == fs.SkipDir && entry.IsDir() { return nil }
    return err
  }
  children, err := r.ReadDir(name)
  if err != nil {
    if err = visit(name, entry, err); err != nil {
      if err == fs.SkipDir { return nil }
      return err
    }
  }
  for _, child := range children {
    if err := r.walk(filepath.Join(name, child.Name()), child, visit); err != nil {
      if err == fs.SkipDir { break }
      return err
    }
  }
  return nil
}
