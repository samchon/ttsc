package rule

import (
  "io/fs"
  "os"
)

// ProjectInputReader preserves the native operations a contributor actually
// consumes while allowing its host to record the returned input predicates.
// It belongs to one loaded Program generation, not a process-global filesystem.
// ReadFile returns original bytes, unlike the compiler VFS's decoded text.
// WalkDir retains filepath.WalkDir's ordering, link and SkipDir semantics.
// Unavailable only withdraws observation completeness; it cannot certify it.
//
// @evidence contracts/common.md#principled-implementation The reader exposes actual bytes, native metadata and directory operations, independently of pre-Program topology declarations.
// @evidence contracts/common.md#clear-and-simple-design One optional per-generation boundary names the operations contributors consume without replacing process globals.
// @evidence contracts/common.md#prohibited-implementation-shortcuts There is no later hash or completeness setter that manufactures proof for an unobserved input.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies raw bytes, generation ownership and walking semantics with separated acknowledgment tags.
// @evidence contracts/portability.md#os-neutral-implementation Native paths, os.FileInfo, fs.DirEntry and errors preserve the host filesystem's representations and link behavior; callers must not infer capabilities from OS names.
// @evidenceExclude contracts/performance.md#efficient-algorithms This interface defines operation signatures; reader implementations own their algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This interface declares no result cache or shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The implementing host owns the generation's observations and resources.
type ProjectInputReader interface {
  ReadFile(string) ([]byte, error)
  Stat(string) (os.FileInfo, error)
  Lstat(string) (os.FileInfo, error)
  ReadDir(string) ([]os.DirEntry, error)
  Readlink(string) (string, error)
  EvalSymlinks(string) (string, error)
  WalkDir(string, fs.WalkDirFunc) error
  Unavailable()
}

// ProjectInputObservationRule explicitly undertakes to consume external
// project inputs through ProjectContext.Inputs. A host still checks the actual
// recorded predicates; this declaration is not input proof. A contributor
// using an unobserved external operation must call Inputs.Unavailable.
// Existing contributors need not implement it and remain source-compatible.
//
// @evidence contracts/common.md#principled-implementation An explicit optional contributor responsibility distinguishes supported actual observation from topology declarations alone.
// @evidence contracts/common.md#clear-and-simple-design One method advertises the reader contract without changing ProjectRule.Check or its constructor.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The marker never replaces individual byte, membership, identity or conflict proofs.
// @evidence contracts/common.md#meaningful-documentation Native prose defines compatibility, responsibility and the independent proof boundary with separated tags.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The capability declaration performs no independent filesystem or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms The interface declares no processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The capability coordinates no reusable result.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The declaration retains no resources independently.
type ProjectInputObservationRule interface {
  UsesProjectInputReader() bool
}
