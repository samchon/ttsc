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
  // ReadFile returns the bytes consumed by the contributor without compiler
  // decoding. A recording host must retain those returned bytes' predicate;
  // a later read cannot substitute for this operation.
  //
  // @evidence contracts/common.md#principled-implementation The byte slice and error preserve the actual read result, including BOMs and failed reads, independently of compiler-decoded text.
  // @evidence contracts/common.md#clear-and-simple-design The single read operation separates consumption from the host's retained predicate and sidecar publication.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts A recording implementation must observe this read rather than reread the path later to manufacture consumed content.
  // @evidence contracts/common.md#meaningful-documentation The native comment specifies byte preservation and the consumption-time requirement.
  // @evidence contracts/portability.md#os-neutral-implementation Native path and error semantics remain the implementing filesystem's; returned bytes have no assumed text encoding.
  // @evidenceExclude contracts/performance.md#efficient-algorithms The interface prescribes a result boundary, not the implementation's read/hash algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work This method signature does not authorize caching or sharing reads.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The implementing host owns descriptors and observation lifetime; the signature acquires none.
  ReadFile(string) ([]byte, error)

  // Stat follows the selected path's native links and returns target metadata.
  // An observation must retain that target distinction rather than link-entry
  // metadata; query errors remain errors.
  //
  // @evidence contracts/common.md#principled-implementation os.FileInfo and error preserve the target metadata query instead of conflating it with Lstat's entry query.
  // @evidence contracts/common.md#clear-and-simple-design Target metadata has its own operation so callers select its link-following semantics explicitly.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The query contract does not turn inaccessible targets into successful absence or fabricate content proof from metadata.
  // @evidence contracts/common.md#meaningful-documentation The comment explains link following and the distinction from entry metadata.
  // @evidence contracts/portability.md#os-neutral-implementation os.FileInfo carries the native target kind and mode; errors and path spelling are not replaced by OS-name assumptions.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Native metadata query strategy belongs to the implementing reader.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature defines no metadata memo or validation policy.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The interface retains no metadata history or native handle.
  Stat(string) (os.FileInfo, error)

  // Lstat returns metadata for the named entry without following its final
  // link. A host unable to represent that entry predicate must withdraw
  // completeness while preserving the contributor's native result.
  //
  // @evidence contracts/common.md#principled-implementation Separate entry metadata preserves final-link identity, which target-only Stat cannot express.
  // @evidence contracts/common.md#clear-and-simple-design A distinct method exposes the contributor's chosen entry semantics rather than a hidden boolean option.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Unrepresentable link-entry evidence requires withdrawal rather than substitution with the target's predicate.
  // @evidence contracts/common.md#meaningful-documentation Native prose states final-link behavior and the unsupported observation boundary.
  // @evidence contracts/portability.md#os-neutral-implementation Entry kinds and link modes come from os.FileInfo on the actual filesystem; unsupported kinds are not inferred from the platform name.
  // @evidenceExclude contracts/performance.md#efficient-algorithms The implementation owns the native query and recording algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work No shared metadata result is declared by this signature.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature owns no retained collection or native handle.
  Lstat(string) (os.FileInfo, error)

  // ReadDir returns the selected directory's entries in native os.ReadDir
  // name order. Its native membership/link predicate is distinct from the compiler's followed-target GetAccessibleEntries query. Observation support must retain entry distinctions it consumes
  // or withdraw completeness; it must not enumerate unrelated children.
  //
  // @evidence contracts/common.md#principled-implementation The entry list preserves native directory membership and entry kinds, including links and special entries, without labeling raw os.ReadDir selection as compiler followed-target membership. Unsupported or failed observations withdraw authority rather than treating directory existence as a complete listing.
  // @evidence contracts/common.md#clear-and-simple-design One directory query supplies the contributor's list, independently of recursive traversal policy.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Neither unrelated recursive inventory nor a guessed empty list can replace the actual consumed entries.
  // @evidence contracts/common.md#meaningful-documentation The comment distinguishes one listing from recursive walking and specifies native name order.
  // @evidence contracts/portability.md#os-neutral-implementation Native fs.DirEntry names and kinds carry the filesystem's representation; unsupported link predicates withdraw proof instead of assuming another filesystem's behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Enumeration and ordering cost belong to the implementing reader.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work The interface does not cache directory results or establish their continued validity.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The host controls returned-list and recorded-observation lifetime.
  ReadDir(string) ([]os.DirEntry, error)

  // Readlink returns the named link's native target text, which may be relative.
  // A failed link query does not by itself prove that the named entry is absent.
  //
  // @evidence contracts/common.md#principled-implementation Link text is a distinct consumed input from resolved physical identity; returning it unchanged preserves relative-target meaning.
  // @evidence contracts/common.md#clear-and-simple-design Link text has a separate operation from EvalSymlinks, avoiding an implicit conversion to a resolved path.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Failure is not recast as absence or replaced with current target content.
  // @evidence contracts/common.md#meaningful-documentation The native prose explains relative text and the non-absence meaning of an error.
  // @evidence contracts/portability.md#os-neutral-implementation The implementing filesystem supplies native link text and errors, including unsupported link forms; no path dialect is imposed by this interface.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Query and predicate-encoding cost belong to the implementation.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature declares no reusable link result.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No link handle or target history is owned by the interface.
  Readlink(string) (string, error)

  // EvalSymlinks resolves the native path's links using filepath semantics.
  // Its result spelling is preserved for callers; observation coordinates
  // may be made absolute separately without changing that returned spelling.
  //
  // @evidence contracts/common.md#principled-implementation Native resolution remains distinct from lexical normalization and from link target text.
  // @evidence contracts/common.md#clear-and-simple-design Physical resolution is explicit, while the observer independently records its wire coordinate.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts A resolution failure is not silently certified as physical identity.
  // @evidence contracts/common.md#meaningful-documentation The comment separates returned spelling from absolute observation coordinates.
  // @evidence contracts/portability.md#os-neutral-implementation filepath resolution follows the actual native link/path behavior; the interface imposes no case-folding or Unix-only spelling.
  // @evidenceExclude contracts/performance.md#efficient-algorithms The native resolution algorithm belongs to the implementing operation.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work The declaration supplies no resolution cache.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The interface retains no physical identity history or native resource.
  EvalSymlinks(string) (string, error)

  // WalkDir preserves filepath.WalkDir's lexical traversal and callback error,
  // SkipDir and SkipAll effects. It does not follow symbolic-link entries or
  // observe children of a skipped directory.
  //
  // @evidence contracts/common.md#principled-implementation The callback contract preserves traversal control, including skipped subtrees and errors, instead of exposing an unconditional inventory.
  // @evidence contracts/common.md#clear-and-simple-design The walking operation owns ordering/control while its reader supplies selected entry and directory answers.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Recording cannot prewalk skipped children or follow links that native WalkDir would leave as entries.
  // @evidence contracts/common.md#meaningful-documentation The comment specifies ordering, cancellation-like callback controls and final-link behavior.
  // @evidence contracts/portability.md#os-neutral-implementation Native fs.DirEntry and filepath traversal semantics define entry representation and joined paths on each host.
  // @evidenceExclude contracts/performance.md#efficient-algorithms The interface defines traversal semantics; the reader implementation owns selected-tree work and ordering storage.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work The method authorizes no replay of effectful callbacks or shared walk result.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Traversal frames and observations are owned by the implementing invocation and host generation.
  WalkDir(string, fs.WalkDirFunc) error

  // Unavailable withdraws this generation's observation completeness. Once
  // withdrawn, later successful operations cannot restore authority.
  //
  // @evidence contracts/common.md#principled-implementation One-way withdrawal represents a consumed input the host cannot prove; it cannot certify an incomplete generation.
  // @evidence contracts/common.md#clear-and-simple-design The explicit operation separates unsupported consumption from successful native query results.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts There is no inverse setter that upgrades missing or conflicting observations into complete proof.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies generation scope and sticky withdrawal.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Withdrawal is a logical capability transition and performs no native query.
  // @evidenceExclude contracts/performance.md#efficient-algorithms This signature specifies a state transition rather than an algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Withdrawal never establishes permission to reuse a result.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The owning generation retains its authority state; this interface acquires no resource.
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
  // UsesProjectInputReader declares that external input consumption uses the
  // supplied generation reader or explicitly calls Unavailable. True is a
  // responsibility declaration, not proof that any input has been observed.
  //
  // @evidence contracts/common.md#principled-implementation An optional affirmative marker distinguishes actual-reader responsibility from pre-Program topology declaration, while concrete predicates still establish proof.
  // @evidence contracts/common.md#clear-and-simple-design One optional method preserves existing ProjectRule implementations and Check signatures.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts True cannot replace consumed-byte evidence or certify an external bridge the reader does not observe.
  // @evidence contracts/common.md#meaningful-documentation The comment states the responsibility and explicitly rejects interpreting the marker as observation proof.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation The capability marker performs no native filesystem operation.
  // @evidenceExclude contracts/performance.md#efficient-algorithms The signature defines a boolean declaration without a processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work It establishes no result reuse permission by itself.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No retained state or resource belongs to this method declaration.
  UsesProjectInputReader() bool
}
