package graph

import (
  "crypto/sha256"
  "encoding/hex"
  "sort"

  shimcore "github.com/microsoft/typescript-go/shim/core"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// DumpSchemaVersion is the version of the Dump body shape. It moves when a
// field is added, removed, or given a new meaning, independently of the serve
// envelope's protocol version: a one-shot `ttscgraph dump` written to a file has
// a schema but never rode the protocol.
const DumpSchemaVersion = 5

// The capabilities a snapshot can declare. Each names one class of evidence a
// consumer may rely on when, and only when, the snapshot lists it.
const (
  // CapabilityUniverse means Universe fingerprints the build inputs: the
  // config chain and the root file set are complete for this program.
  CapabilityUniverse = "universe"
  // CapabilitySourceDigests means Sources covers every file the program
  // loaded, each with the digest of the text the checker read.
  CapabilitySourceDigests = "sourceDigests"
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
type RootFile struct {
  // Config is the tsconfig that named this root, project-relative.
  Config string `json:"config"`

  // File is the root file, project-relative.
  File string `json:"file"`
}

// FileDigest pairs a file with the SHA-256 of its bytes, hex-encoded.
type FileDigest struct {
  // File is project-relative.
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
// before tsgo parses it, which a real plugin project does on every build. A
// single digest would then be a lie in one direction or the other: matched
// against the checker it would never equal a consumer's read, and matched
// against the disk it would not describe the text the facts came from. Publishing
// both lets a consumer verify its own read against Disk and still know, from
// Checker != Disk, that the checker saw augmented text and byte-identity with
// the facts is not available for that file.
//
// Both are digests. Neither is text: the wire never carries a file's bytes, and
// the field names say digest so that stays true by reading.
type SourceDigest struct {
  // File is project-relative.
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
// facts. Positions are 1-based, matching what tsgo reports.
type Diagnostic struct {
  // File is project-relative.
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
func Digest(sum [sha256.Size]byte) string { return hex.EncodeToString(sum[:]) }

// TypescriptVersion reports the TypeScript version the linked checker
// implements.
func TypescriptVersion() string { return shimcore.Version() }

// NewProvenance assembles the evidence for a snapshot. project relativizes every
// path; texts maps a source file's absolute path to the text the checker read
// (as SourceTexts returns it); disk maps a source file's absolute path to the
// hex digest of its on-disk bytes, and a path absent from it is reported with an
// empty Disk. configs and roots come from the same capture that produced texts.
func NewProvenance(
  project string,
  producer Producer,
  capabilities []string,
  configs []FileDigest,
  roots []RootFile,
  texts map[string]string,
  disk map[string]string,
) Provenance {
  ctx := newDumpContext(project, nil)
  sources := make([]SourceDigest, 0, len(texts))
  for path, text := range texts {
    sources = append(sources, SourceDigest{
      File:    ctx.rel(path),
      Checker: Digest(sha256.Sum256([]byte(text))),
      Disk:    disk[path],
    })
  }
  sort.Slice(sources, func(i, j int) bool { return sources[i].File < sources[j].File })

  relConfigs := make([]FileDigest, 0, len(configs))
  for _, config := range configs {
    relConfigs = append(relConfigs, FileDigest{File: ctx.rel(config.File), Digest: config.Digest})
  }
  sort.Slice(relConfigs, func(i, j int) bool { return relConfigs[i].File < relConfigs[j].File })

  relRoots := make([]RootFile, 0, len(roots))
  for _, root := range roots {
    relRoots = append(relRoots, RootFile{Config: ctx.rel(root.Config), File: ctx.rel(root.File)})
  }
  sort.Slice(relRoots, func(i, j int) bool {
    if relRoots[i].Config != relRoots[j].Config {
      return relRoots[i].Config < relRoots[j].Config
    }
    return relRoots[i].File < relRoots[j].File
  })

  // Copy before sorting: the caller's slice is a shared package-level constant,
  // and sorting in place would reorder it under every other reader. The copy of
  // a nil is an empty list, which is what the wire wants anyway.
  declared := append([]string{}, capabilities...)
  sort.Strings(declared)

  return Provenance{
    SchemaVersion: DumpSchemaVersion,
    Capabilities:  declared,
    Producer:      producer,
    Universe:      Universe{Configs: relConfigs, Roots: relRoots},
    Sources:       sources,
  }
}

// NewDiagnostics projects the resident program's compiler diagnostics onto the
// wire shape, relativized against project and ordered by file, line, column,
// then code so a snapshot is byte-stable.
//
// This is one Program.Diagnostics() call over the already-warm checker rather
// than a second compile, but it is not free: it forces the semantic check of
// every file the graph would otherwise only have bound. Callers that do not
// publish diagnostics should not call it.
func NewDiagnostics(prog *driver.Program, project string) []Diagnostic {
  ctx := newDumpContext(project, nil)
  raw := prog.Diagnostics()
  out := make([]Diagnostic, 0, len(raw))
  for _, diagnostic := range raw {
    out = append(out, Diagnostic{
      File:     ctx.rel(diagnostic.File),
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

// diagnosticCategory names a severity the way tsc labels it. The driver
// distinguishes exactly two, and SeverityError is the zero value, so anything
// that is not an explicit warning is an error.
func diagnosticCategory(severity driver.Severity) string {
  if severity == driver.SeverityWarning {
    return "warning"
  }
  return "error"
}
