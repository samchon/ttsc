package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestObjectMemberSignaturesPreserveLiteralWhitespace checks four authored dump
// signatures: double and single quotes, a regular expression, and a multiline
// template. Exact literals distinguish whitespace collapsing and first-line
// truncation; escaped delimiters, substitutions, and all lexical values are not
// certified by this corpus. The source is unchanged after Program loading.
//
//  1. Compile object members with spaced strings, a regexp, and a template.
//  2. Dump the graph from the Program-owned source snapshot.
//  3. Assert literal whitespace and the complete template delimiter survive.
//
// @evidence contracts/testing.md#behavioral-verification Compares four direct NewDump signatures to independent literal strings, including two interior spaces and the multiline template's newline, indentation, and closing backtick. It does not assert all lexical forms, JSON serialization, or rejection of live-file reads.
// @evidence contracts/testing.md#independent-expectations The expectations are literal source strings: the dumped signatures of the four members must be exactly double: "a  b", single: 'c  d', regexp: /e  f/ and the two-line template literal with its interior newline and spaces and closing backtick, so whitespace owned by a lexical value is not collapsed.
// @evidence contracts/testing.md#distinguishing-cases Compile object members with spaced strings, a regexp, and a template; Dump the graph from the Program-owned source snapshot; Assert literal whitespace and the complete template delimiter survive.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and NewDump use its SourceTexts in this process; the selected dump node ID and expected signatures are authored literals. No consumer installation, product CLI, emitted JavaScript evaluation, or details server runs.
func TestObjectMemberSignaturesPreserveLiteralWhitespace(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  source := `export const shape = {
  double: "a  b",
  single: 'c  d',
  regexp: /e  f/,
  template: ` + "`left\n  right`" + `,
};
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
  dump, err := NewDump(graph, root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{})
  if err != nil {
    t.Fatal(err)
  }
  signatures := map[string]string{}
  for _, node := range dump.Nodes {
    if node.ID != "src/main.ts#shape:variable" {
      continue
    }
    for _, member := range node.ObjectMembers {
      signatures[member.Name] = member.Signature
    }
  }
  expected := map[string]string{
    "double":   `double: "a  b"`,
    "single":   `single: 'c  d'`,
    "regexp":   `regexp: /e  f/`,
    "template": "template: `left\n  right`",
  }
  for name, want := range expected {
    if got := signatures[name]; got != want {
      t.Fatalf("signature for %q = %q, want %q", name, got, want)
    }
  }
}
