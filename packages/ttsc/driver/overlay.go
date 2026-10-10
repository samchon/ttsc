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
// @evidence contracts/portability.md#os-neutral-implementation Canonical keys use the inner filesystem's reported case policy, not an OS-name branch in this wrapper. That policy does not independently prove each directory's physical case behavior or resolve path aliases.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type OverlayFS struct {
  vfs.FS
  caseSensitivity shimtspath.CaseSensitivity
  overrides       map[string]string
}

// NewOverlayFS returns an overlay over inner with no overrides set.
//
// @evidence contracts/common.md#principled-implementation Empty override state preserves inner reads while recording the same case policy the compiler uses.
// @evidence contracts/common.md#clear-and-simple-design Construction initializes one map and captures the inner VFS in one owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Construction does not alter the inner object or inject sample file contents.
// @evidence contracts/common.md#meaningful-documentation Native prose states the initially empty overlay following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Construction captures inner.CaseSensitivity as its canonicalization policy; it performs no independent per-directory capability or physical-alias probe.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned overlay keeps inner reachable and owns a fresh override map. Later distinct keys and content bytes have no configured cap or eviction; callers remove entries with Unset or release the overlay. Inner handles and caches remain owned by the supplied filesystem.
// @evidence contracts/performance.md#efficient-algorithms Construction allocates one empty map and wrapper and queries the inner case policy once, without scanning source files or override populations. Any work performed by that supplied policy query belongs to this delegated call, not a universal constant-time guarantee.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each construction intentionally creates independent mutable override state; the function owns no cross-overlay sharing coordinator or cached constructor result.
func NewOverlayFS(inner vfs.FS) *OverlayFS {
  return &OverlayFS{
    FS:              inner,
    caseSensitivity: inner.CaseSensitivity(),
    overrides:       map[string]string{},
  }
}

// key applies native lexical path normalization and the captured case policy.
// It does not anchor relative paths to the compiler cwd or resolve physical
// aliases; callers must use compatible spellings when registering and reading.
func (o *OverlayFS) key(path string) string {
  return o.caseSensitivity.Canonicalize(shimtspath.NormalizePath(path))
}

// Set records an in-memory override for path.
//
// @evidence contracts/common.md#principled-implementation Set writes content under the same canonical key that Get and ReadFile use.
// @evidence contracts/common.md#clear-and-simple-design One map update owns replacement; canonicalization is shared through key.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied buffer is retained directly with no fixture substitution or disk mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose states buffer override ownership following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Insertion uses native lexical normalization and the captured inner VFS case policy; callers must supply spellings compatible with later lookups because cwd anchoring and physical-alias resolution are not performed here.
// @evidence contracts/performance.md#bound-retention-and-release-resources Set retains canonical key and supplied content strings in the overlay. Replacing a key drops this map's previous value reference; distinct keys and retained text have no cap or automatic eviction and remain until Unset or owner release, subject to other caller references.
// @evidence contracts/performance.md#efficient-algorithms Native normalization and optional case conversion process path bytes before map hashing and replacement. Content is retained as a string value without an independent full-text copy here; insertion may grow map storage with the distinct-key population.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation replaces caller-selected mutable text; it does not coordinate equivalent computation or in-flight work across requests.
func (o *OverlayFS) Set(path, content string) {
  o.overrides[o.key(path)] = content
}

// Get returns the in-memory override for path, if one is set.
//
// @evidence contracts/common.md#principled-implementation The map's presence boolean distinguishes an empty override from an absent override.
// @evidence contracts/common.md#clear-and-simple-design Retrieval uses the same key helper as writers without consulting the disk.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing overrides are not fabricated from underlying file contents.
// @evidence contracts/common.md#meaningful-documentation Native prose states override-only lookup and optional presence under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation Lookup applies native lexical normalization and the captured inner case policy, without resolving relative cwd or physical aliases.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Lookup adds no retained entries or native handles. The overlay owns existing content and the returned string may keep that content reachable for its caller; this getter does not control either lifetime.
// @evidence contracts/performance.md#efficient-algorithms Path normalization, optional case conversion and key hashing scale with path bytes, followed by one map lookup. The stored content string is returned without scanning or copying its text.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Lookup reads caller-maintained override state; it coordinates no completed or in-flight computation and creates no additional result cache.
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
// @evidence contracts/performance.md#bound-retention-and-release-resources Deletion removes this overlay's reference to the selected key/content pair; other caller references may retain the text. It does not promise immediate map-capacity shrinkage or evict unrelated overrides, and releases no inner filesystem resource.
// @evidence contracts/performance.md#efficient-algorithms Native normalization and optional case conversion process path bytes, followed by key hashing and one map deletion; unrelated override entries and content bytes are not traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Removal changes mutable caller-owned state rather than coordinating reusable computation or sharing results across requests.
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
// @evidence contracts/portability.md#os-neutral-implementation Override lookup uses the captured inner case policy and native lexical normalization; physical aliases are not resolved here. Misses preserve the inner ReadFile operation and success flag.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper adds no read cache or native handle ownership. Override strings remain owned by the overlay and caller; fallback temporary resources and retained read state belong to the supplied inner filesystem, not this adapter's release policy.
// @evidence contracts/performance.md#efficient-algorithms Lookup processes path normalization/case/hash bytes before testing the override map. A hit returns stored text without scanning it; a miss adds the inner read's actual path, input-byte and decoding/cache costs, which are not universally fixed steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The wrapper adds no completed/in-flight read coordinator or independent disk-content cache; inner reuse remains the supplied filesystem's policy.
func (o *OverlayFS) ReadFile(path shimtspath.RootedFilePath) (string, bool) {
  if content, ok := o.overrides[o.key(path.AsString())]; ok {
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
// @evidence contracts/portability.md#os-neutral-implementation Captured inner case policy and native lexical normalization control override lookup; this does not independently prove physical existence. Misses use the supplied inner VFS predicate unchanged.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper retains no new entries or native handles during the query. Existing overrides remain overlay-owned; any temporary handles or metadata caches populated by fallback belong to the supplied inner filesystem.
// @evidence contracts/performance.md#efficient-algorithms Key normalization/case conversion and hashing process path bytes before one override lookup. Hits require no native query; misses add the supplied filesystem's existence-probe or metadata-cache work rather than a universal fixed cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper owns no existence-query sharing coordinator or separate metadata cache; it reads current overrides and delegates inner reuse policy.
func (o *OverlayFS) FileExists(path shimtspath.RootedFilePath) bool {
  if _, ok := o.overrides[o.key(path.AsString())]; ok {
    return true
  }
  return o.FS.FileExists(path)
}
