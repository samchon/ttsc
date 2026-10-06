package evidence

import (
  "io/fs"
  "os"
  "path/filepath"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// evidenceInputReader delegates only the operations an inventory or locator
// actually performs. A nil host reader preserves the original OS operations
// for manual contexts and native unit callers. It never preloads a population.
// @evidence contracts/common.md#principled-implementation evidenceInputReader preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design evidenceInputReader owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts evidenceInputReader introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This private state/wire shape performs no native operation; the reader and publisher own native observations.
// @evidenceExclude contracts/performance.md#efficient-algorithms This type declares state rather than an algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This type supplies no independent cache/reuse decision.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The owning Program/reader or caller, rather than the declaration, owns stored observations.
type evidenceInputReader struct { host rule.ProjectInputReader }

// @evidence contracts/common.md#principled-implementation ReadFile preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design ReadFile owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts ReadFile introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Delegates to the supplied per-generation native reader or preserves the original OS/path operation for nil manual contexts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only selects/delegates one existing operation; the called reader owns byte/traversal cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper stores no computed input cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no descriptor/watcher; the delegated operation owns any temporary resource.
func (r evidenceInputReader) ReadFile(name string) ([]byte, error) {
  if r.host != nil { return r.host.ReadFile(name) }
  return os.ReadFile(name)
}
// @evidence contracts/common.md#principled-implementation Stat preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design Stat owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Stat introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Delegates to the supplied per-generation native reader or preserves the original OS/path operation for nil manual contexts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only selects/delegates one existing operation; the called reader owns byte/traversal cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper stores no computed input cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no descriptor/watcher; the delegated operation owns any temporary resource.
func (r evidenceInputReader) Stat(name string) (os.FileInfo, error) {
  if r.host != nil { return r.host.Stat(name) }
  return os.Stat(name)
}
// @evidence contracts/common.md#principled-implementation Lstat preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design Lstat owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Lstat introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Delegates to the supplied per-generation native reader or preserves the original OS/path operation for nil manual contexts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only selects/delegates one existing operation; the called reader owns byte/traversal cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper stores no computed input cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no descriptor/watcher; the delegated operation owns any temporary resource.
func (r evidenceInputReader) Lstat(name string) (os.FileInfo, error) {
  if r.host != nil { return r.host.Lstat(name) }
  return os.Lstat(name)
}
// @evidence contracts/common.md#principled-implementation Readlink preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design Readlink owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Readlink introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Delegates to the supplied per-generation native reader or preserves the original OS/path operation for nil manual contexts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only selects/delegates one existing operation; the called reader owns byte/traversal cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper stores no computed input cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no descriptor/watcher; the delegated operation owns any temporary resource.
func (r evidenceInputReader) Readlink(name string) (string, error) {
  if r.host != nil { return r.host.Readlink(name) }
  return os.Readlink(name)
}
// @evidence contracts/common.md#principled-implementation error preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design error owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts error introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Delegates to the supplied per-generation native reader or preserves the original OS/path operation for nil manual contexts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only selects/delegates one existing operation; the called reader owns byte/traversal cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper stores no computed input cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no descriptor/watcher; the delegated operation owns any temporary resource.
func (r evidenceInputReader) WalkDir(name string, visit fs.WalkDirFunc) error {
  if r.host != nil { return r.host.WalkDir(name, visit) }
  return filepath.WalkDir(name, visit)
}
// @evidence contracts/common.md#principled-implementation Unavailable preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design Unavailable owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Delegates to the supplied per-generation native reader or preserves the original OS/path operation for nil manual contexts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only selects/delegates one existing operation; the called reader owns byte/traversal cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper stores no computed input cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no descriptor/watcher; the delegated operation owns any temporary resource.
func (r evidenceInputReader) Unavailable() {
  if r.host != nil { r.host.Unavailable() }
}
// @evidence contracts/common.md#principled-implementation inputReader preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design inputReader owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts inputReader introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Delegates to the supplied per-generation native reader or preserves the original OS/path operation for nil manual contexts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only selects/delegates one existing operation; the called reader owns byte/traversal cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper stores no computed input cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no descriptor/watcher; the delegated operation owns any temporary resource.
func inputReader(readers []evidenceInputReader) evidenceInputReader {
  if len(readers) != 0 { return readers[0] }
  return evidenceInputReader{}
}

// @evidence contracts/common.md#principled-implementation EvalSymlinks preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design EvalSymlinks owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts EvalSymlinks introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Delegates to the supplied per-generation native reader or preserves the original OS/path operation for nil manual contexts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only selects/delegates one existing operation; the called reader owns byte/traversal cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper stores no computed input cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no descriptor/watcher; the delegated operation owns any temporary resource.
func (r evidenceInputReader) EvalSymlinks(name string) (string, error) {
  if r.host != nil { return r.host.EvalSymlinks(name) }
  return filepath.EvalSymlinks(name)
}
