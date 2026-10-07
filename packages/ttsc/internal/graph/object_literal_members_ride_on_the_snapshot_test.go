package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestObjectLiteralMembersRideOnTheSnapshot checks selected direct object-member
// names, kinds, spans, and dump outlines from one authored Program snapshot.
// Comment braces, static computed names, accessors, spread, dynamic keys, and
// nested bodies distinguish the expected twenty records. The source file is not
// changed after loading, so this does not independently reject live-file reads
// or authenticate exclusive AST acquisition, and no details server is invoked.
//
//  1. Load a wrapped object literal containing the selected static member shapes,
//     comment braces, a dynamic key, a spread, and a nested object.
//  2. Assert the variable node records only its direct statically named members
//     in declaration order, with method/property kinds independent of trivia.
//  3. Dump the graph and assert member lines/signatures come from the snapshot,
//     while spread and nested members are not fabricated as outer identity.
//
// @evidence contracts/testing.md#behavioral-verification Checks twenty ordered graph member names/kinds with positive spans, then selected direct dump lines, outline signatures, forbidden body markers, and a 160-rune truncation. No JSON serialization, changed-disk snapshot distinction, details-server execution, or exclusive acquisition algorithm is authenticated.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over one wrapped object literal: the node must list exactly the 20 direct static members in declaration order with the given names and variable/method kinds (shorthand, string-keyed, empty-string and numeric keys, accessors counted once each), each with a span, and not the dynamic key, the spread's fromSpread or the nested inner; the dump must give the first member real at line 7 with signature real: 1 (comment braces not counted), the last afterSpread: true, head-only signatures for method, arrow, function, class, array and object members, none of the eight marker body strings, and a 160-rune bounded signature ending in ... for the long member.
// @evidence contracts/testing.md#distinguishing-cases The authored getter and setter each produce a value record; literal computed names survive while the dynamic key, spread contents, and nested inner do not become outer members. The first line/signature, last signature, seven body-outline literals, eight forbidden markers, and long-signature rune bound are independent expectations. Other dump member names/kinds are not exhaustively compared to the graph list.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and NewDump execute in this process with SourceTexts from that Program; graph node selection shares the nodeID encoder while the dump node ID is a literal. No product CLI, consumer installation, emitted JavaScript, or details server runs.
func TestObjectLiteralMembersRideOnTheSnapshot(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  source := `const shorthand = 1;
const dynamic = Math.random() > 0.5 ? "a" : "b";
const spread = { fromSpread: true };

export const shape = (({
  /* { */
  real: 1,
  close: "}",
  text: "{",
  template: ` + "`{${shorthand}}`" + `,
  long: "` + strings.Repeat("x", 200) + `",
  shorthand,
  ["static-key"]: 2,
  [""]: 4,
  [1]: true,
  [dynamic]: 3,
  method() {
    return shorthand;
  },
  get value() {
    return shorthand;
  },
  set value(input: number) {
    void "SETTER_BODY_MUST_NOT_APPEAR";
  },
  oneLineMethod() { return "METHOD_BODY_MUST_NOT_APPEAR"; },
  get oneLineValue() { return "ACCESSOR_BODY_MUST_NOT_APPEAR"; },
  run: () => "ARROW_BODY_MUST_NOT_APPEAR",
  classic: function () { return "FUNCTION_BODY_MUST_NOT_APPEAR"; },
  klass: class { method() { return "CLASS_BODY_MUST_NOT_APPEAR"; } },
  list: ["ARRAY_CONTENT_MUST_NOT_APPEAR"],
  nested: {
    inner: "NESTED_BODY_MUST_NOT_APPEAR",
  },
  ...spread,
  /* } */
  afterSpread: true,
}) as const) satisfies Record<PropertyKey, unknown>;
`
  writeFile(t, filepath.Join(root, "src", "main.ts"), source)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  graph := Build(prog)
  path := sourceFile(t, prog, "main.ts").FileName()
  node := graph.Nodes[nodeID(path, "shape", NodeVariable)]
  if node == nil {
    t.Fatalf("missing shape variable; nodes: %v", nodeIDSet(graph))
  }

  want := []ObjectMember{
    {Name: "real", Kind: NodeVariable},
    {Name: "close", Kind: NodeVariable},
    {Name: "text", Kind: NodeVariable},
    {Name: "template", Kind: NodeVariable},
    {Name: "long", Kind: NodeVariable},
    {Name: "shorthand", Kind: NodeVariable},
    {Name: "static-key", Kind: NodeVariable},
    {Name: "", Kind: NodeVariable},
    {Name: "1", Kind: NodeVariable},
    {Name: "method", Kind: NodeMethod},
    {Name: "value", Kind: NodeMethod},
    {Name: "value", Kind: NodeMethod},
    {Name: "oneLineMethod", Kind: NodeMethod},
    {Name: "oneLineValue", Kind: NodeMethod},
    {Name: "run", Kind: NodeVariable},
    {Name: "classic", Kind: NodeVariable},
    {Name: "klass", Kind: NodeVariable},
    {Name: "list", Kind: NodeVariable},
    {Name: "nested", Kind: NodeVariable},
    {Name: "afterSpread", Kind: NodeVariable},
  }
  if len(node.ObjectMembers) != len(want) {
    t.Fatalf("object members = %v, want %v", node.ObjectMembers, want)
  }
  for i, expected := range want {
    actual := node.ObjectMembers[i]
    if actual.Name != expected.Name || actual.Kind != expected.Kind {
      t.Fatalf("object member %d = %+v, want %+v", i, actual, expected)
    }
    if actual.Pos < 0 || actual.End <= actual.Pos {
      t.Fatalf("object member %q has no snapshot span: %+v", actual.Name, actual)
    }
  }

  dump, err := NewDump(graph, root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{})
  if err != nil {
    t.Fatal(err)
  }
  var dumped *DumpNode
  for i := range dump.Nodes {
    if dump.Nodes[i].ID == "src/main.ts#shape:variable" {
      dumped = &dump.Nodes[i]
      break
    }
  }
  if dumped == nil {
    t.Fatalf("dump omitted shape: %+v", dump.Nodes)
  }
  if len(dumped.ObjectMembers) != len(want) {
    t.Fatalf("dumped object members = %+v, want %d", dumped.ObjectMembers, len(want))
  }
  for _, member := range dumped.ObjectMembers {
    if member.Line <= 0 || member.Signature == "" {
      t.Fatalf("member lacks snapshot line/signature: %+v", member)
    }
    if member.Name == "inner" || member.Name == "fromSpread" || member.Name == "dynamic" {
      t.Fatalf("non-direct or non-static member was fabricated: %+v", member)
    }
  }
  if got := dumped.ObjectMembers[0]; got.Name != "real" || got.Line != 7 || got.Signature != "real: 1" {
    t.Fatalf("comment brace corrupted the first real member: %+v", got)
  }
  if got := dumped.ObjectMembers[len(dumped.ObjectMembers)-1]; got.Name != "afterSpread" || got.Signature != "afterSpread: true" {
    t.Fatalf("spread/comment boundary corrupted the following member: %+v", got)
  }
  signatures := map[string]string{}
  for _, member := range dumped.ObjectMembers {
    signatures[member.Name] = member.Signature
  }
  expectedSignatures := map[string]string{
    "oneLineMethod": "oneLineMethod() {",
    "oneLineValue":  "get oneLineValue() {",
    "run":           "run: () =>",
    "classic":       "classic: function () {",
    "klass":         "klass: class",
    "list":          "list: [",
    "nested":        "nested: {",
  }
  for name, expected := range expectedSignatures {
    if actual := signatures[name]; actual != expected {
      t.Fatalf("signature for %q = %q, want %q", name, actual, expected)
    }
  }
  for _, forbidden := range []string{
    "METHOD_BODY_MUST_NOT_APPEAR",
    "ACCESSOR_BODY_MUST_NOT_APPEAR",
    "SETTER_BODY_MUST_NOT_APPEAR",
    "ARROW_BODY_MUST_NOT_APPEAR",
    "FUNCTION_BODY_MUST_NOT_APPEAR",
    "CLASS_BODY_MUST_NOT_APPEAR",
    "ARRAY_CONTENT_MUST_NOT_APPEAR",
    "NESTED_BODY_MUST_NOT_APPEAR",
  } {
    for _, member := range dumped.ObjectMembers {
      if strings.Contains(member.Signature, forbidden) {
        t.Fatalf("signature inlined source body %q: %+v", forbidden, member)
      }
    }
  }
  if signature := signatures["long"]; len([]rune(signature)) != 160 || !strings.HasSuffix(signature, "...") {
    t.Fatalf("long member signature is not bounded to 160 runes: %q", signature)
  }
}
