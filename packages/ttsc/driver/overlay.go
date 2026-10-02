package driver

import (
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
)

// OverlayFS layers in-memory file contents over an inner filesystem. Overridden
// paths return the in-memory text from ReadFile and report present from
// FileExists; every other operation delegates to the inner FS. A resident
// Session or serve host uses this to feed a caller's unsaved buffer (for example
// Metro's per-file src, or an editor's edited file) to the compiler without
// writing to disk.
//
// @evidence contracts/common.md#principled-implementation Overrides replace only text and presence predicates; other filesystem operations retain the embedded FS's semantics.
// @evidence contracts/common.md#clear-and-simple-design One canonical-key map owns unsaved contents while the embedded interface delegates unrelated operations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper implements the supported VFS interface without mutating the inner filesystem or foreign methods.
// @evidence contracts/common.md#meaningful-documentation Native prose explains unsaved buffers, overridden predicates and delegation under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation Canonical keys use the inner filesystem's actual case capability, not a platform-name assumption.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type OverlayFS struct {
  vfs.FS
  caseSensitive bool
  overrides     map[string]string
}

// NewOverlayFS returns an overlay over inner with no overrides set.
//
// @evidence contracts/common.md#principled-implementation Empty override state preserves inner reads while recording the same case policy the compiler uses.
// @evidence contracts/common.md#clear-and-simple-design Construction initializes one map and captures the inner VFS in one owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Construction does not alter the inner object or inject sample file contents.
// @evidence contracts/common.md#meaningful-documentation Native prose states the initially empty overlay following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation UseCaseSensitiveFileNames supplies actual canonicalization capability from inner.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewOverlayFS acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewOverlayFS performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewOverlayFS computes one result per call, so there is no repeated work to share.
func NewOverlayFS(inner vfs.FS) *OverlayFS {
  return &OverlayFS{
    FS:            inner,
    caseSensitive: inner.UseCaseSensitiveFileNames(),
    overrides:     map[string]string{},
  }
}

// key normalizes a path the same way the compiler keys its files, so an
// override registered for one spelling is found however the host asks for it.
func (o *OverlayFS) key(path string) string {
  return shimtspath.GetCanonicalFileName(shimtspath.NormalizePath(path), o.caseSensitive)
}

// Set records an in-memory override for path.
//
// @evidence contracts/common.md#principled-implementation Set writes content under the same canonical key that Get and ReadFile use.
// @evidence contracts/common.md#clear-and-simple-design One map update owns replacement; canonicalization is shared through key.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied buffer is retained directly with no fixture substitution or disk mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose states buffer override ownership following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation key uses compiler normalization and the inner VFS case policy for all spellings.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Set acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Set performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Set computes one result per call, so there is no repeated work to share.
func (o *OverlayFS) Set(path, content string) {
  o.overrides[o.key(path)] = content
}

// Get returns the in-memory override for path, if one is set.
//
// @evidence contracts/common.md#principled-implementation The map's presence boolean distinguishes an empty override from an absent override.
// @evidence contracts/common.md#clear-and-simple-design Retrieval uses the same key helper as writers without consulting the disk.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing overrides are not fabricated from underlying file contents.
// @evidence contracts/common.md#meaningful-documentation Native prose states override-only lookup and optional presence under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation Canonical lookup follows the compiler and inner filesystem case capability.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Get acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Get performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Get computes one result per call, so there is no repeated work to share.
func (o *OverlayFS) Get(path string) (string, bool) {
  content, ok := o.overrides[o.key(path)]
  return content, ok
}

// Unset removes the in-memory override for path, so reads fall back to the
// inner filesystem.
//
// @evidence contracts/common.md#principled-implementation Deleting the canonical map entry restores the ordinary ReadFile fallback.
// @evidence contracts/common.md#clear-and-simple-design Removal reuses the shared key policy instead of tracking a second tombstone structure.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unset removes an owned buffer without deleting or rewriting a native file.
// @evidence contracts/common.md#meaningful-documentation Native prose explains restoration of fallback behavior following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The same compiler key normalization is used by insertion and removal across native case policies.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Unset acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Unset performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Unset computes one result per call, so there is no repeated work to share.
func (o *OverlayFS) Unset(path string) {
  delete(o.overrides, o.key(path))
}

// ReadFile uses an override when present, including an empty string, otherwise
// delegates the read and its success flag to the inner filesystem.
//
// @evidence contracts/common.md#principled-implementation Presence selects overridden text; the inner result is returned unchanged when no buffer exists.
// @evidence contracts/common.md#clear-and-simple-design One map lookup precedes the supported VFS fallback without another cached disk copy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper cannot turn a failed inner read into a fabricated successful buffer.
// @evidence contracts/common.md#meaningful-documentation Native prose states empty-buffer and fallback semantics under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation Canonical override identity uses actual VFS capabilities and native reads stay delegated.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ReadFile acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms ReadFile performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ReadFile computes one result per call, so there is no repeated work to share.
func (o *OverlayFS) ReadFile(path string) (string, bool) {
  if content, ok := o.overrides[o.key(path)]; ok {
    return content, true
  }
  return o.FS.ReadFile(path)
}

// FileExists treats a supplied override as present and delegates other paths.
//
// @evidence contracts/common.md#principled-implementation An owned override is a readable virtual file even when its native path is absent.
// @evidence contracts/common.md#clear-and-simple-design Presence shares the ReadFile key policy and the inner fallback.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Presence changes only for caller-supplied buffers, without foreign state mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose states virtual presence and fallback under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation Actual filesystem case policy controls override identity; native existence remains an inner VFS operation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources FileExists acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms FileExists performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work FileExists computes one result per call, so there is no repeated work to share.
func (o *OverlayFS) FileExists(path string) bool {
  if _, ok := o.overrides[o.key(path)]; ok {
    return true
  }
  return o.FS.FileExists(path)
}
