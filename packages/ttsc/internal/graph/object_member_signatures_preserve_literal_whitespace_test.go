package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestObjectMemberSignaturesPreserveLiteralWhitespace verifies that compact
// display text never rewrites whitespace owned by a lexical value.
//
// strings.Fields treated quoted and template contents as trivia. It changed
// string and regular-expression values, and its first-line cut left a multiline
// template without a closing backtick. The outline may compact surrounding
// syntax only when the literal itself remains byte-identical and complete.
//
//  1. Compile object members with spaced strings, a regexp, and a template.
//  2. Dump the graph from the Program-owned source snapshot.
//  3. Assert literal whitespace and the complete template delimiter survive.
func TestObjectMemberSignaturesPreserveLiteralWhitespace(t *testing.T) {
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
  dump := NewDump(graph, root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{})
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
