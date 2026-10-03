package graph

import (
  "crypto/sha256"
  "encoding/hex"
  "sort"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// DumpSchemaVersion is the version of the Dump body shape. It moves when a
// field is added, removed, or given a new meaning, independently of the serve
// envelope's protocol version: a one-shot `ttscgraph dump` written to a file has
// a schema but never rode the protocol.
const DumpSchemaVersion = 8

// The capabilities a snapshot can declare. Each names one class of evidence a
// consumer may rely on when, and only when, the snapshot lists it.
const (
  // CapabilityUniverse means Universe fingerprints the build inputs: the
  // config chain and the root file set are complete for this program.
  CapabilityUniverse = "universe"
  // CapabilitySourceDigests means Sources covers every file the program
  // loaded, each with the digest of the text the checker read.
  CapabilitySourceDigests = "sourceDigests"
  // CapabilityArtifactNodes means the producer asked the project's configured
  // plugins for the artifacts a citation can name, so a dump carrying none is a
  // project that publishes none rather than a producer that never looked. The
  // two states are otherwise the same absent nodes, and a consumer honouring the
  // difference is the whole reason a capability is declared rather than
  // inferred.
  CapabilityArtifactNodes = "artifactNodes"
  // CapabilityDiskDigests means Sources also carries each file's on-disk
  // digest, so an empty one genuinely means the file could not be read.
  //
  // It is separate from CapabilitySourceDigests because a producer can know
  // what the checker read without having hashed the disk, and the two claims
  // fail differently: without this, an empty diskDigest is "did not look",
  // which a consumer would otherwise read as "vanished or virtual".
  CapabilityDiskDigests = "diskDigests"
  // CapabilityDiagnostics means Diagnostics is the compiler's complete
  // findings for this generation, as opposed to not having been collected.
  CapabilityDiagnostics = "diagnostics"
  // CapabilityDocTags means every node carries the documentation tags
  // TypeScript does not recognize, so an absent `docTags` genuinely means the
  // declaration carries none.
  //
  // It is a separate claim rather than an inference from emptiness for the
  // reason CapabilityDiskDigests is: a producer that predates the field emits
  // nothing, and a consumer reading that as "this declaration cites nothing"
  // would answer a citation question with a confident, wrong "no".
  CapabilityDocTags = "docTags"
)

// Provenance is the snapshot's evidence about the program that produced it.
//
// The graph's whole claim is that its nodes, edges, spans, and diagnostics came
// from one Program. Without this, a consumer holding a dump can only re-read the
// disk and hope nothing moved in between — a reconstruction that cannot be made
// sound from the client side, because a write that lands and reverts between the
// build and the re-read is invisible to it. Provenance replaces the hope with
// evidence the compiler already had: it names the producer, fingerprints the
// build universe, and digests every source the checker actually read.
//
// It carries no source body text. A digest is the opposite of inlining: 32 bytes
// per file that let a consumer prove byte-identity against text it read itself.
//
// @evidence contracts/common.md#principled-implementation Explicit capabilities distinguish collected-empty facts from absent evidence, and separate artifact producer identity prevents claiming noncompiler facts came from the Program.
// @evidence contracts/common.md#clear-and-simple-design Producer, universe and source identities form a snapshot manifest without embedding source bodies or client-side reconstruction policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Digests describe captured bytes; no fixture fingerprint, guessed capability or disk reread is represented as compiler proof.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs and member comments explain generation proof, capabilities and second-producer ownership, with documentation-skill spacing.
// @evidence contracts/portability.md#os-neutral-implementation Path-bearing manifest entries are normalized with graph facts by the dump's single native boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms This manifest container chooses no hashing or projection strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The session owner validates reuse using these facts; the record itself coordinates no reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The snapshot owner retains the manifest; this declaration acquires no resource independently.
type Provenance struct {
  // SchemaVersion is DumpSchemaVersion at the time the dump was produced.
  SchemaVersion int `json:"schemaVersion"`

  // Capabilities names what this snapshot actually proves, so a consumer
  // degrades against a statement instead of a guess.
  //
  // An empty list is not the same claim as a missing one. Universe is empty
  // both when a producer fingerprinted the build and found nothing, and when it
  // never looked; only a capability distinguishes those, and a consumer that
  // cannot tell them apart will read "no configs" as "no config changed".
  Capabilities []string `json:"capabilities"`

  // Producer identifies the binary and the checker behind the facts.
  Producer Producer `json:"producer"`

  // ArtifactProducer identifies the second producer behind the artifact nodes,
  // and is absent when the dump carries none.
  //
  // Every other fact here came from one Program. These did not: a plugin parsed
  // documents this Program never read, in a process of its own, and saying so is
  // what keeps the dump's one-generation contract honest instead of letting an
  // overlay ride the same claim as the compiler's facts. A consumer that must
  // not mix the two reads this field; one that only answers "what does this
  // address name" does not care.
  ArtifactProducer *Producer `json:"artifactProducer,omitempty"`

  // Universe fingerprints the inputs that decide which files are in the
  // program at all, as opposed to what is inside them.
  Universe Universe `json:"universe"`

  // Sources digests every file the program loaded, ordered by file.
  Sources []SourceDigest `json:"sources"`
}

// Producer identifies what built a snapshot.
//
// Tool and Version are two fields rather than one because more than one binary
// in this repository can produce a dump, and they do not share a version line:
// the shipped `ttscgraph` is stamped at release, while the internal viewer tool
// is not versioned at all. Folding the name into the version field would hand a
// consumer that parses a version the string "graphdump".
//
// @evidence contracts/common.md#principled-implementation Separate tool, tool-version and linked TypeScript-version fields identify the actual producer without conflating independent version lines.
// @evidence contracts/common.md#clear-and-simple-design One small identity record is shared by compiler and artifact provenance.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Release stamps and dev absence are represented explicitly rather than inferred from expected graph content.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs define each version source and empty-version meaning under the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Tool identity is protocol metadata rather than a native executable launch representation.
// @evidenceExclude contracts/performance.md#efficient-algorithms This identity record selects no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Callers use producer identity for validation; it owns no shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record owns no retained resource lifecycle.
type Producer struct {
  // Tool is the producing binary's name, such as "ttscgraph".
  Tool string `json:"tool"`

  // Version is the producing binary's build version, as its `--version` prints
  // it. It is stamped at release; a local build reports the dev placeholder, and
  // a tool that carries no version reports "".
  Version string `json:"version"`

  // Typescript is the TypeScript version typescript-go implements, in the form
  // `tsc --version` prints.
  Typescript string `json:"typescript"`
}

// Universe fingerprints the build universe: the inputs that decide which files
// the program contains. A change to any of them can add or drop whole files, so
// a consumer that reuses facts across snapshots must treat a universe change as
// invalidating everything, not just the file that moved.
//
// @evidence contracts/common.md#principled-implementation Config-byte identities and config-attributed root membership distinguish whole-program meaning changes from source-only changes.
// @evidence contracts/common.md#clear-and-simple-design The two complete collections express program membership without mixing per-source content into the universe boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing roots remain observable inputs instead of being omitted because a fixture currently contains no file.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain invalidation breadth, config effects and root-pair identity, using documentation-skill spacing.
// @evidence contracts/portability.md#os-neutral-implementation Config and root file locations use the shared dump coordinate vocabulary, keeping filesystem identities separate from collection membership.
// @evidenceExclude contracts/performance.md#efficient-algorithms Acquisition and normalization operations own the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Session owners compare this manifest to authorize reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The manifest contains values without an independent acquisition or release operation.
type Universe struct {
  // Configs digests the tsconfig chain — the project's own config and every
  // file it extends — one entry per file, ordered by file.
  //
  // The config chain stays a universe input regardless of what any single
  // source contains: compiler options change the meaning of code the checker
  // resolves without any source file changing.
  Configs []FileDigest `json:"configs"`

  // Roots is the resolved root file set, one entry per (config, file) pair,
  // ordered by config then file. A root that a config names but that does not
  // exist on disk is still listed: its absence is part of the fingerprint, and
  // creating it later changes the program.
  Roots []RootFile `json:"roots"`
}

// RootFile is one root file attributed to the config that named it. Project
// references mean two configs can name the same file, and they are not the same
// input, so the pair is the unit rather than the bare path.
//
// @evidence contracts/common.md#principled-implementation The config/file pair preserves distinct project-reference attribution even when multiple configurations name one physical root.
// @evidence contracts/common.md#clear-and-simple-design Two explicit fields avoid embedding attribution into a guessed compound path string.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No root is reattributed by package name or expected project layout.
// @evidence contracts/common.md#meaningful-documentation Native prose and member comments define pair identity and path vocabulary under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Both fields carry the same portable path coordinate established by native dump mapping.
// @evidenceExclude contracts/performance.md#efficient-algorithms This pair selects no root-resolution algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The universe owner determines reuse validity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The pair has no independent retained-state lifecycle.
type RootFile struct {
  // Config is the tsconfig that named this root, in the dump's path vocabulary.
  Config string `json:"config"`

  // File is the root file, in the dump's path vocabulary.
  File string `json:"file"`
}

// FileDigest pairs a file with the SHA-256 of its bytes, hex-encoded.
//
// @evidence contracts/common.md#principled-implementation A location and hex SHA-256 value identify the captured native file bytes without inlining their contents.
// @evidence contracts/common.md#clear-and-simple-design The pair separates path identity from byte identity for config manifests.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Digest values are actual captured evidence rather than expected fixture checksums.
// @evidence contracts/common.md#meaningful-documentation Native prose and member comments state SHA-256 encoding and path vocabulary, with documentation-skill tag spacing.
// @evidence contracts/portability.md#os-neutral-implementation File uses the dump's portable coordinate; the bytes hashed do not depend on OS newline rewriting.
// @evidenceExclude contracts/performance.md#efficient-algorithms Hash acquisition belongs to the producing operation, not the pair type.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The snapshot owner consumes the identity for reuse decisions.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This pair owns no file handle or cache.
type FileDigest struct {
  // File uses the dump's path vocabulary.
  File string `json:"file"`

  // Digest is the hex-encoded SHA-256 of the file's on-disk bytes.
  Digest string `json:"digest"`
}

// SourceDigest is the manifest entry for one source file the program loaded.
//
// It carries two digests on purpose, because "the bytes the checker read" and
// "the bytes on disk" are not always the same string, and a consumer needs to
// know which one it is comparing against:
//
//   - Checker digests the exact text the checker resolved against. It is the
//     ground truth for the facts: every node, edge, and span in this dump was
//     computed from these bytes.
//   - Disk digests the file's on-disk bytes as of this snapshot. It is what a
//     consumer that opens the file itself can reproduce.
//
// They diverge when a SourcePreamble plugin injects text ahead of the file
// before tsgo parses it. A
// single digest would then be a lie in one direction or the other: matched
// against the checker it would never equal a consumer's read, and matched
// against the disk it would not describe the text the facts came from. Publishing
// both lets a consumer verify its own read against Disk and still know, from
// Checker != Disk, that the checker saw augmented text and byte-identity with
// the facts is not available for that file.
//
// Both are digests. Neither is text: the wire never carries a file's bytes, and
// the field names say digest so that stays true by reading.
//
// @evidence contracts/common.md#principled-implementation Checker and disk byte identities remain separate because source preamble injection can make one differ from the other in the same generation.
// @evidence contracts/common.md#clear-and-simple-design One manifest entry carries both origins without conflating an absent disk digest with compiler text identity.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A matching digest is not fabricated from a later reread or treated as evidence the producer never collected.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain preamble divergence and each digest's origin, with documentation-skill member/tag separation.
// @evidence contracts/portability.md#os-neutral-implementation The shared mapped file coordinate associates both byte digests with one physical source; hashing preserves exact captured bytes.
// @evidenceExclude contracts/performance.md#efficient-algorithms Capturing and hashing are operation responsibilities rather than data-container behavior.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The session consumes these distinctions to authorize reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record owns no retained source text, handle or running task.
type SourceDigest struct {
  // File uses the dump's path vocabulary.
  File string `json:"file"`

  // Checker is the hex-encoded SHA-256 of the text the checker resolved
  // against.
  Checker string `json:"checkerDigest"`

  // Disk is the hex-encoded SHA-256 of the file's on-disk bytes at snapshot
  // time, or "" when the file could not be read — it vanished mid-load, or it
  // is a virtual source with no on-disk identity. An empty Disk means a
  // consumer cannot reproduce this file's bytes and must not claim it did.
  //
  // Read this only when the snapshot declares CapabilityDiskDigests. Without
  // that claim every Disk is empty because the producer never hashed the disk,
  // which is a different fact from a file that could not be read.
  Disk string `json:"diskDigest"`
}

// Diagnostic is one compiler diagnostic riding the snapshot that produced the
// facts. Positions are 1-based and authored-relative: where a SourcePreamble
// plugin injected text ahead of a file, the driver maps the position back onto
// the bytes a consumer can read for itself (the file this dump publishes a Disk
// digest of), rather than onto the augmented text the checker saw. Node spans in
// this dump stay checker-relative by declaration — see SourceDigest — because
// they describe the facts, while a diagnostic is an instruction to go look at a
// line.
//
// A diagnostic that points inside the injected preamble itself has no authored
// counterpart, so it arrives with Line and Column zero and its message intact.
//
// @evidence contracts/common.md#principled-implementation Compiler code, category and authored-relative location preserve the producer's diagnostic finding without substituting plugin judgments.
// @evidence contracts/common.md#clear-and-simple-design A schema-level record separates normalized wire coordinates from driver-specific diagnostic types.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No expected diagnostic or source-preamble offset guess is manufactured by this representation.
// @evidence contracts/common.md#meaningful-documentation Native prose and members define location units, absent location and unprefixed message, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation File is normalized by the same portable mapper as the snapshot facts; it is not case-folded by this container.
// @evidenceExclude contracts/performance.md#efficient-algorithms Diagnostic acquisition and sorting belong to projection operations.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Program-generation owners retain reusable diagnostic results.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The enclosing snapshot owns these values' lifetime.
type Diagnostic struct {
  // File uses the dump's path vocabulary.
  File string `json:"file"`

  // Line is the 1-based line.
  Line int `json:"line"`

  // Column is the 1-based column.
  Column int `json:"column"`

  // Code is the TypeScript diagnostic code, such as 2322.
  Code int `json:"code"`

  // Category is "error" or "warning", the two severities the driver
  // distinguishes: an error fails the build, a warning does not.
  Category string `json:"category"`

  // Message is the diagnostic text, without the code prefix.
  Message string `json:"message"`
}

// Digest hex-encodes a raw SHA-256 sum for the wire.
//
// @evidence contracts/common.md#principled-implementation Standard hex encoding renders the exact fixed-size SHA-256 bytes without changing their identity.
// @evidence contracts/common.md#clear-and-simple-design One narrow formatting adapter centralizes the manifest's digest representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No expected checksum or consumer-specific encoding branch replaces the input sum.
// @evidence contracts/common.md#meaningful-documentation Native prose states algorithm and wire encoding, with documentation-skill tag separation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Encoding a fixed byte array owns no native boundary.
// @evidence contracts/performance.md#efficient-algorithms The 32-byte input encodes to 64 lowercase hex bytes; the standard encoder constructs a temporary byte buffer and converts it to the returned string, with schema-fixed work rather than a measured allocation-count guarantee.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The formatter coordinates no repeated computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The string transfers to the caller and no cache is retained.
func Digest(sum [sha256.Size]byte) string { return hex.EncodeToString(sum[:]) }

// TypescriptVersion reports the TypeScript version the linked checker
// implements.
//
// @evidence contracts/common.md#principled-implementation The linked compiler's Version API is the authority for the TypeScript implementation version.
// @evidence contracts/common.md#clear-and-simple-design One adapter supplies producer metadata without reading a separate package manifest.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No release expectation or fixture version is hardcoded in the graph producer.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the linked checker as the version source under the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Reading compiled version metadata has no native boundary.
// @evidence contracts/performance.md#efficient-algorithms The linked API returns fixed metadata without a repository or filesystem scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The compiler owns static version metadata; this adapter creates no separate computation to cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No resource or retained state is acquired.
func TypescriptVersion() string { return shimcore.Version() }

// NewProvenance assembles a manifest from caller-supplied snapshot inputs while retaining the
// compiler's physical paths. NewDump projects those paths together with every
// node, edge, span, and diagnostic through its one cached path mapper.
// texts maps a source file's path to the text the checker read (as SourceTexts
// returns it); disk maps that path to the hex digest of its on-disk bytes, and
// a path absent from it is reported with an empty Disk. configs and roots come
// must come from the same capture that produced texts. This constructor does not authenticate that origin or the completeness of declared capabilities.
//
// @evidence contracts/common.md#principled-implementation Supplied text is hashed directly and disk/config/root identities are copied. The caller must establish their common acquisition and declared capability coverage; sorting does not authenticate either.
// @evidence contracts/common.md#clear-and-simple-design Capture stays with the session owner and this constructor copies, hashes and orders the manifest without reopening files.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Capabilities are copied verbatim from the supplied list, not inferred from empty collections. This constructor does not validate their vocabulary, coverage or producer authority.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the required common capture, supplied-data limits and later shared path projection under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Physical paths remain untouched until NewDump maps every snapshot field consistently; no native casing or slash heuristic changes the captured identities here.
// @evidence contracts/performance.md#efficient-algorithms Hashing reads all supplied text bytes; records and capability strings are copied into new slices, then sorted with filename/config/capability string comparisons. Comparison count is O(S log S + C log C + R log R + K log K), while compared text length also contributes.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Cross-generation content reuse belongs to the session capture owner; this constructor cannot establish changed-text equivalence from a path alone.
// @evidence contracts/performance.md#bound-retention-and-release-resources New source/config/root/capability slices transfer to the caller, sharing immutable string values but retaining no supplied source body. Their counts and text lengths have no cap here; no historical cache or native handle is owned.
func NewProvenance(
  producer Producer,
  capabilities []string,
  configs []FileDigest,
  roots []RootFile,
  texts map[string]string,
  disk map[string]string,
) Provenance {
  sources := make([]SourceDigest, 0, len(texts))
  for path, text := range texts {
    sources = append(sources, SourceDigest{
      File:    path,
      Checker: Digest(sha256.Sum256([]byte(text))),
      Disk:    disk[path],
    })
  }
  sort.Slice(sources, func(i, j int) bool { return sources[i].File < sources[j].File })

  capturedConfigs := make([]FileDigest, 0, len(configs))
  for _, config := range configs {
    capturedConfigs = append(capturedConfigs, FileDigest{File: config.File, Digest: config.Digest})
  }
  sort.Slice(capturedConfigs, func(i, j int) bool { return capturedConfigs[i].File < capturedConfigs[j].File })

  capturedRoots := make([]RootFile, 0, len(roots))
  for _, root := range roots {
    capturedRoots = append(capturedRoots, RootFile{Config: root.Config, File: root.File})
  }
  sort.Slice(capturedRoots, func(i, j int) bool {
    if capturedRoots[i].Config != capturedRoots[j].Config {
      return capturedRoots[i].Config < capturedRoots[j].Config
    }
    return capturedRoots[i].File < capturedRoots[j].File
  })

  // Copy before sorting: the caller may share its slice with other consumers,
  // and sorting in place would reorder it under every other reader. The copy of
  // a nil is an empty list, which is what the wire wants anyway.
  declared := append([]string{}, capabilities...)
  sort.Strings(declared)

  return Provenance{
    SchemaVersion: DumpSchemaVersion,
    Capabilities:  declared,
    Producer:      producer,
    Universe:      Universe{Configs: capturedConfigs, Roots: capturedRoots},
    Sources:       sources,
  }
}

// NewDiagnostics projects the resident Program's driver diagnostic result while
// retaining reported File spelling. NewDump maps and re-sorts it with the
// rest of the snapshot so every path uses one vocabulary.
//
// This makes one Program.Diagnostics() call, without constructing a second
// Program. Native syntax/options/global stages can short-circuit semantic work,
// while queries that reach semantic checking may perform previously uncomputed
// work. Nil-Program and latched linked-hook errors remain in the result too;
// this adapter does not execute additional lint or transform producers.
//
// @evidence contracts/common.md#principled-implementation Driver diagnostic fields, including fileless failures, are projected without changing supplied codes, authored locations or messages; this is not compiler-only origin or physical identity authentication.
// @evidence contracts/common.md#clear-and-simple-design One shared projection supplies the complete generation view while Program owns semantic diagnostic acquisition.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Publication asks the current driver for findings instead of inferring success from graph binding, dropping latched failures or injecting expected outcomes.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish reported paths, staged acquisition, possible first-query work and driver failures under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Reported File strings pass unchanged until the shared dump mapper; this constructor neither resolves native aliases nor authenticates physical identity.
// @evidence contracts/performance.md#efficient-algorithms Each call includes native staged acquisition, driver filtering/conversion/sorting and a second record projection/sort with filename-byte comparisons. Finding count alone does not bound checker, message or source-location work.
// @evidence contracts/performance.md#reuse-equivalent-work Program owns native diagnostic reuse; this adapter constructs no second Program but caches no converted result and does not guarantee every query is warm.
// @evidence contracts/performance.md#bound-retention-and-release-resources Delegated driver findings and projected arrays coexist without a diagnostic cap. Returned scalar/string records belong to the caller; temporary raw AST references remain with acquisition, and no separate Program owner, checker lease or result cache is retained.
func NewDiagnostics(prog *driver.Program) []Diagnostic {
  return newDiagnostics(prog.Diagnostics())
}

// NewDiagnosticsForFiles projects the driver's selected-file query result.
// A nil selection requests the whole Program; an empty non-nil selection makes
// no compiler query but still preserves latched driver failure. Native stages
// may include global findings or inspect dependent types outside the selection;
// selection does not certify a checker-work boundary.
//
// @evidence contracts/common.md#principled-implementation The actual DiagnosticsForFiles result preserves nil-versus-empty selection, staged global findings, driver failures and authored coordinates instead of certifying selected-only origin.
// @evidence contracts/common.md#clear-and-simple-design The partial adapter shares newDiagnostics with the complete view and delegates scoped semantic acquisition to Program.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The invalidation owner supplies scope; no diagnostic quota or fixture-specific suppression removes selected findings.
// @evidence contracts/common.md#meaningful-documentation Native prose states selection semantics, global/dependency work and the empty-selection failure lane, with documentation-skill tag separation.
// @evidence contracts/portability.md#os-neutral-implementation Driver-reported native File strings are preserved for the shared dump mapper without new alias resolution or physical identity certification.
// @evidence contracts/performance.md#efficient-algorithms Native per-file staged queries may repeat global/config work or inspect dependent types; driver conversion/sorting precedes this record copy and text-key sort. Costs include selected population, checker work, accumulated findings and message/path bytes.
// @evidence contracts/performance.md#reuse-equivalent-work Program owns any reusable native checker state and the caller owns invalidated selection; this adapter has no converted-result cache or independent proof that unselected dependencies perform no work.
// @evidence contracts/performance.md#bound-retention-and-release-resources Delegated findings and projected arrays scale without a cap; returned scalar/string records transfer to the caller and acquire no separate Program owner or checker lease. Temporary acquisition references and caller-supplied AST selection remain with their existing owners.
func NewDiagnosticsForFiles(prog *driver.Program, files []*shimast.SourceFile) []Diagnostic {
  return newDiagnostics(prog.DiagnosticsForFiles(files))
}

func newDiagnostics(raw []driver.Diagnostic) []Diagnostic {
  out := make([]Diagnostic, 0, len(raw))
  for _, diagnostic := range raw {
    out = append(out, Diagnostic{
      File:     diagnostic.File,
      Line:     diagnostic.Line,
      Column:   diagnostic.Column,
      Code:     int(diagnostic.Code),
      Category: diagnosticCategory(diagnostic.Severity),
      Message:  diagnostic.Message,
    })
  }
  sort.Slice(out, func(i, j int) bool {
    if out[i].File != out[j].File {
      return out[i].File < out[j].File
    }
    if out[i].Line != out[j].Line {
      return out[i].Line < out[j].Line
    }
    if out[i].Column != out[j].Column {
      return out[i].Column < out[j].Column
    }
    return out[i].Code < out[j].Code
  })
  return out
}

// provenance maps every path-bearing provenance field through the dump's one
// mapper and sorts on the resulting wire identity.
func (c *dumpContext) provenance(value Provenance) Provenance {
  sources := make([]SourceDigest, 0, len(value.Sources))
  for _, source := range value.Sources {
    sources = append(sources, SourceDigest{
      File:    c.rel(source.File),
      Checker: source.Checker,
      Disk:    source.Disk,
    })
  }
  sort.Slice(sources, func(i, j int) bool { return sources[i].File < sources[j].File })

  configs := make([]FileDigest, 0, len(value.Universe.Configs))
  for _, config := range value.Universe.Configs {
    configs = append(configs, FileDigest{File: c.rel(config.File), Digest: config.Digest})
  }
  sort.Slice(configs, func(i, j int) bool { return configs[i].File < configs[j].File })

  roots := make([]RootFile, 0, len(value.Universe.Roots))
  for _, root := range value.Universe.Roots {
    roots = append(roots, RootFile{Config: c.rel(root.Config), File: c.rel(root.File)})
  }
  sort.Slice(roots, func(i, j int) bool {
    if roots[i].Config != roots[j].Config {
      return roots[i].Config < roots[j].Config
    }
    return roots[i].File < roots[j].File
  })

  value.Capabilities = append([]string{}, value.Capabilities...)
  value.Sources = sources
  value.Universe = Universe{Configs: configs, Roots: roots}
  return value
}

// diagnostics maps and orders compiler findings after they join the dump, not
// in their constructor, so they cannot drift onto a second path vocabulary.
func (c *dumpContext) diagnostics(values []Diagnostic) []Diagnostic {
  out := make([]Diagnostic, 0, len(values))
  for _, diagnostic := range values {
    diagnostic.File = c.rel(diagnostic.File)
    out = append(out, diagnostic)
  }
  sort.Slice(out, func(i, j int) bool {
    if out[i].File != out[j].File {
      return out[i].File < out[j].File
    }
    if out[i].Line != out[j].Line {
      return out[i].Line < out[j].Line
    }
    if out[i].Column != out[j].Column {
      return out[i].Column < out[j].Column
    }
    return out[i].Code < out[j].Code
  })
  return out
}

// diagnosticCategory names a severity the way tsc labels it. The driver
// distinguishes exactly two, and SeverityError is the zero value, so anything
// that is not an explicit warning is an error.
func diagnosticCategory(severity driver.Severity) string {
  if severity == driver.SeverityWarning {
    return "warning"
  }
  return "error"
}
