package graph

import (
  "encoding/json"
  "path/filepath"
  "reflect"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDocTagsAreClaimedBeforeTheyAreRead verifies that the projection carries a
// tag onto the wire and that a project with no tag is unchanged beside it.
//
// The capability the shipped commands declare is asserted where it is made, in
// `cmd/ttscgraph`: a test that hands a capability list to the marshaller and
// reads it back proves only that the slice was copied, and would leave the
// production list free to lose the member with nothing failing. What this one
// owns is the other half — that a tag reaches the document, and that a project
// using no convention pays nothing for the feature.
//
// 1. Load identical tagged and untagged declarations with the literal docs/a.md#x citation.
// 2. Build and serialize both graphs with their declared doc-tag capability.
// 3. Require one Cited doc tag, none on the untagged declaration, and identical structural dumps after removing doc tags.
//
// @evidence contracts/testing.md#behavioral-verification Build and MarshalDump carry the tag of a declaration documented with an unrecognized @evidence tag onto the wire as one doc tag and carry none for an otherwise identical untagged declaration, and the two documents are equal once the tags are removed. The docTags capability is passed to the provenance but its presence is not asserted here; the commands' own tests assert it.
// @evidence contracts/testing.md#independent-expectations The literal docs/a.md#x annotation supplies the expected citation text docs/a.md#x Cited., and the control is separately built tagged and untagged dumps that must be structurally equal after the tags are stripped. The control does not validate every structural graph fact.
// @evidence contracts/testing.md#distinguishing-cases A tagged declaration and otherwise identical untagged declaration contrast one retained citation, no untagged citation and structural equality after omitting doc tags.
// @evidence contracts/testing.md#execution-ownership This source-unit entry loads actual authored compiler inputs and directly calls Build and MarshalDump in the Go test process; it installs no consumer and starts no product host.
func TestDocTagsAreClaimedBeforeTheyAreRead(t *testing.T) {
  tagged := dumpDocTagFixture(t, `/** @evidence docs/a.md#x Cited. */
export function subject(): void {}
`)
  untagged := dumpDocTagFixture(t, `/** Ordinary documentation. */
export function subject(): void {}
`)

  if got := docTagTexts(tagged); len(got) != 1 || got[0] != "docs/a.md#x Cited." {
    t.Fatalf("tagged dump carried %v", got)
  }
  if got := docTagTexts(untagged); len(got) != 0 {
    t.Fatalf("untagged dump carried %v", got)
  }

  // The rest of the untagged document is what it was: the feature costs a
  // project using no convention exactly nothing. Compared structurally rather
  // than by count, because equal counts survive a changed id, name, or span.
  if !reflect.DeepEqual(strippedDocTags(tagged), untagged) {
    t.Fatalf("the two documents differ beyond the tag: tagged %+v, untagged %+v",
      strippedDocTags(tagged), untagged)
  }
}

// dumpDocTagProbe is the slice of the wire contract this test reads.
type dumpDocTagProbe struct {
  Provenance struct {
    Capabilities []string `json:"capabilities"`
  } `json:"provenance"`
  Nodes []dumpDocTagNode `json:"nodes"`
  Edges []dumpDocTagEdge `json:"edges"`
}

type dumpDocTagNode struct {
  ID        string       `json:"id"`
  Kind      string       `json:"kind"`
  Name      string       `json:"name"`
  Signature string       `json:"signature"`
  Evidence  any          `json:"evidence"`
  DocTags   []DumpDocTag `json:"docTags"`
}

type dumpDocTagEdge struct {
  From     string `json:"from"`
  To       string `json:"to"`
  Kind     string `json:"kind"`
  Evidence any    `json:"evidence"`
}

// strippedDocTags is the tagged document with its tags removed, which is what
// the untagged one must equal.
func strippedDocTags(parsed dumpDocTagProbe) dumpDocTagProbe {
  out := parsed
  out.Nodes = append([]dumpDocTagNode(nil), parsed.Nodes...)
  for index := range out.Nodes {
    out.Nodes[index].DocTags = nil
  }
  return out
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
