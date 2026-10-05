package main

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestRunDeclaresTheCapabilityItsOutputCarries pins this producer's two
// capability declarations and checks representative output for each: tag text
// and at least one non-empty checker digest. An untagged project emits no docTags
// key. Digest contents and complete source coverage are not checked here.
//
// This producer assembles its own capability list, separately from the shipped
// `ttscgraph dump`. The claim matters because the two states a consumer must
// distinguish — "this declaration cites nothing" and "this producer never
// looked" — are the same absent field, so a dump that carries tags and forgets to
// say so is read as a repository where nothing cites anything.
//
// The fixed expected set rejects added or missing capability declarations; it
// does not derive expectations from the producer's assembled list.
//
//  1. Prepare and encode a project with a tag, capturing stdout.
//  2. Assert the fixed two-capability set, literal tag text and key, and at least
//     one non-empty checker digest.
//  3. Encode a project with no tag and assert the field appears nowhere,
//     while both claims still do.
//
// @evidence contracts/testing.md#behavioral-verification Exercises actual preparation and encoding with empty ignore membership, checking the fixed two-capability declarations, representative tag and checker-digest output, and absence of the docTags key for an untagged project. It does not exercise Git-filtered command execution or certify all source digests.
// @evidence contracts/testing.md#independent-expectations The fixed expected set chooses graph.CapabilityDocTags and graph.CapabilitySourceDigests from the supported wire contract, independently of the producer's assembled list. Literal tag text, docTags key presence or absence, and at least one non-empty checker digest provide separate output expectations. A wrong non-empty digest or omitted additional source can remain indistinguishable here; neither digest contents nor complete coverage is asserted.
// @evidence contracts/testing.md#distinguishing-cases Tagged and untagged projects both require the exact two-capability set and at least one non-empty checker digest. Only the tagged project requires the literal documentation tag and docTags key; the untagged project rejects that key anywhere in the dump.
// @evidence contracts/testing.md#execution-ownership TestRunDeclaresTheCapabilityItsOutputCarries is a Go source-unit entry. runSourceProjection exercises the real sibling prepareCommand and encode operations with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestRunDeclaresTheCapabilityItsOutputCarries(t *testing.T) {
  tagged := runGraphdump(t, `/** @evidence docs/a.md#x Cited. */
export function subject(): void {}
`)
  untagged := runGraphdump(t, `/** Ordinary documentation. */
export function subject(): void {}
`)

  declared := []string{graph.CapabilityDocTags, graph.CapabilitySourceDigests}
  slices.Sort(declared)
  for name, raw := range map[string]string{"tagged": tagged, "untagged": untagged} {
    var parsed struct {
      Provenance struct {
        Capabilities []string `json:"capabilities"`
        Sources      []struct {
          File          string `json:"file"`
          CheckerDigest string `json:"checkerDigest"`
        } `json:"sources"`
      } `json:"provenance"`
    }
    if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
      t.Fatalf("%s dump is not JSON: %v", name, err)
    }
    got := slices.Clone(parsed.Provenance.Capabilities)
    slices.Sort(got)
    if !slices.Equal(got, declared) {
      t.Fatalf("%s dump declares %v, want %v; an absent claim means the producer "+
        "never looked, so a tagged declaration reads as citing nothing and a "+
        "digested source reads as unread",
        name, got, declared)
    }
    // The sourceDigests claim, backed the same way the docTags claim is: a
    // declared capability whose output carries nothing is the tautology this
    // test exists to avoid.
    digested := 0
    for _, source := range parsed.Provenance.Sources {
      if source.CheckerDigest != "" {
        digested++
      }
    }
    if digested == 0 {
      t.Fatalf("%s dump declares %q over %d sources, none of which carries a checker digest",
        name, graph.CapabilitySourceDigests, len(parsed.Provenance.Sources))
    }
  }

  if !strings.Contains(tagged, `"docs/a.md#x Cited."`) {
    t.Fatalf("the tagged dump carried no tag text")
  }
  // Read the raw document rather than a decoded slice: an absent field and an
  // empty one decode identically, and absent is what the wire contract says. The
  // key is matched with its colon, because the capability shares the name and
  // rides the same document as a bare string.
  if strings.Contains(untagged, `"docTags":`) {
    t.Fatalf("the untagged dump carried a docTags field; it must be absent")
  }
  if !strings.Contains(tagged, `"docTags":`) {
    t.Fatalf("the tagged dump carried no docTags field, so the check above proves nothing")
  }
}

// runGraphdump runs the command over a one-file project and returns its stdout.
//
// It consumes this command's actual preparation and encoder with explicit empty
// ignore membership. The package streams preserve its producer claim without
// routing portable capability assertions through a Git child process.
func runGraphdump(t *testing.T, source string) string {
  t.Helper()
  root := t.TempDir()
  writeGraphdumpFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeGraphdumpFile(t, filepath.Join(root, "src", "main.ts"), source)

  var out, errOut bytes.Buffer
  restoreStdout, restoreStderr := stdout, stderr
  stdout, stderr = &out, &errOut
  defer func() { stdout, stderr = restoreStdout, restoreStderr }()

  if code := runSourceProjection([]string{"--cwd", root, "--tsconfig", "tsconfig.json"}); code != 0 {
    t.Fatalf("graphdump exited %d: %s", code, errOut.String())
  }
  return out.String()
}

func writeGraphdumpFile(t *testing.T, path, content string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
}

// runSourceProjection consumes the same real command preparation and encoder
// over the fixture's explicit empty ignore membership, without acquiring Git.
func runSourceProjection(args []string) int {
  prepared, code := prepareCommand(args)
  if prepared == nil {
    return code
  }
  defer func() { _ = prepared.program.Close() }()
  return prepared.encode(nil)
}
