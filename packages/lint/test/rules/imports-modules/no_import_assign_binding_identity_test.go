package linthost

import (
  "path/filepath"
  "sort"
  "strings"
  "testing"
)

const noImportAssignRangeStart = "/* no-import-assign:start */"
const noImportAssignRangeEnd = "/* no-import-assign:end */"

type noImportAssignExpectedFinding struct {
  snippet string
  message string
}

// TestNoImportAssignBindingIdentityAndCompleteWrites pins every supported write
// surface to the actual import symbol rather than its spelling. It also verifies
// the ESLint namespace-mutation functions and exact outer mutation ranges.
func TestNoImportAssignBindingIdentityAndCompleteWrites(t *testing.T) {
  source := `import defaultValue, {
  value,
  value as aliased,
  same as sameA,
  type Model,
} from "./dep";
import { same as sameB } from "./dep2";
import * as namespaceValue from "./dep";
import type * as typeNamespace from "./dep";
import type DefaultModel from "./dep-default";
import type { Model as TypeAlias } from "./dep";
import legacy = require("./dep");

declare const replacement: typeof defaultValue;
declare const values: any[];
declare const record: Record<string, any>;

/* no-import-assign:start */defaultValue = replacement/* no-import-assign:end */;
/* no-import-assign:start */value += 1/* no-import-assign:end */;
/* no-import-assign:start */++aliased/* no-import-assign:end */;
/* no-import-assign:start */aliased--/* no-import-assign:end */;
(/* no-import-assign:start */[value] = values/* no-import-assign:end */);
(/* no-import-assign:start */{ key: aliased = 0 } = record/* no-import-assign:end */);
(/* no-import-assign:start */{ value } = record/* no-import-assign:end */);
(/* no-import-assign:start */[...aliased] = values/* no-import-assign:end */);
(/* no-import-assign:start */[value = replacement] = values/* no-import-assign:end */);
(/* no-import-assign:start */{ ...aliased } = record/* no-import-assign:end */);
(/* no-import-assign:start */[value, aliased] = values/* no-import-assign:end */);
(/* no-import-assign:start */(value as any) = replacement/* no-import-assign:end */);
/* no-import-assign:start */for (value of values) {}/* no-import-assign:end */
/* no-import-assign:start */for (aliased in record) {}/* no-import-assign:end */

/* no-import-assign:start */namespaceValue.member = 1/* no-import-assign:end */;
/* no-import-assign:start */namespaceValue.member += 1/* no-import-assign:end */;
/* no-import-assign:start */namespaceValue["member"]++/* no-import-assign:end */;
/* no-import-assign:start */++namespaceValue.member/* no-import-assign:end */;
/* no-import-assign:start */delete namespaceValue.member/* no-import-assign:end */;
/* no-import-assign:start */delete namespaceValue?.member/* no-import-assign:end */;
(/* no-import-assign:start */[namespaceValue.member] = values/* no-import-assign:end */);
(/* no-import-assign:start */{ key: namespaceValue.member = 0 } = record/* no-import-assign:end */);
(/* no-import-assign:start */{ ...namespaceValue.member } = record/* no-import-assign:end */);
(/* no-import-assign:start */namespaceValue[replacement as any] = 1/* no-import-assign:end */);
/* no-import-assign:start */for (namespaceValue["member"] of values) {}/* no-import-assign:end */
/* no-import-assign:start */namespaceValue = replacement/* no-import-assign:end */;

/* no-import-assign:start */Object["assign"](namespaceValue, {})/* no-import-assign:end */;
/* no-import-assign:start */Object.defineProperty(namespaceValue, "x", {})/* no-import-assign:end */;
/* no-import-assign:start */(Object?.defineProperty)(namespaceValue, "y", {})/* no-import-assign:end */;
/* no-import-assign:start */Object.defineProperties(namespaceValue, {})/* no-import-assign:end */;
/* no-import-assign:start */Object.freeze(namespaceValue)/* no-import-assign:end */;
/* no-import-assign:start */Object.setPrototypeOf(namespaceValue, null)/* no-import-assign:end */;
/* no-import-assign:start */Reflect.defineProperty(namespaceValue, "x", {})/* no-import-assign:end */;
/* no-import-assign:start */Reflect.deleteProperty(namespaceValue, "x")/* no-import-assign:end */;
/* no-import-assign:start */Reflect.set(namespaceValue, "x", 1)/* no-import-assign:end */;
/* no-import-assign:start */Reflect.setPrototypeOf(namespaceValue, null)/* no-import-assign:end */;

/* no-import-assign:start */sameA = 1/* no-import-assign:end */;
/* no-import-assign:start */sameB = 2/* no-import-assign:end */;
/* no-import-assign:start */legacy = null as never/* no-import-assign:end */;
/* no-import-assign:start */Model = null as never/* no-import-assign:end */;
/* no-import-assign:start */DefaultModel = null as never/* no-import-assign:end */;
/* no-import-assign:start */TypeAlias = null as never/* no-import-assign:end */;
(/* no-import-assign:start */{ Model } = record/* no-import-assign:end */);
/* no-import-assign:start */typeNamespace = null as never/* no-import-assign:end */;
/* no-import-assign:start */typeNamespace.member = 1/* no-import-assign:end */;
`

  binding := func(snippet, name string) noImportAssignExpectedFinding {
    return noImportAssignExpectedFinding{snippet: snippet, message: "'" + name + "' is read-only."}
  }
  member := func(snippet, name string) noImportAssignExpectedFinding {
    return noImportAssignExpectedFinding{snippet: snippet, message: "The members of '" + name + "' are read-only."}
  }
  expected := []noImportAssignExpectedFinding{
    binding("defaultValue = replacement", "defaultValue"),
    binding("value += 1", "value"),
    binding("++aliased", "aliased"),
    binding("aliased--", "aliased"),
    binding("[value] = values", "value"),
    binding("{ key: aliased = 0 } = record", "aliased"),
    binding("{ value } = record", "value"),
    binding("[...aliased] = values", "aliased"),
    binding("[value = replacement] = values", "value"),
    binding("{ ...aliased } = record", "aliased"),
    binding("[value, aliased] = values", "value"),
    binding("[value, aliased] = values", "aliased"),
    binding("(value as any) = replacement", "value"),
    binding("for (value of values) {}", "value"),
    binding("for (aliased in record) {}", "aliased"),
    member("namespaceValue.member = 1", "namespaceValue"),
    member("namespaceValue.member += 1", "namespaceValue"),
    member("namespaceValue[\"member\"]++", "namespaceValue"),
    member("++namespaceValue.member", "namespaceValue"),
    member("delete namespaceValue.member", "namespaceValue"),
    member("delete namespaceValue?.member", "namespaceValue"),
    member("[namespaceValue.member] = values", "namespaceValue"),
    member("{ key: namespaceValue.member = 0 } = record", "namespaceValue"),
    member("{ ...namespaceValue.member } = record", "namespaceValue"),
    member("namespaceValue[replacement as any] = 1", "namespaceValue"),
    member("for (namespaceValue[\"member\"] of values) {}", "namespaceValue"),
    binding("namespaceValue = replacement", "namespaceValue"),
    member("Object[\"assign\"](namespaceValue, {})", "namespaceValue"),
    member("Object.defineProperty(namespaceValue, \"x\", {})", "namespaceValue"),
    member("(Object?.defineProperty)(namespaceValue, \"y\", {})", "namespaceValue"),
    member("Object.defineProperties(namespaceValue, {})", "namespaceValue"),
    member("Object.freeze(namespaceValue)", "namespaceValue"),
    member("Object.setPrototypeOf(namespaceValue, null)", "namespaceValue"),
    member("Reflect.defineProperty(namespaceValue, \"x\", {})", "namespaceValue"),
    member("Reflect.deleteProperty(namespaceValue, \"x\")", "namespaceValue"),
    member("Reflect.set(namespaceValue, \"x\", 1)", "namespaceValue"),
    member("Reflect.setPrototypeOf(namespaceValue, null)", "namespaceValue"),
    binding("sameA = 1", "sameA"),
    binding("sameB = 2", "sameB"),
    binding("legacy = null as never", "legacy"),
    binding("Model = null as never", "Model"),
    binding("DefaultModel = null as never", "DefaultModel"),
    binding("TypeAlias = null as never", "TypeAlias"),
    binding("{ Model } = record", "Model"),
    binding("typeNamespace = null as never", "typeNamespace"),
    member("typeNamespace.member = 1", "typeNamespace"),
  }

  findings := runNoImportAssignProject(t, source)
  assertNoImportAssignFindings(t, source, findings, expected)
}

// TestNoImportAssignRecognizesEveryAssignmentOperator makes the shared
// assignment-operator classifier part of this rule's regression boundary.
func TestNoImportAssignRecognizesEveryAssignmentOperator(t *testing.T) {
  operators := []string{
    "=", "+=", "-=", "*=", "/=", "%=", "**=",
    "<<=", ">>=", ">>>=", "&=", "|=", "^=", "&&=", "||=", "??=",
  }
  var source strings.Builder
  source.WriteString("import { value } from \"./dep\";\n")
  source.WriteString("declare const rhs: any;\n")
  expected := make([]noImportAssignExpectedFinding, 0, len(operators))
  for _, operator := range operators {
    snippet := "value " + operator + " rhs"
    source.WriteString(noImportAssignRangeStart + snippet + noImportAssignRangeEnd + ";\n")
    expected = append(expected, noImportAssignExpectedFinding{
      snippet: snippet,
      message: "'value' is read-only.",
    })
  }

  text := source.String()
  findings := runNoImportAssignProject(t, text)
  assertNoImportAssignFindings(t, text, findings, expected)
}

// TestNoImportAssignIgnoresResolvedShadowsAndDeeperValues prevents every
// name-based false positive while keeping namespace protection shallow, as the
// official rule requires. Local Object/Reflect declarations also prove the
// mutation-function recognition follows the global binding.
func TestNoImportAssignIgnoresResolvedShadowsAndDeeperValues(t *testing.T) {
  source := `import defaultValue, { value, value as aliased } from "./dep";
import * as namespaceValue from "./dep";
import type { Model as ImportedModel } from "./dep";
import legacy = require("./dep");

declare const record: Record<string, any>;
declare function consume(value: unknown): void;

defaultValue.member = 1;
(defaultValue.member as any) += 1;
defaultValue.member++;
delete defaultValue.member;
for (defaultValue.member in record) {}
[defaultValue.member] = [record];
({ ...defaultValue.member } = record);
(value as any).member = 2;
namespaceValue.member.deep = 3;
namespaceValue["member"].deep = 4;
namespaceValue.member.deep++;
delete namespaceValue.member.deep;
for (namespaceValue.member.deep of []) {}
[namespaceValue.member.deep] = [];
({ ...namespaceValue.member.deep } = record);
Object.assign(namespaceValue.member, {});
Object.defineProperty(namespaceValue.member, "deep", {});
Object.assign(defaultValue, {});
Object.seal(namespaceValue);
Object.preventExtensions(namespaceValue);
Object.getPrototypeOf(namespaceValue);
Object[record.method](namespaceValue, {});
Reflect.preventExtensions(namespaceValue);
consume(namespaceValue);
legacy.member = 5;
({ [value]: record.local, key: record.other = value } = record);

function functionShadow(
  value: number,
  aliased: number,
  namespaceValue: { member: number },
  Object: { assign(target: object, source: object): object },
  Reflect: { set(target: object, key: string, value: unknown): boolean },
) {
  value = 1;
  ++aliased;
  namespaceValue.member = 2;
  Object.assign(namespaceValue, {});
  Reflect.set(namespaceValue, "member", 3);
}

function declarationShadows() {
  function value() {}
  value = function replacement() {};

  class namespaceValue {
    static member = 0;
  }
  namespaceValue = class replacement {};
  namespaceValue.member++;
}

function typeDeclarationShadow() {
  type ImportedModel = { local: true };
  ImportedModel = null as never;
}

{
  let value = 0;
  let namespaceValue = { member: 0 };
  [value] = [1];
  for (value of [1]) {}
  namespaceValue["member"]++;
}

try {
  throw 0;
} catch (value) {
  value = 1;
}

class ShadowContainer {
  method(value: number, namespaceValue: { member: number }) {
    value += 1;
    delete namespaceValue.member;
  }

  static {
    let value = 0;
    value++;
  }
}

consume(functionShadow);
consume(declarationShadows);
consume(typeDeclarationShadow);
consume(ShadowContainer);
`

  findings := runNoImportAssignProject(t, source)
  if len(findings) != 0 {
    t.Fatalf("resolved shadows and deeper imported values must stay clean, got %+v", findings)
  }
}

func runNoImportAssignProject(t *testing.T, source string) []*Finding {
  t.Helper()
  root := seedLintProjectFile(t, "main.ts", source)
  writeFile(t, filepath.Join(root, "src", "dep.ts"), `
const defaultValue = { member: { deep: 0 } };
export default defaultValue;
export let value = 0;
export let same = 0;
export interface Model { member: number }
export const member = { deep: 0 };
`)
  writeFile(t, filepath.Join(root, "src", "dep2.ts"), "export let same = 0;\n")
  writeFile(t, filepath.Join(root, "src", "dep-default.ts"), "export default interface DefaultModel { member: number }\n")

  engine := NewEngine(RuleConfig{"no-import-assign": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("no-import-assign did not request the checker required for binding identity")
  }
  engine.SetCurrentDirectory(root)
  program, diagnostics, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    forceNoEmit:      true,
    needsRuleChecker: true,
  })
  if program != nil {
    defer program.close()
  }
  if err != nil {
    t.Fatalf("loadProgram: %v", err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("loadProgram diagnostics: %+v", diagnostics)
  }
  if program == nil || program.checker == nil {
    t.Fatal("no-import-assign requires a loaded checker")
  }
  return program.runLintCycle(engine)
}

func assertNoImportAssignFindings(
  t *testing.T,
  source string,
  findings []*Finding,
  expected []noImportAssignExpectedFinding,
) {
  t.Helper()
  type rangedFinding struct {
    pos     int
    end     int
    message string
  }
  wants := make([]rangedFinding, 0, len(expected))
  for _, item := range expected {
    marked := noImportAssignRangeStart + item.snippet + noImportAssignRangeEnd
    markerPos := strings.Index(source, marked)
    if markerPos < 0 {
      t.Fatalf("missing marked expected snippet %q", item.snippet)
    }
    pos := markerPos + len(noImportAssignRangeStart)
    wants = append(wants, rangedFinding{pos: pos, end: pos + len(item.snippet), message: item.message})
  }
  sort.Slice(wants, func(i, j int) bool {
    if wants[i].pos != wants[j].pos {
      return wants[i].pos < wants[j].pos
    }
    return wants[i].message < wants[j].message
  })
  sort.Slice(findings, func(i, j int) bool {
    if findings[i].Pos != findings[j].Pos {
      return findings[i].Pos < findings[j].Pos
    }
    return findings[i].Message < findings[j].Message
  })
  if len(findings) != len(wants) {
    for _, finding := range findings {
      snippet := ""
      if finding.Pos >= 0 && finding.End >= finding.Pos && finding.End <= len(source) {
        snippet = source[finding.Pos:finding.End]
      }
      t.Logf("actual %s/%s [%d,%d) %q: %q",
        finding.Rule, finding.Severity.String(), finding.Pos, finding.End, finding.Message, snippet)
    }
    t.Fatalf("want %d findings, got %d (%+v)", len(wants), len(findings), findings)
  }
  for index, finding := range findings {
    want := wants[index]
    if finding.Rule != "no-import-assign" || finding.Severity != SeverityError ||
      finding.Pos != want.pos || finding.End != want.end || finding.Message != want.message {
      t.Fatalf("finding %d mismatch: want no-import-assign/error [%d,%d) %q, got %s/%s [%d,%d) %q",
        index, want.pos, want.end, want.message,
        finding.Rule, finding.Severity.String(), finding.Pos, finding.End, finding.Message)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d unexpectedly offered edits: %+v", index, finding)
    }
  }
}
