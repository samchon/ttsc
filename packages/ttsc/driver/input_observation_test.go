package driver

import (
  "crypto/sha256"
  "encoding/hex"
  "errors"
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

//
// @evidence contracts/testing.md#behavioral-verification The observing filesystem fails the proof with inputProofContentChanged after a file read as A is changed to B and then restored to A.
// @evidence contracts/testing.md#independent-expectations The three contents A, B and A and the expected failure constant are written literally.
// @evidence contracts/testing.md#distinguishing-cases A-B-A is the case a final-state comparison would accept; the second read of B makes the observation fail even though the bytes match again.
// @evidence contracts/testing.md#execution-ownership TestInputObservationFSRejectsRestoredContent is a Go unit test inside the driver package: it calls the unexported operation in-process with literal inputs or a temporary directory, installing no consumer and starting no product process.
func TestInputObservationFSRejectsRestoredContent(t *testing.T) {
  root := t.TempDir()
  file := filepath.Join(root, "external.d.ts")
  if err := os.WriteFile(file, []byte("A"), 0o644); err != nil {
    t.Fatal(err)
  }
  observed := newInputObservationFS(DefaultFS())
  if contents, ok := observed.ReadFile(file); !ok || contents != "A" {
    t.Fatalf("first read = %q, %v", contents, ok)
  }
  if err := os.WriteFile(file, []byte("B"), 0o644); err != nil {
    t.Fatal(err)
  }
  if contents, ok := observed.ReadFile(file); !ok || contents != "B" {
    t.Fatalf("second read = %q, %v", contents, ok)
  }
  if err := os.WriteFile(file, []byte("A"), 0o644); err != nil {
    t.Fatal(err)
  }
  if _, _, failure := observed.proof(file); failure != inputProofContentChanged {
    t.Fatalf("A-B-A proof failure = %q, want %q", failure, inputProofContentChanged)
  }
}

//
// @evidence contracts/testing.md#behavioral-verification The proof reports the SHA-256 of the bytes the compiler read, a realpath for the read file, an existence-only failure for an unread file and an observed-missing state for an absent candidate.
// @evidence contracts/testing.md#independent-expectations The expected digest is computed independently from the literal file contents with crypto/sha256.
// @evidence contracts/testing.md#distinguishing-cases An existence-only check, a read and a missing candidate are three distinct states with different proof outcomes.
// @evidence contracts/testing.md#execution-ownership TestInputObservationFSProvesReadBytesAndMissingCandidates is a Go unit test inside the driver package: it calls the unexported operation in-process with literal inputs or a temporary directory, installing no consumer and starting no product process.
func TestInputObservationFSProvesReadBytesAndMissingCandidates(t *testing.T) {
  root := t.TempDir()
  file := filepath.Join(root, "selected.ts")
  missing := filepath.Join(root, "superseding.ts")
  contents := "export const selected = true;\n"
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
  observed := newInputObservationFS(DefaultFS())
  if !observed.FileExists(file) {
    t.Fatal("selected file was not found")
  }
  if _, _, failure := observed.proof(file); failure != inputProofContentUnavailable {
    t.Fatalf("existence-only proof failure = %q, want %q", failure, inputProofContentUnavailable)
  }
  if _, ok := observed.ReadFile(file); !ok {
    t.Fatal("selected file was not read")
  }
  if observed.FileExists(missing) {
    t.Fatal("missing candidate unexpectedly exists")
  }

  digest := sha256.Sum256([]byte(contents))
  wantHash := hex.EncodeToString(digest[:])
  hash, realpath, failure := observed.proof(file)
  if failure != "" || hash == nil || *hash != wantHash {
    t.Fatalf("selected proof hash = %v, failure %q", hash, failure)
  }
  wantRealpath, err := filepath.EvalSymlinks(file)
  if err != nil {
    t.Fatal(err)
  }
  if realpath == nil || filepath.Clean(*realpath) != filepath.Clean(wantRealpath) {
    t.Fatalf("selected proof realpath = %v, want %q", realpath, wantRealpath)
  }
  hash, realpath, failure = observed.proof(missing)
  if failure != "" || hash != nil || realpath != nil {
    t.Fatalf("missing proof = %v, %v, failure %q", hash, realpath, failure)
  }
}

//
// TestInputObservationFSPreservesPredicateSemantics covers five named cases:
// native directory predicates, seven authored repeated-observation pairs,
// three authored conflicts, and two supplied graph-candidate proof views.
// It does not build a compiler Program or reproduce a real filesystem race.
//
// @evidence contracts/testing.md#behavioral-verification The native directory case preserves independent file/directory predicates. Seven authored observation pairs select their literal change failures, three authored cross-predicate conflicts select predicate-conflict, and supplied graph inputs report the observed candidate failure while retaining the rich speculative proof. Other state pairs and real races are not certified.
// @evidence contracts/testing.md#independent-expectations Each subtest builds its own literal predicate observations and expected proof outcomes.
// @evidence contracts/testing.md#distinguishing-cases The five named subtests cover compatible and conflicting predicate sets and graph-level reporting, so one decision difference fails one subtest.
// @evidence contracts/testing.md#execution-ownership This Go aggregate owns five sequential private cases. One uses an owned native directory and DefaultFS; the others directly merge supplied observations or attach proofs to an authored TransformGraph/Program DTO with no native compiler construction. Actual private operations are called without a consumer or product process, and the private cases are not separately selected declarations.
func TestInputObservationFSPreservesPredicateSemantics(t *testing.T) {
  t.Run("compatible-file-and-directory-predicates", testInputObservationFSKeepsFileAndDirectoryPredicatesIndependent)
  t.Run("every-repeated-predicate-change", testInputObservationFSRejectsEveryRepeatedPredicateChange)
  t.Run("impossible-predicate-sets", testInputObservationFSRejectsImpossiblePredicateSets)
  t.Run("observed-candidate-failure", testTransformGraphReportsObservedCandidateFailure)
  t.Run("rich-speculative-proof", testTransformGraphKeepsRichSpeculativeProof)
}

func testInputObservationFSKeepsFileAndDirectoryPredicatesIndependent(t *testing.T) {
  root := t.TempDir()
  directory := filepath.Join(root, "punycode.js")
  if err := os.Mkdir(directory, 0o755); err != nil {
    t.Fatal(err)
  }
  observed := newInputObservationFS(DefaultFS())
  if observed.FileExists(directory) {
    t.Fatal("directory unexpectedly satisfied FileExists")
  }
  if !observed.DirectoryExists(directory) {
    t.Fatal("directory did not satisfy DirectoryExists")
  }

  proof, failure := observed.predicateProof(directory)
  if failure != "" {
    t.Fatalf("compatible predicates failed proof: %q", failure)
  }
  if proof.FileExists == nil || *proof.FileExists {
    t.Fatalf("FileExists proof = %#v, want false", proof.FileExists)
  }
  if proof.DirectoryExists == nil || !*proof.DirectoryExists {
    t.Fatalf("DirectoryExists proof = %#v, want true", proof.DirectoryExists)
  }
  if proof.Realpath == nil || !proof.Realpath.OK || !filepath.IsAbs(proof.Realpath.Path) {
    t.Fatalf("directory realpath proof = %#v, want absolute success", proof.Realpath)
  }
  hash, realpath, legacyFailure := observed.proof(directory)
  if legacyFailure != "" || hash == nil || *hash != observedDirectoryDigest || realpath == nil {
    t.Fatalf("legacy directory projection = %v, %v, failure %q", hash, realpath, legacyFailure)
  }
}

func testInputObservationFSRejectsEveryRepeatedPredicateChange(t *testing.T) {
  root := t.TempDir()
  cases := []struct {
    name     string
    first    TransformInputObservation
    second   TransformInputObservation
    expected inputProofFailure
  }{
    {
      name: "accessible-entries",
      first: TransformInputObservation{
        AccessibleEntries: &TransformInputEntriesObservation{Directories: []string{"alpha"}, Files: []string{}},
      },
      second: TransformInputObservation{
        AccessibleEntries: &TransformInputEntriesObservation{Directories: []string{"alpha", "beta"}, Files: []string{}},
      },
      expected: inputProofAccessibleEntriesChanged,
    },
    {
      name:     "directory-exists",
      first:    TransformInputObservation{DirectoryExists: boolPointer(false)},
      second:   TransformInputObservation{DirectoryExists: boolPointer(true)},
      expected: inputProofDirectoryExistsChanged,
    },
    {
      name:     "file-exists",
      first:    TransformInputObservation{FileExists: boolPointer(false)},
      second:   TransformInputObservation{FileExists: boolPointer(true)},
      expected: inputProofFileExistsChanged,
    },
    {
      name:     "read-availability",
      first:    TransformInputObservation{ReadFile: &TransformInputReadObservation{OK: false}},
      second:   TransformInputObservation{ReadFile: &TransformInputReadObservation{OK: true, Hash: "a"}},
      expected: inputProofContentChanged,
    },
    {
      name:     "read-content",
      first:    TransformInputObservation{ReadFile: &TransformInputReadObservation{OK: true, Hash: "a"}},
      second:   TransformInputObservation{ReadFile: &TransformInputReadObservation{OK: true, Hash: "b"}},
      expected: inputProofContentChanged,
    },
    {
      name:     "realpath",
      first:    TransformInputObservation{Realpath: &TransformInputRealpathObservation{OK: false}},
      second:   TransformInputObservation{Realpath: &TransformInputRealpathObservation{OK: true, Path: filepath.Join(root, "target")}},
      expected: inputProofRealpathChanged,
    },
    {
      name:     "stat",
      first:    TransformInputObservation{Stat: stringPointer("missing")},
      second:   TransformInputObservation{Stat: stringPointer("file")},
      expected: inputProofStatChanged,
    },
  }
  for _, entry := range cases {
    t.Run(entry.name, func(t *testing.T) {
      observed := newInputObservationFS(DefaultFS())
      key := observed.observationKey(filepath.Join(root, entry.name))
      observed.mergeObservation(key, observedInput{proof: entry.first})
      observed.mergeObservation(key, observedInput{proof: entry.second})
      if failure := observed.observations[key].failure; failure != entry.expected {
        t.Fatalf("failure = %q, want %q", failure, entry.expected)
      }
    })
  }
}

func testInputObservationFSRejectsImpossiblePredicateSets(t *testing.T) {
  root := t.TempDir()
  cases := []struct {
    name   string
    first  TransformInputObservation
    second TransformInputObservation
  }{
    {
      name:   "file-and-directory",
      first:  TransformInputObservation{FileExists: boolPointer(true)},
      second: TransformInputObservation{DirectoryExists: boolPointer(true)},
    },
    {
      name:   "missing-file-with-readable-content",
      first:  TransformInputObservation{FileExists: boolPointer(false)},
      second: TransformInputObservation{ReadFile: &TransformInputReadObservation{OK: true, Hash: "a"}},
    },
    {
      name: "entries-from-a-missing-directory",
      first: TransformInputObservation{AccessibleEntries: &TransformInputEntriesObservation{
        Directories: []string{"package"},
        Files:       []string{},
      }},
      second: TransformInputObservation{DirectoryExists: boolPointer(false)},
    },
  }
  for _, entry := range cases {
    t.Run(entry.name, func(t *testing.T) {
      observed := newInputObservationFS(DefaultFS())
      key := observed.observationKey(filepath.Join(root, entry.name))
      observed.mergeObservation(key, observedInput{proof: entry.first})
      observed.mergeObservation(key, observedInput{proof: entry.second})
      if failure := observed.observations[key].failure; failure != inputProofPredicateConflict {
        t.Fatalf("failure = %q, want %q", failure, inputProofPredicateConflict)
      }
    })
  }
}

func testTransformGraphReportsObservedCandidateFailure(t *testing.T) {
  root := t.TempDir()
  raced := filepath.ToSlash(filepath.Join("node_modules", "pkg.ts"))
  unobserved := filepath.ToSlash(filepath.Join("node_modules", "pkg.tsx"))
  observed := newInputObservationFS(DefaultFS())
  key := observed.observationKey(filepath.Join(root, filepath.FromSlash(raced)))
  observed.mergeObservation(key, observedInput{
    proof: TransformInputObservation{FileExists: boolPointer(false)},
  })
  observed.mergeObservation(key, observedInput{
    proof: TransformInputObservation{FileExists: boolPointer(true)},
  })
  graph := TransformGraph{
    Candidates: map[string][]string{"src/main.ts": {raced, unobserved}},
    Configs:    []string{},
    Edges:      map[string][]string{"src/main.ts": {}},
    Globals:    []string{},
  }
  graph.attachInputProof(&Program{inputObserver: observed}, root)
  if failure := graph.InputProofFailures[raced]; failure != string(inputProofFileExistsChanged) {
    t.Fatalf("observed candidate failure = %q, want %q", failure, inputProofFileExistsChanged)
  }
  if failure, found := graph.InputProofFailures[unobserved]; found {
    t.Fatalf("wholly unobserved candidate failure = %q", failure)
  }
}

func testTransformGraphKeepsRichSpeculativeProof(t *testing.T) {
  root := t.TempDir()
  candidate := filepath.ToSlash(filepath.Join("node_modules", "pkg.ts"))
  observed := newInputObservationFS(DefaultFS())
  key := observed.observationKey(filepath.Join(root, filepath.FromSlash(candidate)))
  observed.mergeObservation(key, observedInput{
    proof: TransformInputObservation{FileExists: boolPointer(true)},
  })
  graph := TransformGraph{
    Candidates: map[string][]string{"src/main.ts": {candidate}},
    Configs:    []string{},
    Edges:      map[string][]string{"src/main.ts": {}},
    Globals:    []string{},
  }
  graph.attachInputProof(&Program{inputObserver: observed}, root)
  proof, found := graph.InputObservations[candidate]
  if !found || proof.FileExists == nil || !*proof.FileExists {
    t.Fatalf("rich speculative proof = %#v, %v; want FileExists true", proof, found)
  }
  if failure, found := graph.InputProofFailures[candidate]; found {
    t.Fatalf("legacy projection failure superseded rich proof: %q", failure)
  }
}

func stringPointer(value string) *string {
  return &value
}

//
// @evidence contracts/testing.md#behavioral-verification The proof hash covers the BOM-stripped text the compiler decoded rather than the raw bytes on disk.
// @evidence contracts/testing.md#independent-expectations The expected digest is computed from the literal decoded text, and the file is written with an explicit UTF-8 BOM.
// @evidence contracts/testing.md#distinguishing-cases A BOM-prefixed file distinguishes hashing the decoded text from hashing the raw bytes.
// @evidence contracts/testing.md#execution-ownership TestInputObservationFSHashesCompilerDecodedText is a Go unit test inside the driver package: it calls the unexported operation in-process with literal inputs or a temporary directory, installing no consumer and starting no product process.
func TestInputObservationFSHashesCompilerDecodedText(t *testing.T) {
  root := t.TempDir()
  file := filepath.Join(root, "bom.ts")
  text := "export const value = true;\n"
  raw := append([]byte{0xef, 0xbb, 0xbf}, []byte(text)...)
  if err := os.WriteFile(file, raw, 0o644); err != nil {
    t.Fatal(err)
  }
  observed := newInputObservationFS(DefaultFS())
  contents, ok := observed.ReadFile(file)
  if !ok || contents != text {
    t.Fatalf("compiler read = %q, %v; want decoded text", contents, ok)
  }
  digest := sha256.Sum256([]byte(text))
  hash, _, failure := observed.proof(file)
  if failure != "" || hash == nil || *hash != hex.EncodeToString(digest[:]) {
    t.Fatalf("decoded proof hash = %v, failure %q", hash, failure)
  }
}

//
// @evidence contracts/testing.md#behavioral-verification A probe through a lexical directory alias joins the physical read of the selected file so the proof reports the physical path.
// @evidence contracts/testing.md#independent-expectations The expected physical path and bytes come from the test's own directory layout and literal file contents.
// @evidence contracts/testing.md#distinguishing-cases The alias spelling and the physical spelling differ, so a proof keyed on the lexical path alone fails.
// @evidence contracts/testing.md#execution-ownership This Go unit owns a native directory-link fixture and calls the actual observation/proof adapter. Windows junction creation uses the existing windowsjunction helper's owned cmd child and opt-in trace; it does not launch Node or a product host. POSIX permission-denied symlink setup is explicitly skipped, while other setup failures fail; no successful alias coverage is certified on a skipped host.
func TestInputObservationFSJoinsSelectedAliasProbeToPhysicalRead(t *testing.T) {
  root := t.TempDir()
  target := filepath.Join(root, "target")
  if err := os.Mkdir(target, 0o755); err != nil {
    t.Fatal(err)
  }
  physical := filepath.Join(target, "value.js")
  contents := "export const value = true;\n"
  if err := os.WriteFile(physical, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
  alias := filepath.Join(root, "alias")
  if runtime.GOOS == "windows" {
    if err := windowsjunction.Create(alias, target); err != nil {
      t.Fatalf("create owned directory junction: %v", err)
    }
  } else if err := os.Symlink(target, alias); err != nil {
    if errors.Is(err, os.ErrPermission) {
      t.Skipf("host denied permission for the owned directory symlink fixture: %v", err)
    }
    t.Fatalf("create owned directory symlink: %v", err)
  }
  lexical := filepath.Join(alias, "value.js")
  observed := newInputObservationFS(DefaultFS())
  if !observed.FileExists(lexical) {
    t.Fatal("selected lexical alias was not found")
  }
  if _, ok := observed.ReadFile(physical); !ok {
    t.Fatal("selected physical source was not read")
  }

  digest := sha256.Sum256([]byte(contents))
  hash, realpath, failure := observed.proof(lexical)
  if failure != "" || hash == nil || *hash != hex.EncodeToString(digest[:]) {
    t.Fatalf("alias proof hash = %v, failure %q", hash, failure)
  }
  if realpath == nil {
    t.Fatalf("alias proof realpath = nil, want %q", physical)
  }
  actualInfo, err := os.Stat(*realpath)
  if err != nil {
    t.Fatal(err)
  }
  expectedInfo, err := os.Stat(physical)
  if err != nil {
    t.Fatal(err)
  }
  if !os.SameFile(actualInfo, expectedInfo) {
    t.Fatalf("alias proof realpath = %q, want %q", *realpath, physical)
  }
}
