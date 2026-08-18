package graph

import (
  "encoding/json"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDocTagsAreClaimedBeforeTheyAreRead verifies that a dump carrying
// documentation tags declares the capability that says so, and that a project
// with no tags is unchanged apart from that claim.
//
// The claim is the whole contract. A consumer cannot tell "this declaration
// cites nothing" from "this producer never looked" by inspecting the field —
// both are an absent array — so a graph built before the field existed would be
// read as a repository where nothing cites anything, which is a confident wrong
// answer to the one question the field exists for. The claim is also what makes
// the untagged case safe to ship: nothing else about that dump may move.
//
//  1. Marshal a dump for a project whose one declaration carries a tag.
//  2. Marshal one for a project with the same declaration and no tag.
//  3. Assert the capability is declared in both, that only the first carries a
//     tag, and that the second's nodes and edges are otherwise identical.
func TestDocTagsAreClaimedBeforeTheyAreRead(t *testing.T) {
  tagged := dumpDocTagFixture(t, `/** @evidence docs/a.md#x Cited. */
export function subject(): void {}
`)
  untagged := dumpDocTagFixture(t, `/** Ordinary documentation. */
export function subject(): void {}
`)

  for name, parsed := range map[string]dumpDocTagProbe{"tagged": tagged, "untagged": untagged} {
    if !slices.Contains(parsed.Provenance.Capabilities, CapabilityDocTags) {
      t.Fatalf("%s dump declares %v, missing %q — an absent field would then be unreadable",
        name, parsed.Provenance.Capabilities, CapabilityDocTags)
    }
  }

  if got := docTagTexts(tagged); len(got) != 1 || got[0] != "docs/a.md#x Cited." {
    t.Fatalf("tagged dump carried %v", got)
  }
  if got := docTagTexts(untagged); len(got) != 0 {
    t.Fatalf("untagged dump carried %v; the field must be absent, not empty", got)
  }

  // Everything else about the untagged dump is what it was: the feature costs a
  // project that uses no convention exactly nothing on the wire.
  if len(tagged.Nodes) != len(untagged.Nodes) || len(tagged.Edges) != len(untagged.Edges) {
    t.Fatalf("node/edge counts diverged: tagged %d/%d, untagged %d/%d",
      len(tagged.Nodes), len(tagged.Edges), len(untagged.Nodes), len(untagged.Edges))
  }
}

// dumpDocTagProbe is the slice of the wire contract this test reads.
type dumpDocTagProbe struct {
  Provenance struct {
    Capabilities []string `json:"capabilities"`
  } `json:"provenance"`
  Nodes []struct {
    ID      string       `json:"id"`
    DocTags []DumpDocTag `json:"docTags"`
  } `json:"nodes"`
  Edges []struct {
    Kind string `json:"kind"`
  } `json:"edges"`
}

func docTagTexts(parsed dumpDocTagProbe) []string {
  out := []string{}
  for _, node := range parsed.Nodes {
    for _, tag := range node.DocTags {
      out = append(out, tag.Text)
    }
  }
  return out
}

// dumpDocTagFixture builds and marshals a one-file project, returning the parsed
// wire document.
func dumpDocTagFixture(t *testing.T, source string) dumpDocTagProbe {
  t.Helper()
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), source)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  g := Build(prog)
  data, err := MarshalDump(g, root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{
    Provenance: NewProvenance(
      Producer{Tool: "test", Typescript: TypescriptVersion()},
      []string{CapabilityDocTags},
      nil,
      nil,
      SourceTexts(prog),
      nil,
    ),
  }, false)
  if err != nil {
    t.Fatal(err)
  }
  var parsed dumpDocTagProbe
  if err := json.Unmarshal(data, &parsed); err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(string(data), "\"nodes\"") {
    t.Fatalf("dump carried no nodes section")
  }
  return parsed
}
