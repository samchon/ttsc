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

// inputProofFailure carries per-Program input observation state.
//
// @evidence contracts/common.md#principled-implementation Recorded answers and sticky failures remain distinct from absent observations and later filesystem values.
// @evidence contracts/common.md#clear-and-simple-design The ledger owns one current generation; wire predicates and publication are separate consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The state offers no successful completeness setter or guessed input witness.
// @evidence contracts/common.md#meaningful-documentation The declaration and owning observer methods describe the generation, predicate and failure responsibilities.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This state shape performs no native operation; supplied VFS methods preserve the observed semantics.
// @evidenceExclude contracts/performance.md#efficient-algorithms The declaration supplies stored state rather than an algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The state is not an independent cross-generation artifact cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns the ledger and releases it; records grow with actually observed lexical/physical keys and retain no native descriptor or watcher.
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
//
// @evidence contracts/common.md#principled-implementation Failed reads and returned compiler text remain distinct rather than turning an unreadable path into a guessed file kind or claiming a decoded-text hash proves raw disk-byte equality.
// @evidence contracts/common.md#clear-and-simple-design Read success and content digest form one predicate value.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No later file read manufactures missing evaluation-time content proof.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes failure from file-kind inference following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The boundary value records the actual filesystem read result without assuming OS-specific absence semantics.
// @evidenceExclude contracts/performance.md#efficient-algorithms The filesystem observer owns hashing; this type describes a read result.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate value does not coordinate reusable work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The value owns no resource or independently retained collection.
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
//
// @evidence contracts/common.md#principled-implementation Reported Realpath identity remains separate from the lexical input; successful physical resolution can expose symlink/junction identity, while adapter fallback remains a reported spelling rather than proven physical identity.
// @evidence contracts/common.md#clear-and-simple-design Success and resolved path form one identity predicate.
// @evidence contracts/common.md#prohibited-implementation-shortcuts An empty adapter result remains failed; a nonempty lexical fallback follows the adapter's actual result and is not independently relabeled as proven physical resolution.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies Realpath and adjacent existence observation following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Path carries the cleaned native adapter result, distinct from slash-normalized envelope keys. OK distinguishes empty from nonempty results, not every native resolution error: the pinned OS VFS returns its requested spelling on resolution/absolute-path error. No OS-name guess upgrades that fallback into a physical capability proof.
// @evidenceExclude contracts/performance.md#efficient-algorithms The observer owns native identity lookup; the type is its result.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work An identity value does not coordinate artifact reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The value owns no resource or resident cache.
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
//
// @evidence contracts/common.md#principled-implementation Files and directories preserve the compiler enumeration result, including followed native links, as separate membership constraints.
// @evidence contracts/common.md#clear-and-simple-design Two returned name lists represent one enumeration without collapsing file and directory membership or inventing an enumeration-success flag.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Directory members come from the observed native predicate rather than a later guessed glob.
// @evidence contracts/common.md#meaningful-documentation Native prose states ordering, lexical names, and followed-link behavior following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Lists preserve returned native child names, not joined paths or physical identities. The native VFS distinguishes file/directory targets through stat for recognized links/reparse points; failed enumeration or target classification can omit names. Neither empty lists nor discarded link metadata certify complete native membership or an OS-default case policy.
// @evidenceExclude contracts/performance.md#efficient-algorithms The filesystem observer owns enumeration and copying; this type carries the result.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Membership data does not itself coordinate computation reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller-owned predicate value owns no separate resource lifecycle.
type transformInputEntriesObservation struct {
  // Directories contains the observed accessible child-directory names.
  Directories []string `json:"directories"`

  // Files contains the observed accessible child-file names.
  Files []string `json:"files"`
}

// transformInputObservation preserves independent compiler filesystem
// predicates for one lexical path. False FileExists and true DirectoryExists
// are compatible constraints, not a path-kind race.
//
// @evidence contracts/common.md#principled-implementation Independent FileExists, DirectoryExists, ReadFile, enumeration, stat, and identity predicates preserve compatible native answers without false kind conflicts.
// @evidence contracts/common.md#clear-and-simple-design Optional fields distinguish unasked predicates from observed false values.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing predicates remain absent rather than being reconstructed from a collapsed hash projection.
// @evidence contracts/common.md#meaningful-documentation Native prose explains independent constraints and the nonconflicting example following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Actual native predicate results are represented explicitly without guessed filesystem capabilities or OS case policy.
// @evidenceExclude contracts/performance.md#efficient-algorithms The observer owns merge and compatibility algorithms; this type defines their proof representation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The representation provides evidence to reuse owners without coordinating artifacts itself.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The proof value acquires no lease or independent resident cache.
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

// observedInput carries per-Program input observation state.
//
// @evidence contracts/common.md#principled-implementation Recorded answers and sticky failures remain distinct from absent observations and later filesystem values.
// @evidence contracts/common.md#clear-and-simple-design The ledger owns one current generation; wire predicates and publication are separate consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The state offers no successful completeness setter or guessed input witness.
// @evidence contracts/common.md#meaningful-documentation The declaration and owning observer methods describe the generation, predicate and failure responsibilities.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This state shape performs no native operation; supplied VFS methods preserve the observed semantics.
// @evidenceExclude contracts/performance.md#efficient-algorithms The declaration supplies stored state rather than an algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The state is not an independent cross-generation artifact cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns the ledger and releases it; records grow with actually observed lexical/physical keys and retain no native descriptor or watcher.
type observedInput struct {
  failure inputProofFailure
  proof   transformInputObservation
}

// inputObservationFS records the exact disk state returned through the
// compiler filesystem. A later transform envelope can therefore prove which
// bytes and resolution-candidate states produced its resident Program instead
// of attaching post-compile disk hashes to an earlier result.
// inputObservationFS carries per-Program input observation state.
//
// @evidence contracts/common.md#principled-implementation Recorded answers and sticky failures remain distinct from absent observations and later filesystem values.
// @evidence contracts/common.md#clear-and-simple-design The ledger owns one current generation; wire predicates and publication are separate consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The state offers no successful completeness setter or guessed input witness.
// @evidence contracts/common.md#meaningful-documentation The declaration and owning observer methods describe the generation, predicate and failure responsibilities.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This state shape performs no native operation; supplied VFS methods preserve the observed semantics.
// @evidenceExclude contracts/performance.md#efficient-algorithms The declaration supplies stored state rather than an algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The state is not an independent cross-generation artifact cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns the ledger and releases it; records grow with actually observed lexical/physical keys and retain no native descriptor or watcher.
type inputObservationFS struct {
  vfs.FS
  caseSensitive        bool
  mu                   sync.Mutex
  observations         map[string]observedInput
  observationOrder     []string
  observationSpellings map[string]string
}

// newInputObservationFS owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func newInputObservationFS(inner vfs.FS) *inputObservationFS {
  return &inputObservationFS{
    FS:                   inner,
    caseSensitive:        inner.UseCaseSensitiveFileNames(),
    observations:         map[string]observedInput{},
    observationSpellings: map[string]string{},
  }
}

// bool owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) FileExists(path string) bool {
  exists := fs.FS.FileExists(path)
  proof := transformInputObservation{FileExists: boolPointer(exists)}
  if exists {
    // Existence participates in resolution, but only ReadFile returns bytes
    // that can influence the resident Program. Do not duplicate every
    // resolver probe with an eager file read.
    proof.Realpath = fs.currentRealpath(path)
  }
  fs.observe(path, observedInput{proof: proof})
  return exists
}

// ReadFile owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Retains the actual decoded compiler text and its SHA256, separate from raw contributor bytes.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidence contracts/portability.md#os-neutral-implementation Uses the supplied compiler VFS answers and reported identity; native lexical fallback is retained without certifying physical resolution.
// @evidence contracts/performance.md#efficient-algorithms Hashes returned text in linear byte time and retains its fixed-size digest.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) ReadFile(path string) (string, bool) {
  contents, ok := fs.FS.ReadFile(path)
  if ok {
    digest := sha256.Sum256([]byte(contents))
    hash := hex.EncodeToString(digest[:])
    fs.observe(path, observedInput{
      proof: transformInputObservation{
        ReadFile: &transformInputReadObservation{OK: true, Hash: hash},
        Realpath: fs.currentRealpath(path),
      },
    })
  } else {
    fs.observe(path, observedInput{
      proof: transformInputObservation{
        ReadFile: &transformInputReadObservation{OK: false},
      },
    })
  }
  return contents, ok
}

// bool owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) DirectoryExists(path string) bool {
  exists := fs.FS.DirectoryExists(path)
  proof := transformInputObservation{DirectoryExists: boolPointer(exists)}
  if exists {
    proof.Realpath = fs.currentRealpath(path)
  }
  fs.observe(path, observedInput{proof: proof})
  return exists
}

// vfs owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) GetAccessibleEntries(path string) vfs.Entries {
  entries := fs.FS.GetAccessibleEntries(path)
  fs.observe(path, observedInput{
    proof: transformInputObservation{
      AccessibleEntries: &transformInputEntriesObservation{
        Directories: append([]string{}, entries.Directories...),
        Files:       append([]string{}, entries.Files...),
      },
    },
  })
  return entries
}

// vfs owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) Stat(path string) vfs.FileInfo {
  info := fs.FS.Stat(path)
  kind := "missing"
  if info == nil {
    fs.observe(path, observedInput{
      proof: transformInputObservation{Stat: &kind},
    })
  } else if info.IsDir() {
    kind = "directory"
    fs.observe(path, observedInput{
      proof: transformInputObservation{
        Stat:     &kind,
        Realpath: fs.currentRealpath(path),
      },
    })
  } else {
    kind = "file"
    fs.observe(path, observedInput{
      proof: transformInputObservation{
        Stat:     &kind,
        Realpath: fs.currentRealpath(path),
      },
    })
  }
  return info
}

// string owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) Realpath(path string) string {
  realpath := fs.FS.Realpath(path)
  fs.observe(path, observedInput{
    proof: transformInputObservation{Realpath: realpathObservation(realpath)},
  })
  return realpath
}

// currentRealpath owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidence contracts/portability.md#os-neutral-implementation Uses the supplied compiler VFS answers and reported identity; native lexical fallback is retained without certifying physical resolution.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) currentRealpath(path string) *transformInputRealpathObservation {
  return realpathObservation(fs.FS.Realpath(path))
}

// realpathObservation owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func realpathObservation(realpath string) *transformInputRealpathObservation {
  if realpath == "" {
    return &transformInputRealpathObservation{OK: false}
  }
  return &transformInputRealpathObservation{
    OK:   true,
    Path: filepath.Clean(realpath),
  }
}

// boolPointer owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func boolPointer(value bool) *bool {
  return &value
}

// string owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) observationKey(path string) string {
  if !filepath.IsAbs(path) {
    return ""
  }
  return shimtspath.GetCanonicalFileName(
    shimtspath.NormalizePath(path),
    fs.caseSensitive,
  )
}

// observe owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Joins lexical and observed physical read keys without another content read.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Cleans/indexes the selected lexical and physical spellings and merges their fixed predicate set; costs include path and compared list bytes.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
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
// mergeObservation owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Makes any inconsistent repeated predicate sticky for this generation.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
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

// sameEntriesObservation owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Compares actual retained entry lists in linear member/name bytes.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func sameEntriesObservation(left, right *transformInputEntriesObservation) bool {
  return slices.Equal(left.Directories, right.Directories) && slices.Equal(left.Files, right.Files)
}

// observedPaths returns the exact lexical spellings on which this wrapper
// observed at least one filesystem predicate, in first-observation order.
// observedPaths owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Copies the current observed path population under the mutex.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) observedPaths() []string {
  fs.mu.Lock()
  defer fs.mu.Unlock()
  output := make([]string, 0, len(fs.observationOrder))
  for _, key := range fs.observationOrder {
    output = append(output, fs.observationSpellings[key])
  }
  return output
}

// bool owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
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
// mergeFrom owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Joins already observed replay records and sticky failures under the ledger mutex.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Traverses the supplied ledger population and joins recorded predicates, with path/list comparison costs.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
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

// failObservation owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func (fs *inputObservationFS) failObservation(key string, observed observedInput, failure inputProofFailure) {
  observed.failure = failure
  fs.observations[key] = observed
}

// sameReadObservation owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func sameReadObservation(left, right *transformInputReadObservation) bool {
  return left.OK == right.OK && left.Hash == right.Hash
}

// sameRealpathObservation owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
func sameRealpathObservation(left, right *transformInputRealpathObservation) bool {
  return left.OK == right.OK && left.Path == right.Path
}

// transformInputObservationCompatible owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Preserves one stored predicate, ledger transition or value comparison without manufacturing native observations.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
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
// predicateProof owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Returns only recorded compatible predicates; no query manufactures an absent witness.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Uses fixed predicate bookkeeping plus path/string/list comparison bytes where present; no unrelated filesystem tree is traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
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
// proof owns this step of the independent lint Program input ledger.
//
// @evidence contracts/common.md#principled-implementation Projects only recorded content, directory and realpath witnesses; missing authority remains a distinct failure.
// @evidence contracts/common.md#clear-and-simple-design Recording, consistency checks and proof projection remain separate from sidecar publication and contributor raw-byte reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved/conflicting predicates cannot gain later synthetic byte or identity authority.
// @evidence contracts/common.md#meaningful-documentation The comment names the generation ledger step; detailed predicate types document decoding and native fallback limits.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation compares or stores recorded values; the VFS-facing operations own native filesystem semantics.
// @evidence contracts/performance.md#efficient-algorithms Looks up recorded witnesses and compares selected path/text/list evidence; no new file content is read.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-generation cache; the current ledger only records this Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The owning Program releases the ledger; one current record per observed lexical/physical key grows with actual queries, with no watcher, descriptor or historical generation retained.
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
