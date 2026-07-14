package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

type noRestrictedSyntaxExpectation struct {
  target  string
  message string
}

func runNoRestrictedSyntax(
  t *testing.T,
  source string,
  options json.RawMessage,
  expected ...noRestrictedSyntaxExpectation,
) {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "no-restricted-syntax", source, options)
  if len(findings) != len(expected) {
    t.Fatalf("no-restricted-syntax finding count mismatch: want=%+v got=%+v", expected, findings)
  }
  searchFrom := 0
  for index, want := range expected {
    relative := strings.Index(source[searchFrom:], want.target)
    if relative < 0 {
      t.Fatalf("expectation %d target %q is absent after byte %d", index, want.target, searchFrom)
    }
    start := searchFrom + relative
    end := start + len(want.target)
    finding := findings[index]
    if finding.Rule != "no-restricted-syntax" || finding.Severity != SeverityError ||
      finding.Pos != start || finding.End != end || finding.Message != want.message {
      t.Fatalf("finding %d mismatch: want=%+v range=[%d,%d) got=%+v", index, want, start, end, finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d unexpectedly offered edits: %+v", index, finding)
    }
    searchFrom = end
  }
}

func noRestrictedDefaultMessage(selector string) string {
  return "Using '" + selector + "' is not allowed."
}

func TestNoRestrictedSyntaxHasNoImplicitDenylist(t *testing.T) {
  source := `function legacy(target: any): void {
  with (target) { target.value = 1; }
  outer: for (;;) { break outer; }
}
`
  runNoRestrictedSyntax(t, source, nil)
  runNoRestrictedSyntax(t, source, json.RawMessage(`[]`))
}

func TestNoRestrictedSyntaxAppliesEveryConfiguredEntryAndCustomMessage(t *testing.T) {
  source := `function legacy(target: any): void {
  with (target) { target.value = 1; }
  outer: for (;;) { break outer; }
}
`
  options := json.RawMessage(`[
    "WithStatement",
    {"selector":"LabeledStatement","message":"Labels obscure control flow."}
  ]`)
  runNoRestrictedSyntax(
    t,
    source,
    options,
    noRestrictedSyntaxExpectation{
      target:  `with (target) { target.value = 1; }`,
      message: noRestrictedDefaultMessage("WithStatement"),
    },
    noRestrictedSyntaxExpectation{
      target:  `outer: for (;;) { break outer; }`,
      message: "Labels obscure control flow.",
    },
  )
}

func TestNoRestrictedSyntaxUsesTheLastMessageForARepeatedSelector(t *testing.T) {
  source := `debugger;
`
  options := json.RawMessage(`[
    {"selector":"DebuggerStatement","message":"Superseded message."},
    "DebuggerStatement",
    {"selector":"DebuggerStatement","message":"Final message."}
  ]`)
  runNoRestrictedSyntax(
    t,
    source,
    options,
    noRestrictedSyntaxExpectation{target: "debugger;", message: "Final message."},
  )
}

func TestNoRestrictedSyntaxChecksStructuredOptionUniquenessByFields(t *testing.T) {
  options, err := decodeNoRestrictedSyntaxOptions(json.RawMessage(`[
    {"selector":"A","message":"B\u0000true\u0000C"},
    {"selector":"A\u0000true\u0000B","message":"C"}
  ]`))
  if err != nil || len(options) != 2 {
    t.Fatalf("distinct structured options collided: options=%+v err=%v", options, err)
  }
}

func TestNoRestrictedSyntaxReportsMatchesInSourceOrder(t *testing.T) {
  source := `debugger;
with ({ value: 1 }) { void value; }
`
  options := json.RawMessage(`["WithStatement","DebuggerStatement"]`)
  runNoRestrictedSyntax(
    t,
    source,
    options,
    noRestrictedSyntaxExpectation{target: "debugger;", message: noRestrictedDefaultMessage("DebuggerStatement")},
    noRestrictedSyntaxExpectation{
      target:  "with ({ value: 1 }) { void value; }",
      message: noRestrictedDefaultMessage("WithStatement"),
    },
  )
}

func TestNoRestrictedSyntaxMatchesAttributesNestedPathsRegexTypesAndLengths(t *testing.T) {
  source := `declare function DANGER(first: number, second: number): void;
const target = { key: true };
const present = "key" in target;
DANGER(1, 2);
JSON.stringify(present);
`
  selector := `CallExpression[callee.name=/^danger$/iu][callee.name=type(string)][arguments.length>=2]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`{"selector":"`+selector+`","message":"Dangerous call."}`),
    noRestrictedSyntaxExpectation{target: "DANGER(1, 2)", message: "Dangerous call."},
  )

  binarySelector := `BinaryExpression[operator='in']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+binarySelector+`"`),
    noRestrictedSyntaxExpectation{target: `"key" in target`, message: noRestrictedDefaultMessage(binarySelector)},
  )
}

func TestNoRestrictedSyntaxCoercesEmptyNodeListsForNumericComparisons(t *testing.T) {
  source := `const empty = (): void => {};
empty();
`
  selector := `CallExpression[arguments<1]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "empty()", message: noRestrictedDefaultMessage(selector)},
  )
  runNoRestrictedSyntax(t, source, json.RawMessage(`"CallExpression[arguments>0]"`))
}

func TestNoRestrictedSyntaxPreservesNullAcrossNestedPaths(t *testing.T) {
  source := `declare const flag: boolean;
if (flag) { void flag; }
`
  selector := `IfStatement[alternate.missing=type(object)]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "if (flag) { void flag; }", message: noRestrictedDefaultMessage(selector)},
  )
  runNoRestrictedSyntax(t, source, json.RawMessage(`"IfStatement[alternate.missing=type(undefined)]"`))
}

func TestNoRestrictedSyntaxStringifiesRegularExpressionValues(t *testing.T) {
  source := `const pattern = /danger/mi;
void pattern;
`
  selector := `RegularExpressionLiteral[value='/danger/im'][raw='/danger/mi'][value=type(object)]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "/danger/mi", message: noRestrictedDefaultMessage(selector)},
  )
}

func TestNoRestrictedSyntaxComparesStringsAsUTF16(t *testing.T) {
  source := "const value = \"𐀀\";\nvoid value;\n"
  selector := "StringLiteral[value<'\ue000']"
  options, err := json.Marshal(selector)
  if err != nil {
    t.Fatal(err)
  }
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(options),
    noRestrictedSyntaxExpectation{target: "\"𐀀\"", message: noRestrictedDefaultMessage(selector)},
  )
}

func TestNoRestrictedSyntaxMatchesIndexedPathsLiteralTypesAndPrefix(t *testing.T) {
  source := `declare function choose(first: string, second: number): void;
let count = 0;
const emoji = "😀";
const amount = 0x10n;
const precise = 9007199254740993n;
const huge = 0x10000000000000000;
const decimal = 100000000000000000000;
const tiny = 0.000001;
const infinity = 1e999;
++count;
count++;
choose("x", count);
`
  indexedSelector := `FunctionDeclaration[params.0.name='first']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+indexedSelector+`"`),
    noRestrictedSyntaxExpectation{
      target:  "declare function choose(first: string, second: number): void;",
      message: noRestrictedDefaultMessage(indexedSelector),
    },
  )
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"FunctionDeclaration[params.01.name='second']"`),
  )

  numberSelector := `NumericLiteral[value=type(number)][value=.0]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+numberSelector+`"`),
    noRestrictedSyntaxExpectation{target: "0", message: noRestrictedDefaultMessage(numberSelector)},
  )

  stringSelector := `StringLiteral[raw='"😀"'][value.length=2]`
  stringOptions, err := json.Marshal(stringSelector)
  if err != nil {
    t.Fatal(err)
  }
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(stringOptions),
    noRestrictedSyntaxExpectation{target: `"😀"`, message: noRestrictedDefaultMessage(stringSelector)},
  )

  bigintSelector := `BigIntLiteral[value=16]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+bigintSelector+`"`),
    noRestrictedSyntaxExpectation{target: "0x10n", message: noRestrictedDefaultMessage(bigintSelector)},
  )

  preciseBigintSelector := `BigIntLiteral[value>'9007199254740992']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+preciseBigintSelector+`"`),
    noRestrictedSyntaxExpectation{target: "9007199254740993n", message: noRestrictedDefaultMessage(preciseBigintSelector)},
  )

  infiniteNumberSelector := `BigIntLiteral[value>9007199254740992][value<` + strings.Repeat("9", 400) + `]`
  infiniteNumberOptions, err := json.Marshal(infiniteNumberSelector)
  if err != nil {
    t.Fatal(err)
  }
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(infiniteNumberOptions),
    noRestrictedSyntaxExpectation{target: "9007199254740993n", message: noRestrictedDefaultMessage(infiniteNumberSelector)},
  )

  hugeNumberSelector := `NumericLiteral[value=18446744073709551616]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+hugeNumberSelector+`"`),
    noRestrictedSyntaxExpectation{target: "0x10000000000000000", message: noRestrictedDefaultMessage(hugeNumberSelector)},
  )

  decimalStringSelector := `NumericLiteral[value='100000000000000000000']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+decimalStringSelector+`"`),
    noRestrictedSyntaxExpectation{
      target:  "100000000000000000000",
      message: noRestrictedDefaultMessage(decimalStringSelector),
    },
  )

  tinyStringSelector := `NumericLiteral[value='0.000001'][value>'0x0']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+tinyStringSelector+`"`),
    noRestrictedSyntaxExpectation{target: "0.000001", message: noRestrictedDefaultMessage(tinyStringSelector)},
  )
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"NumericLiteral[raw='0.000001'][value<'0x1_0']"`),
  )
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"NumericLiteral[raw='0.000001'][value<'1_0']"`),
  )
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"NumericLiteral[raw='0.000001'][value<'+0x1p0']"`),
  )

  infinitySelector := `NumericLiteral[value=Infinity][value=type(number)]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+infinitySelector+`"`),
    noRestrictedSyntaxExpectation{target: "1e999", message: noRestrictedDefaultMessage(infinitySelector)},
  )

  prefixSelector := `UpdateExpression[prefix=true]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+prefixSelector+`"`),
    noRestrictedSyntaxExpectation{target: "++count", message: noRestrictedDefaultMessage(prefixSelector)},
  )

  bodySelector := `Program[body.length=12]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+bodySelector+`"`),
    noRestrictedSyntaxExpectation{target: source, message: noRestrictedDefaultMessage(bodySelector)},
  )
}

func TestNoRestrictedSyntaxLimitsBooleanPropertiesAndESTreeAliases(t *testing.T) {
  source := `let count = 0;
++count;
void count;
class Box { classMethod(): number { return 1; } }
const record = { objectMethod(): number { return 2; } };
JSON.stringify([Box, record]);
`
  runNoRestrictedSyntax(t, source, json.RawMessage(`"Identifier[async=false]"`))

  unarySelector := `UnaryExpression`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+unarySelector+`"`),
    noRestrictedSyntaxExpectation{target: "void count", message: noRestrictedDefaultMessage(unarySelector)},
  )

  propertySelector := `Property`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+propertySelector+`"`),
    noRestrictedSyntaxExpectation{
      target:  "objectMethod(): number { return 2; }",
      message: noRestrictedDefaultMessage(propertySelector),
    },
  )
}

func TestNoRestrictedSyntaxInheritsDeclareFromVariableStatements(t *testing.T) {
  source := `declare const ambient: number;
const local = 1;
void local;
`
  declaredSelector := `VariableDeclarator[declare=true]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+declaredSelector+`"`),
    noRestrictedSyntaxExpectation{target: "ambient: number", message: noRestrictedDefaultMessage(declaredSelector)},
  )

  localSelector := `VariableDeclarator[declare=false]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+localSelector+`"`),
    noRestrictedSyntaxExpectation{target: "local = 1", message: noRestrictedDefaultMessage(localSelector)},
  )
}

func TestNoRestrictedSyntaxKeepsTemplateAndLiteralAliasesDistinct(t *testing.T) {
  source := "const text = `value`;\nvoid text;\n"
  runNoRestrictedSyntax(t, source, json.RawMessage(`"Literal"`))
  templateSelector := `TemplateLiteral`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+templateSelector+`"`),
    noRestrictedSyntaxExpectation{target: "`value`", message: noRestrictedDefaultMessage(templateSelector)},
  )
}

func TestNoRestrictedSyntaxDistinguishesRestAndSpreadAliases(t *testing.T) {
  source := `declare const record: Record<string, number>;
function collect(...items: number[]): number[] { const values = items; return [...values]; }
const clone = { ...record };
JSON.stringify([collect, clone]);
`
  restSelector := `RestElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+restSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...items: number[]", message: noRestrictedDefaultMessage(restSelector)},
  )

  restArgumentSelector := `RestElement[argument.name='items']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+restArgumentSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...items: number[]", message: noRestrictedDefaultMessage(restArgumentSelector)},
  )

  spreadSelector := `SpreadElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+spreadSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...values", message: noRestrictedDefaultMessage(spreadSelector)},
    noRestrictedSyntaxExpectation{target: "...record", message: noRestrictedDefaultMessage(spreadSelector)},
  )
  runNoRestrictedSyntax(t, source, json.RawMessage(`"Property"`))
}

func TestNoRestrictedSyntaxDistinguishesObjectBindingPropertiesFromRest(t *testing.T) {
  source := `declare const record: { source: number; extra: number };
const { source: local, ...remaining } = record;
JSON.stringify([local, remaining]);
`
  propertySelector := `ObjectPattern > Property[key.name='source'][value.name='local']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+propertySelector+`"`),
    noRestrictedSyntaxExpectation{target: "source: local", message: noRestrictedDefaultMessage(propertySelector)},
  )
  runNoRestrictedSyntax(t, source, json.RawMessage(`"ObjectPattern > Property[key.name='remaining']"`))

  restSelector := `ObjectPattern > RestElement[argument.name='remaining']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+restSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...remaining", message: noRestrictedDefaultMessage(restSelector)},
  )
}

func TestNoRestrictedSyntaxDistinguishesAssignmentPatternsFromLiterals(t *testing.T) {
  source := `let first = 0;
let assignedRest: number[] = [];
const rest: number[] = [];
let value = 0;
let assignedOthers: Record<string, number> = {};
const others: Record<string, number> = {};
[first = 1, ...assignedRest] = [1, 2];
({ value, ...assignedOthers } = { value: 1 });
const array = [...rest];
const object = { ...others };
JSON.stringify([first, value, array, object]);
`
  arrayPatternSelector := `ArrayPattern > RestElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+arrayPatternSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...assignedRest", message: noRestrictedDefaultMessage(arrayPatternSelector)},
  )

  objectPatternSelector := `ObjectPattern > RestElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+objectPatternSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...assignedOthers", message: noRestrictedDefaultMessage(objectPatternSelector)},
  )

  arrayExpressionSelector := `ArrayExpression > SpreadElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+arrayExpressionSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...rest", message: noRestrictedDefaultMessage(arrayExpressionSelector)},
  )

  objectExpressionSelector := `ObjectExpression > SpreadElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+objectExpressionSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...others", message: noRestrictedDefaultMessage(objectExpressionSelector)},
  )

  runNoRestrictedSyntax(t, source, json.RawMessage(`"ArrayPattern AssignmentExpression"`))
  outerAssignmentSelector := `AssignmentExpression > ArrayPattern`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+outerAssignmentSelector+`"`),
    noRestrictedSyntaxExpectation{
      target:  "[first = 1, ...assignedRest]",
      message: noRestrictedDefaultMessage(outerAssignmentSelector),
    },
  )
}

func TestNoRestrictedSyntaxExposesComputedKeysAndPropertyValuePaths(t *testing.T) {
  source := `const key = "answer";
const record = { [key]: () => 42, plain: () => 0 };
JSON.stringify(record);
`
  selector := `PropertyAssignment[computed=true][key.expression.name='key'][value.type='ArrowFunction']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "[key]: () => 42", message: noRestrictedDefaultMessage(selector)},
  )
}

func TestNoRestrictedSyntaxExposesSwitchCaseTestAndConsequent(t *testing.T) {
  source := `let output = 0;
switch (output) {
  case 1: output = 1; break;
  default: break;
}
`
  selector := `CaseClause[test.value=1][consequent.length=2]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "case 1: output = 1; break;", message: noRestrictedDefaultMessage(selector)},
  )
}

func TestNoRestrictedSyntaxExposesScalarStatementBodies(t *testing.T) {
  source := `label: { void 1; }
try { throw 1; } catch (error) { void error; }
class Box { static { void 2; } }
void Box;
`
  cases := []struct {
    selector string
    target   string
  }{
    {selector: `LabeledStatement > Block.body`, target: `{ void 1; }`},
    {selector: `CatchClause > Block.body`, target: `{ void error; }`},
    {selector: `ClassStaticBlockDeclaration > Block.body`, target: `{ void 2; }`},
  }
  for _, tc := range cases {
    runNoRestrictedSyntax(
      t,
      source,
      json.RawMessage(`"`+tc.selector+`"`),
      noRestrictedSyntaxExpectation{target: tc.target, message: noRestrictedDefaultMessage(tc.selector)},
    )
  }
}

func TestNoRestrictedSyntaxMatchesCombinatorsFieldsPseudosAndSubjects(t *testing.T) {
  functionSource := `function selected(value: number): number {
  return arguments.length;
}
`
  fieldSelector := `FunctionDeclaration > Identifier.id`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+fieldSelector+`"`),
    noRestrictedSyntaxExpectation{target: "selected", message: noRestrictedDefaultMessage(fieldSelector)},
  )

  descendantSelector := `FunctionDeclaration ReturnStatement > PropertyAccessExpression.argument`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+descendantSelector+`"`),
    noRestrictedSyntaxExpectation{target: "arguments.length", message: noRestrictedDefaultMessage(descendantSelector)},
  )

  hasSelector := `FunctionDeclaration:has(> Identifier.id):not([async=true])`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+hasSelector+`"`),
    noRestrictedSyntaxExpectation{target: strings.TrimSpace(functionSource), message: noRestrictedDefaultMessage(hasSelector)},
  )

  subjectSelector := `!FunctionDeclaration > Identifier.id`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+subjectSelector+`"`),
    noRestrictedSyntaxExpectation{target: strings.TrimSpace(functionSource), message: noRestrictedDefaultMessage(subjectSelector)},
  )

  siblingSource := `const first = 1, second = 2, third = 3;
JSON.stringify([first, second, third]);
`
  adjacentSelector := `VariableDeclaration + VariableDeclaration[name='second']:nth-child(2)`
  runNoRestrictedSyntax(
    t,
    siblingSource,
    json.RawMessage(`"`+adjacentSelector+`"`),
    noRestrictedSyntaxExpectation{target: "second = 2", message: noRestrictedDefaultMessage(adjacentSelector)},
  )
  siblingSelector := `VariableDeclaration ~ VariableDeclaration[name='third']:last-child`
  runNoRestrictedSyntax(
    t,
    siblingSource,
    json.RawMessage(`"`+siblingSelector+`"`),
    noRestrictedSyntaxExpectation{target: "third = 3", message: noRestrictedDefaultMessage(siblingSelector)},
  )

  callSource := `declare function combine(first: number, second: number): number;
const result = combine(1, 2);
void result;
`
  runNoRestrictedSyntax(
    t,
    callSource,
    json.RawMessage(`"CallExpression > Identifier[name='combine']:first-child"`),
  )
  argumentSelector := `CallExpression > NumericLiteral[value=1]:first-child + NumericLiteral[value=2]:last-child`
  runNoRestrictedSyntax(
    t,
    callSource,
    json.RawMessage(`"`+argumentSelector+`"`),
    noRestrictedSyntaxExpectation{target: "2", message: noRestrictedDefaultMessage(argumentSelector)},
  )

  classSource := `class Pair {
  first(): void {}
  second(): void {}
}
`
  memberSelector := `ClassDeclaration > MethodDeclaration:first-child + MethodDeclaration:last-child`
  runNoRestrictedSyntax(
    t,
    classSource,
    json.RawMessage(`"`+memberSelector+`"`),
    noRestrictedSyntaxExpectation{target: "second(): void {}", message: noRestrictedDefaultMessage(memberSelector)},
  )
}

func TestNoRestrictedSyntaxMatchesClassesAlternativesAndTypeScriptNodes(t *testing.T) {
  source := `type Text = string;
declare const input: unknown;
const asserted = input as Text;
const satisfied = input satisfies unknown;
function returns(): unknown { return asserted; }
JSON.stringify([satisfied, returns]);
`
  selector := `:matches(TSAsExpression, TSSatisfiesExpression)`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "input as Text", message: noRestrictedDefaultMessage(selector)},
    noRestrictedSyntaxExpectation{target: "input satisfies unknown", message: noRestrictedDefaultMessage(selector)},
  )

  classSelector := `:FUNCTION:has(ReturnStatement)`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+classSelector+`"`),
    noRestrictedSyntaxExpectation{target: "function returns(): unknown { return asserted; }", message: noRestrictedDefaultMessage(classSelector)},
  )

  literalSource := `const values = [true, null];
void values;
`
  expressionSelector := `Literal:expression`
  runNoRestrictedSyntax(
    t,
    literalSource,
    json.RawMessage(`"`+expressionSelector+`"`),
    noRestrictedSyntaxExpectation{target: "true", message: noRestrictedDefaultMessage(expressionSelector)},
    noRestrictedSyntaxExpectation{target: "null", message: noRestrictedDefaultMessage(expressionSelector)},
  )
}

func noRestrictedSyntaxValidationEngine(options json.RawMessage) *Engine {
  return NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"no-restricted-syntax": SeverityError},
    Options: RuleOptionsMap{
      "no-restricted-syntax": options,
    },
  })
}

func TestNoRestrictedSyntaxRejectsInvalidConfigurationBeforeDispatch(t *testing.T) {
  cases := []struct {
    name    string
    options json.RawMessage
    want    string
  }{
    {name: "malformed JSON", options: json.RawMessage(`{"selector":`), want: "must contain only selector and message"},
    {name: "wrong entry type", options: json.RawMessage(`42`), want: "must be a selector string or {selector,message} object"},
    {name: "missing selector", options: json.RawMessage(`{"message":"missing"}`), want: "is missing selector"},
    {name: "null selector", options: json.RawMessage(`{"selector":null}`), want: "selector must be a string"},
    {name: "null message", options: json.RawMessage(`{"selector":"Identifier","message":null}`), want: "message must be a string"},
    {name: "boolean message", options: json.RawMessage(`{"selector":"Identifier","message":true}`), want: "message must be a string"},
    {name: "unknown key", options: json.RawMessage(`{"selector":"Identifier","extra":true}`), want: "unknown field"},
    {name: "empty selector", options: json.RawMessage(`"  "`), want: "selector must not be empty"},
    {name: "duplicate", options: json.RawMessage(`["Identifier","Identifier"]`), want: "duplicates an earlier option"},
    {name: "unterminated attribute", options: json.RawMessage(`"Identifier[name='x'"`), want: "expected ']'"},
    {name: "invalid regexp", options: json.RawMessage(`"Identifier[name=/(/]"`), want: "invalid regular expression"},
    {name: "empty regexp", options: json.RawMessage(`"Identifier[name=//]"`), want: "regular expression must not be empty"},
    {name: "invalid unquoted path", options: json.RawMessage(`"Identifier[name==value]"`), want: "expected attribute value"},
    {name: "unknown class", options: json.RawMessage(`":mystery"`), want: "unknown AST class"},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      engine := noRestrictedSyntaxValidationEngine(tc.options)
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), tc.want) {
        t.Fatalf("invalid no-restricted-syntax config mismatch: want=%q got=%v", tc.want, err)
      }
      if _, active := engine.EnabledRules()["no-restricted-syntax"]; active {
        t.Fatalf("invalid rule entered dispatch: %v", engine.EnabledRules())
      }
    })
  }
}

func TestCommandCheckHonorsNoRestrictedSyntaxOptions(t *testing.T) {
  root := seedLintProject(t, `eval("1");
const safe = JSON.stringify(1);
void safe;
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-syntax": []any{
        "error",
        map[string]any{
          "selector": "CallExpression[callee.name='eval']",
          "message":  "Do not evaluate source text.",
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[no-restricted-syntax] Do not evaluate source text.") != 1 {
    t.Fatalf("valid command path mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}

func TestCommandCheckRejectsInvalidNoRestrictedSyntaxSelector(t *testing.T) {
  root := seedLintProject(t, `eval("1");
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-syntax": []any{"error", "CallExpression["},
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, `invalid options for rule "no-restricted-syntax"`) ||
    !strings.Contains(stderr, "invalid selector") || strings.Contains(stderr, "[no-restricted-syntax]") {
    t.Fatalf("invalid command path mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
