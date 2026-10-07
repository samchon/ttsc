package graph

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLiteralsRenderEveryValueInTypescriptSourceForm checks the reported source
// renderings of eight authored alias shapes, including selected escaped strings
// and mixed kinds. It inspects graph facts rather than serialized wire bytes;
// output matching does not authenticate the renderer's acquisition method.
//
//  1. Compile a fixture with a string, numeric, boolean, bigint, nullable, and
//     escaped-string union.
//  2. Build the graph.
//  3. Assert each value set renders in TypeScript source form.
//
// @evidence contracts/testing.md#behavioral-verification Build's recorded literal arrays for eight authored aliases must exactly match the selected string, numeric, boolean, bigint, nullable, undefined, escaping and mixed-kind source-form expectations. Other literal values, escaping forms and wire encoding are not asserted.
// @evidence contracts/testing.md#independent-expectations The expectations are the literal TypeScript source renderings in the table (quoted strings, 1, true/false, 1n, null, undefined, escaped quotes and tab, and a mixed union), asserted against the node's recorded values for eight alias declarations. They are written independently of the renderer, which is the checker's ValueToString.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture with a string, numeric, boolean, bigint, nullable, and escaped-string union; Build the graph; Assert each value set renders in TypeScript source form.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly calls Build and existing-node literalsOf. Actual filename/shared ID formatting select aliases; a restored empty linked-plugin manifest excludes ambient hooks. No dump serialization, TypeScript value execution, installed consumer or product process runs.
func TestLiteralsRenderEveryValueInTypescriptSourceForm(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
    // Numeric values remain unquoted.
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
