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

// TestLinkedProgramStripsCustomCallsOnlyInStatementPositions verifies configured removals on parsed statements with adjacent callee and position controls.
//
// Matching a pattern is insufficient proof of transformation: calls used as
// values must remain, and required embedded slots cannot disappear. This case
// drives the real rewriter with custom JSON rules and checks its actual AST.
//
// 1. Parse exact/wildcard targets alongside default, computed, call-left and value-position controls.
// 2. Apply custom rules through Program.ApplyLinkedPlugins without enabling debugger removal.
// 3. Assert retained identities/literals and source-located empty replacements across embedded statement forms.
//
// @evidence contracts/testing.md#behavioral-verification Actual strip ApplyProgram removes console.warn, drop, logger.trace("drop") and custom.* expression statements, compacts the nested block, and replaces matched if/while/label/for/do/for-in/for-of/with bodies with empty statements. It preserves the logger declaration, initializer/return calls, bare custom, computed access, a call-expression receiver, console.log, console.debug("debug-call"), debugger, the else branch and all enclosing declarations/conditions.
// @evidence contracts/testing.md#independent-expectations The authored JSON rules require exact console.warn/drop and dotted custom descendants to act only in expression-statement positions; statements:[] explicitly retains debugger and disables default policy. Literal retained indices/text and original node/condition/source-location identities supply independent expectations. These pre-emit checks do not certify runtime or declaration output, whose original E2E assertions remain.
// @evidence contracts/testing.md#distinguishing-cases Exact and wildcard calls disappear while the wildcard prefix itself does not; computed and call-left callees are not identifier chains. The original alias-overlay logger.trace("drop") input disappears while its logger declaration and the adjacent console.log control remain, distinguishing custom rules from defaults. The same drop callee disappears as a statement but survives in an initializer and return. Lists compact while required embedded slots become empty, and a block's kept sibling/if's else survive. The adjacent default case owns default debugger/console/debug/assert behavior rather than repeating parser predicates here.
// @evidence contracts/testing.md#execution-ownership Named unit entry TestLinkedProgramStripsCustomCallsOnlyInStatementPositions is in test/unit for the utility overlay. One noLib single-threaded Program and actual registered plugin execute in this Go process; the absolute fixture configFile is JSON-only, t.Setenv restores the manifest and Close releases the checker lease. No script evaluation, native producer, subprocess, private linkname or global registry replacement is involved.
func TestLinkedProgramStripsCustomCallsOnlyInStatementPositions(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","noLib":true},"files":["src/main.ts"]}`,
    "strip.config.json": `{"calls":["console.warn","drop","custom.*","logger.trace"],"statements":[]}`,
    "src/main.ts": `function drop(value: string) { return value; }
declare const custom: any;
const value = drop("initializer");
console.warn("drop-warn");
drop("drop");
custom.trace("wildcard");
custom.deep.trace("nested");
custom("prefix");
console.log("keep-log");
debugger;
custom["trace"]("computed");
getCustom().trace("callee-left");
function getCustom() { return custom; }
function result() { return drop("return-value"); }
if (true) drop("if"); else console.log("else-kept");
if (false) { drop("block"); console.info("block-kept"); }
while (false) drop("while");
label: drop("label");
for (; false;) drop("for");
do drop("do"); while (false);
for (const key in {}) drop("for-in");
for (const item of []) drop("for-of");
with ({}) drop("with");
console.debug("debug-call");
const logger = { trace(message: string): void { void message; } };
logger.trace("drop");`,
  })
  t.Setenv(driver.LinkedPluginsEnv, shared.MustJSON(t, []driver.PluginEntry{{Name: "@ttsc/strip", Stage: "transform", Config: map[string]any{"transform": "@ttsc/strip", "configFile": filepath.Join(root, "strip.config.json")}}}))
  prog, diagnostics, err := driver.LoadProgram(root, filepath.Join(root, "tsconfig.json"), driver.LoadProgramOptions{SingleThreaded: true, ForceNoEmit: true, TsgoArgs: []string{}})
  if err != nil || len(diagnostics) != 0 || prog == nil {
    t.Fatalf("load parsed fixture: program=%v diagnostics=%v error=%v", prog != nil, diagnostics, err)
  }
  defer prog.Close()
  var file *shimast.SourceFile
  for _, source := range prog.TSProgram.SourceFiles() {
    if filepath.Base(source.FileName()) == "main.ts" {
      file = source
    }
  }
  if file == nil || file.Statements == nil || len(file.Statements.Nodes) != 26 {
    t.Fatal("fixture must parse its 26 authored statements")
  }
  original := append([]*shimast.Node(nil), file.Statements.Nodes...)
  bodies := map[int]*shimast.Node{
    14: original[14].AsIfStatement().ThenStatement,
    16: original[16].AsWhileStatement().Statement,
    17: original[17].AsLabeledStatement().Statement,
    18: original[18].AsForStatement().Statement,
    19: original[19].AsDoStatement().Statement,
    20: original[20].AsForInOrOfStatement().Statement,
    21: original[21].AsForInOrOfStatement().Statement,
    22: original[22].AsWithStatement().Statement,
  }
  conditions := map[int]*shimast.Node{
    14: original[14].AsIfStatement().Expression,
    15: original[15].AsIfStatement().Expression,
    16: original[16].AsWhileStatement().Expression,
    18: original[18].AsForStatement().Condition,
    19: original[19].AsDoStatement().Expression,
    20: original[20].AsForInOrOfStatement().Expression,
    21: original[21].AsForInOrOfStatement().Expression,
    22: original[22].AsWithStatement().Expression,
  }
  elseBranch := original[14].AsIfStatement().ElseStatement
  block := original[15].AsIfStatement().ThenStatement
  keptBlockStatement := block.StatementList().Nodes[1]
  if err := prog.ApplyLinkedPlugins(); err != nil {
    t.Fatal(err)
  }
  retained := []int{0, 1, 2, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}
  if len(file.Statements.Nodes) != len(retained) {
    t.Fatalf("retained statement count: got %d, want %d", len(file.Statements.Nodes), len(retained))
  }
  for i, index := range retained {
    if file.Statements.Nodes[i] != original[index] {
      t.Errorf("retained position %d must be original statement %d", i, index)
    }
  }
  afterBodies := map[int]*shimast.Node{
    14: original[14].AsIfStatement().ThenStatement,
    16: original[16].AsWhileStatement().Statement,
    17: original[17].AsLabeledStatement().Statement,
    18: original[18].AsForStatement().Statement,
    19: original[19].AsDoStatement().Statement,
    20: original[20].AsForInOrOfStatement().Statement,
    21: original[21].AsForInOrOfStatement().Statement,
    22: original[22].AsWithStatement().Statement,
  }
  for index, before := range bodies {
    after := afterBodies[index]
    if after == nil || after == before || after.Kind != shimast.KindEmptyStatement || after.Flags&shimast.NodeFlagsSynthesized == 0 || after.Loc != before.Loc {
      t.Errorf("statement %d must retain a source-located synthesized empty body", index)
    }
  }
  afterConditions := map[int]*shimast.Node{
    14: original[14].AsIfStatement().Expression,
    15: original[15].AsIfStatement().Expression,
    16: original[16].AsWhileStatement().Expression,
    18: original[18].AsForStatement().Condition,
    19: original[19].AsDoStatement().Expression,
    20: original[20].AsForInOrOfStatement().Expression,
    21: original[21].AsForInOrOfStatement().Expression,
    22: original[22].AsWithStatement().Expression,
  }
  for index, before := range conditions {
    if afterConditions[index] != before {
      t.Errorf("statement %d changed its condition/iterated expression", index)
    }
  }
  if original[14].AsIfStatement().ElseStatement != elseBranch || original[15].AsIfStatement().ThenStatement != block || len(block.StatementList().Nodes) != 1 || block.StatementList().Nodes[0] != keptBlockStatement {
    t.Error("else branch and retained block sibling must keep their original identities")
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
  if want := []string{"initializer", "prefix", "keep-log", "trace", "computed", "callee-left", "return-value", "else-kept", "block-kept", "debug-call"}; !reflect.DeepEqual(literals, want) {
    t.Errorf("retained literal sequence: got %#v, want %#v", literals, want)
  }
}
