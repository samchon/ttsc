package strip_test

import (
  "path/filepath"
  "reflect"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  _ "github.com/samchon/ttsc/packages/strip/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations verifies default removal on actual compiler statement lists and embedded bodies.
//
// Parsing defaults alone cannot show that a matched statement is removed or that
// an if condition and exported declarations survive. The linked driver entry
// reaches the real rewriter using an explicit JSON configuration with defaults.
//
// 1. Parse a source mixing debugger/default callees, a kept call, declarations and an embedded if body.
// 2. Apply the registered strip plugin with an empty JSON configuration.
// 3. Check retained statement identity/order, the empty embedded body, remaining literal text and the actual strip dependency declaration.
//
// @evidence contracts/testing.md#behavioral-verification Actual strip ApplyProgram removes debugger, console.log, console.debug and assert.equal expression statements from the parsed list. It retains interface/const/export declarations and console.info in order, replacing only the embedded if body with a synthesized empty statement at the original location while retaining the condition and parent. TransformDependenciesFor exposes the actual strip hook's complete src/main.ts declaration with no cross-file dependencies.
// @evidence contracts/testing.md#independent-expectations The strip default contract names the four removable forms; the authored kept call and StripBox declaration must preserve their meaning. Literal retained indices, original pointer identities and the three remaining authored strings are independent expectations rather than a strip predicate or emitted snapshot. Strip reads each file's own AST and reports configuration separately as host input, so the authored sole source key src/main.ts is complete without cross-file dependencies. This does not certify host-input observation, watch narrowing, declaration emission or runtime stdout.
// @evidence contracts/testing.md#distinguishing-cases Top-level removals differ from the required embedded body slot: the if itself and its condition remain even though its console.log body disappears. Interface, assert implementation, box export and console.info are negative controls; retained literal strings prove a clean list count alone cannot pass after deleting useful content. Custom-only patterns and non-expression calls are owned by the adjacent linked-program custom case.
// @evidence contracts/testing.md#execution-ownership Named unit entry TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations is in test/unit for the utility overlay. A single noLib single-threaded Program runs LoadProgram and ApplyLinkedPlugins in this Go process; an absolute fixture JSON path selects native JSON parsing, t.Setenv restores the manifest and Close releases the checker. No Node config evaluation, native build, command process, private linkname or registry replacement is used.
func TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":     `{"compilerOptions":{"target":"ES2022","module":"commonjs","noLib":true},"files":["src/main.ts"]}`,
    "strip.config.json": `{}`,
    "src/main.ts": `export interface StripBox { value: string }
const assert = { equal(left: number, right: number): void { if (left !== right) throw new Error("assertion failed"); } };
debugger;
console.log("drop");
console.debug("drop");
assert.equal(1, 1);
console.info("kept");
export const box: StripBox = { value: "kept" };
if (box.value) console.log("drop-if");`,
  })
  t.Setenv(driver.LinkedPluginsEnv, shared.MustJSON(t, []driver.PluginEntry{{Name: "@ttsc/strip", Stage: "transform", Config: map[string]any{"transform": "@ttsc/strip", "configFile": filepath.Join(root, "strip.config.json")}}}))
  prog, diagnostics, err := driver.LoadProgram(root, filepath.Join(root, "tsconfig.json"), driver.LoadProgramOptions{SingleThreaded: true, ForceNoEmit: true, TsgoArgs: []string{}})
  if err != nil || len(diagnostics) != 0 || prog == nil {
    t.Fatalf("load parsed fixture: program=%v diagnostics=%v error=%v", prog != nil, diagnostics, err)
  }
  defer prog.Close()
  var file *shimast.SourceFile
  for _, source := range prog.TSProgram.SourceFiles() {
    if filepath.Base(source.FileName().AsString()) == "main.ts" {
      file = source
    }
  }
  if file == nil || file.Statements == nil || len(file.Statements.Nodes) != 9 {
    t.Fatal("fixture must parse its nine authored statements")
  }
  original := append([]*shimast.Node(nil), file.Statements.Nodes...)
  if original[0].Kind != shimast.KindInterfaceDeclaration || original[8].Kind != shimast.KindIfStatement {
    t.Fatal("fixture declaration/embedded statement kinds differ")
  }
  embedded := original[8].AsIfStatement()
  condition, body := embedded.Expression, embedded.ThenStatement
  if err := prog.ApplyLinkedPlugins(); err != nil {
    t.Fatal(err)
  }
  dependencies := prog.TransformDependenciesFor(root)
  if want := []string{"src/main.ts"}; !reflect.DeepEqual(dependencies.Complete, want) {
    t.Errorf("actual strip complete files: got %#v, want %#v", dependencies.Complete, want)
  }
  if len(dependencies.Dependencies) != 0 {
    t.Errorf("strip must not invent cross-file dependencies: %#v", dependencies.Dependencies)
  }
  retained := []int{0, 1, 6, 7, 8}
  if len(file.Statements.Nodes) != len(retained) {
    t.Fatalf("retained statement count: got %d, want %d", len(file.Statements.Nodes), len(retained))
  }
  for i, index := range retained {
    if file.Statements.Nodes[i] != original[index] {
      t.Errorf("retained position %d must be original statement %d", i, index)
    }
  }
  if embedded.Expression != condition || embedded.ThenStatement == body || embedded.ThenStatement.Kind != shimast.KindEmptyStatement || embedded.ThenStatement.Flags&shimast.NodeFlagsSynthesized == 0 || embedded.ThenStatement.Loc != body.Loc {
    t.Error("embedded removal must preserve the condition and source-located required body slot")
  }
  var literals []string
  var visit func(*shimast.Node) bool
  visit = func(node *shimast.Node) bool {
    if node.Kind == shimast.KindStringLiteral {
      literals = append(literals, node.Text())
    }
    node.ForEachChild(visit)
    return false
  }
  visit(file.AsNode())
  if want := []string{"assertion failed", "kept", "kept"}; !reflect.DeepEqual(literals, want) {
    t.Errorf("retained literal sequence: got %#v, want %#v", literals, want)
  }
}
