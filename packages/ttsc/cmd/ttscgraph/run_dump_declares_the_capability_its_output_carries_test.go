package main

import (
  "bytes"
  "encoding/json"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestRunDumpDeclaresTheCapabilityItsOutputCarries verifies that the shipped
// `dump` command's own output declares the documentation-tag capability, and
// that a project carrying no tag emits the field nowhere.
//
// The claim is the contract, and it can only be tested where it is made. A test
// that hands a capability list to the marshaller and reads it back proves the
// slice was copied; it leaves the production list free to lose the member with
// nothing failing. That matters because the two states a consumer must
// distinguish — "this declaration cites nothing" and "this producer never
// looked" — are the same absent field, so a dump that carries tags and forgets
// to say so is read as a repository where nothing cites anything.
//
//  1. Run the `dump` subcommand over a project with a tag, capturing stdout.
//  2. Assert the capability is declared and the tag is present in the output.
//  3. Run it over a project with no tag and assert the field appears nowhere,
//     while the claim still does.
//
// @evidence contracts/testing.md#behavioral-verification Verifies that the maintained `dump` command's own output declares the documentation-tag capability, and that a project carrying no tag emits the field nowhere.
// @evidence contracts/testing.md#independent-expectations The expectation is the wire contract that the docTags capability is declared whether or not any tag exists and that the docTags key is present only when a tag does; it is checked against the raw stdout text (literal tag string and key), not against a value the dump code computes. Dropping the capability from the command's list, or emitting the field for an untagged project, fails.
// @evidence contracts/testing.md#distinguishing-cases Run the `dump` subcommand over a project with a tag, capturing stdout; Assert the capability is declared and the tag is present in the output; Run it over a project with no tag and assert the field appears nowhere, while the claim still does.
// @evidence contracts/testing.md#execution-ownership TestRunDumpDeclaresTheCapabilityItsOutputCarries is a Go source-unit entry. runSourceDumpCommand exercises the real prepareDumpCommand grammar and encode operation; it supplies the dispatch word and does not execute the top-level dispatcher. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestRunDumpDeclaresTheCapabilityItsOutputCarries(t *testing.T) {
  tagged := runDumpForCapabilityProbe(t, `/** @evidence docs/a.md#x Cited. */
export function subject(): void {}
`)
  untagged := runDumpForCapabilityProbe(t, `/** Ordinary documentation. */
export function subject(): void {}
`)

  for name, raw := range map[string]string{"tagged": tagged, "untagged": untagged} {
    var parsed struct {
      Provenance struct {
        Capabilities []string `json:"capabilities"`
      } `json:"provenance"`
    }
    if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
      t.Fatalf("%s dump is not JSON: %v", name, err)
    }
    if !slices.Contains(parsed.Provenance.Capabilities, graph.CapabilityDocTags) {
      t.Fatalf("%s dump declares %v, missing %q; a consumer would then read a "+
        "tagged declaration as citing nothing",
        name, parsed.Provenance.Capabilities, graph.CapabilityDocTags)
    }
  }

  if !strings.Contains(tagged, `"docs/a.md#x Cited."`) {
    t.Fatalf("the tagged dump carried no tag text")
  }
  // Read the raw document rather than a decoded slice: an absent field and an
  // empty one decode identically, and absent is what the wire contract says.
  // The key is matched with its colon, because the capability shares the name
  // and rides the same document as a bare string.
  if strings.Contains(untagged, `"docTags":`) {
    t.Fatalf("the untagged dump carried a docTags field; it must be absent")
  }
  if !strings.Contains(tagged, `"docTags":`) {
    t.Fatalf("the tagged dump carried no docTags field, so the check above proves nothing")
  }
}

// runDumpForCapabilityProbe runs the dump subcommand over a one-file project and
// returns its stdout.
func runDumpForCapabilityProbe(t *testing.T, source string) string {
  t.Helper()
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
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
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), source)

  var out, errOut bytes.Buffer
  restoreStdout, restoreStderr := stdout, stderr
  stdout, stderr = &out, &errOut
  defer func() { stdout, stderr = restoreStdout, restoreStderr }()

  if code := runSourceDumpCommand([]string{"dump", "--cwd", root, "--tsconfig", "tsconfig.json"}); code != 0 {
    t.Fatalf("dump exited %d: %s", code, errOut.String())
  }
  return out.String()
}
