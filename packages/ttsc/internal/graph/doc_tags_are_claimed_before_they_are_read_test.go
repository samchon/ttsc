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
// tag onto the wire and that the selected node/edge projection matches the
// otherwise identical untagged fixture after removing its tag facts.
//
// The capability the shipped commands declare is asserted where it is made, in
// `cmd/ttscgraph`: a test that hands a capability list to the marshaller and
// reads it back proves only that the slice was copied, and would leave the
// production list free to lose the member with nothing failing. What this one
// owns is tag delivery and equality of its parsed probe fields. It measures no
// runtime cost and does not compare source hashes or every wire field.
//
// 1. Load identical tagged and untagged declarations with the literal docs/a.md#x citation.
// 2. Build and serialize both graphs with their declared doc-tag capability.
// 3. Require one Cited doc tag, none on the untagged declaration, and equal parsed probe fields after removing doc tags.
//
// @evidence contracts/testing.md#behavioral-verification Build and MarshalDump deliver one literal doc tag for the tagged declaration and none for its untagged counterpart. After tag removal their parsed probe fields are equal; omitted wire fields and runtime costs are not compared. The docTags capability is supplied by the fixture and not independently asserted here; the command capability case owns that assertion.
// @evidence contracts/testing.md#independent-expectations The authored annotation requires exactly docs/a.md#x Cited. The comparison retains only capabilities, the declared node ID/kind/name/signature/evidence fields, and edge endpoint/kind/evidence fields. Expected equality of those probe fields does not certify the full wire document or independently validate every graph fact.
// @evidence contracts/testing.md#distinguishing-cases A tagged declaration and otherwise identical untagged declaration contrast one retained citation, no untagged citation and equality of the retained probe fields after omitting doc tags.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes two native temporary projects, constructs and closes their driver compiler Programs in-process, and directly calls Build and MarshalDump. A restored empty linked-plugin manifest excludes ambient hooks; no consumer installation or product host command runs.
func TestDocTagsAreClaimedBeforeTheyAreRead(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

  // Compare the retained probe fields rather than counts. Fields omitted by
  // dumpDocTagProbe, including source hashes, are outside this comparison.
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
