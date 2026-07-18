package graph

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLiteralsRenderEveryValueInTypescriptSourceForm verifies that each kind of
// literal a union can hold reaches the wire as the way it is written, and that
// the rendering is the checker's own rather than this package's.
//
// Source form is what makes the list readable as the type: it is the only
// rendering that tells `1` from `"1"` and `true` from `"true"`, which bare
// contents cannot, and the old string-only scrape could not report a numeric
// union at all. The escaping fixture is why the checker's `ValueToString` is
// used instead of a local formatter — a quote inside a value has to come back
// escaped the way TypeScript escapes it, and Go's own quoting is not that.
//
//  1. Compile a fixture with a string, numeric, boolean, bigint, nullable, and
//     escaped-string union.
//  2. Build the graph.
//  3. Assert each value set renders in TypeScript source form.
func TestLiteralsRenderEveryValueInTypescriptSourceForm(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export type Strings = 'a' | 'b';
export type Numbers = 1 | 2 | 3;
export type Bools = true | false;
export type Bigints = 1n | 2n;
export type Nullable = 'a' | null;
export type Optional = 'a' | undefined;
export type Escaped = 'he said "hi"' | "it's" | 'tab\there';
export type Mixed = 'a' | 1 | true;
`)

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

  for _, testCase := range []struct {
    name string
    want []string
  }{
    // A string keeps its quotes, so the list reads as the type does.
    {"Strings", []string{`"a"`, `"b"`}},
    // Numbers were absent entirely under the string-only scrape.
    {"Numbers", []string{"1", "2", "3"}},
    {"Bools", []string{"false", "true"}},
    {"Bigints", []string{"1n", "2n"}},
    // A unit type that is not a literal still names one value a caller writes,
    // so the set stays complete rather than dropping to nothing.
    {"Nullable", []string{"null", `"a"`}},
    {"Optional", []string{"undefined", `"a"`}},
    // The checker's escaping, not Go's: an inner double quote is backslashed,
    // an apostrophe is not re-quoted, and a tab stays an escape rather than a
    // raw control character.
    {"Escaped", []string{`"he said \"hi\""`, `"it's"`, `"tab\there"`}},
    // Kinds mix in one union, and source form is what keeps them apart.
    {"Mixed", []string{`"a"`, "1", "true"}},
  } {
    got := literalsOf(t, graph, nodeID(path, testCase.name, NodeTypeAlias))
    if !slices.Equal(got, testCase.want) {
      t.Fatalf("%s rendered %v, want %v", testCase.name, got, testCase.want)
    }
  }
}
