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

// TestRunDeclaresTheCapabilityItsOutputCarries verifies that every capability
// this command declares is paired with the output that backs it, and that a
// project carrying no documentation tag emits that field nowhere.
//
// The claim is a separate literal from the shipped `ttscgraph dump`'s, so the
// test that guards that one guards nothing here: deleting graph.CapabilityDocTags
// from this command's list used to break nothing at all, in a package that had
// never had a test file. The claim matters because the two states a consumer must
// distinguish — "this declaration cites nothing" and "this producer never
// looked" — are the same absent field, so a dump that carries tags and forgets to
// say so is read as a repository where nothing cites anything.
//
// The declared set is compared whole rather than member by member, so a
// capability added to the list arrives with the evidence for it or fails here.
//
//  1. Run the command over a project with a tag, capturing stdout.
//  2. Assert the declared set is exactly what this command claims, and that each
//     claim is backed: a tag in the output, and a digested source.
//  3. Run it over a project with no tag and assert the field appears nowhere,
//     while both claims still do.
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
// It goes through run(args) and the package streams rather than through os.Args,
// flag.CommandLine, and an os.Stdout pipe. Those seams exist on the shipped
// sibling for this reason, and this command grew them so its own claim could be
// asserted against its own output without patching process globals.
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

  if code := run([]string{"--cwd", root, "--tsconfig", "tsconfig.json"}); code != 0 {
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
