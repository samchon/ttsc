package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
)

// BenchmarkEngineRun measures the per-file cost of `Engine.Run` on a
// synthetic source file that exercises the AST patterns the hot rule
// families care about: variable declarations, comparisons, object
// literals, ternaries, template/string concat candidates, regex
// escapes, bracket access, boolean coercions, simple TS `as`
// assertions, and a long stretch of identifiers (so visitors over
// `KindIdentifier` see their hot path).
//
// The benchmark drives `NewEngine(...).Run(...)` directly so it
// excludes the parser cost (parsed once before b.ResetTimer) and
// only measures lint dispatch.
//
// Usage:
//
//  node scripts/bench-go-lint.cjs -bench=^BenchmarkEngineRun$ -benchtime=3s
func BenchmarkEngineRun(b *testing.B) {
  source := engineBenchSource()
  file := parseBenchTSFile(b, "/virtual/bench.ts", source)
  rules := RuleConfig{
    "no-var":                              SeverityError,
    "eqeqeq":                              SeverityError,
    "object-shorthand":                    SeverityError,
    "no-unneeded-ternary":                 SeverityError,
    "prefer-template":                     SeverityError,
    "no-useless-rename":                   SeverityError,
    "dot-notation":                        SeverityError,
    "no-extra-boolean-cast":               SeverityError,
    "no-useless-escape":                   SeverityError,
    "typescript/prefer-as-const":          SeverityError,
    "typescript/prefer-namespace-keyword": SeverityError,
  }
  files := []*shimast.SourceFile{file}
  b.ResetTimer()
  b.ReportAllocs()
  for i := 0; i < b.N; i++ {
    engine := NewEngine(rules)
    engine.SetSerial(true)
    _ = engine.Run(files, nil)
  }
}

// BenchmarkEngineRunIdentifierHeavy targets rules that visit
// `KindIdentifier` (the most frequent AST kind). The source is
// dominated by simple identifier-bearing declarations and references
// so per-identifier work (e.g. dictionary lookups, lowercasing) sets
// the per-op cost.
//
// Currently the corpus enables `no-undefined` and `no-shadow-restricted-names`
// (both Identifier visitors). Adding `unicorn/prevent-abbreviations`
// here once its perf shortcut lands will exercise the dictionary
// short-circuit.
func BenchmarkEngineRunIdentifierHeavy(b *testing.B) {
  source := engineBenchIdentifierSource()
  file := parseBenchTSFile(b, "/virtual/bench-id.ts", source)
  rules := RuleConfig{
    "no-undefined":                  SeverityError,
    "no-shadow-restricted-names":    SeverityError,
    "unicorn/prevent-abbreviations": SeverityError,
  }
  files := []*shimast.SourceFile{file}
  b.ResetTimer()
  b.ReportAllocs()
  for i := 0; i < b.N; i++ {
    engine := NewEngine(rules)
    engine.SetSerial(true)
    _ = engine.Run(files, nil)
  }
}

// BenchmarkEngineRunUnicornBroad enables a broad slice of the unicorn
// family (~30 rules covering CallExpression, BinaryExpression, and
// other common kinds) over a source that triggers many of them. This
// approximates a "kitchen sink" lint config.
func BenchmarkEngineRunUnicornBroad(b *testing.B) {
  source := engineBenchSource() + engineBenchUnicornSource()
  file := parseBenchTSFile(b, "/virtual/bench-uni.ts", source)
  rules := RuleConfig{
    "unicorn/no-array-for-each":              SeverityError,
    "unicorn/no-array-reduce":                SeverityError,
    "unicorn/no-for-loop":                    SeverityError,
    "unicorn/no-instanceof-builtins":         SeverityError,
    "unicorn/no-negated-condition":           SeverityError,
    "unicorn/no-nested-ternary":              SeverityError,
    "unicorn/no-new-array":                   SeverityError,
    "unicorn/no-null":                        SeverityError,
    "unicorn/no-typeof-undefined":            SeverityError,
    "unicorn/no-useless-undefined":           SeverityError,
    "unicorn/no-useless-spread":              SeverityError,
    "unicorn/prefer-array-find":              SeverityError,
    "unicorn/prefer-array-flat-map":          SeverityError,
    "unicorn/prefer-array-some":              SeverityError,
    "unicorn/prefer-at":                      SeverityError,
    "unicorn/prefer-date-now":                SeverityError,
    "unicorn/prefer-default-parameters":      SeverityError,
    "unicorn/prefer-includes":                SeverityError,
    "unicorn/prefer-math-min-max":            SeverityError,
    "unicorn/prefer-math-trunc":              SeverityError,
    "unicorn/prefer-modern-math-apis":        SeverityError,
    "unicorn/prefer-negative-index":          SeverityError,
    "unicorn/prefer-number-properties":       SeverityError,
    "unicorn/prefer-optional-catch-binding":  SeverityError,
    "unicorn/prefer-spread":                  SeverityError,
    "unicorn/prefer-string-replace-all":      SeverityError,
    "unicorn/prefer-string-slice":            SeverityError,
    "unicorn/prefer-string-starts-ends-with": SeverityError,
    "unicorn/prefer-string-trim-start-end":   SeverityError,
    "unicorn/throw-new-error":                SeverityError,
  }
  files := []*shimast.SourceFile{file}
  b.ResetTimer()
  b.ReportAllocs()
  for i := 0; i < b.N; i++ {
    engine := NewEngine(rules)
    engine.SetSerial(true)
    _ = engine.Run(files, nil)
  }
}

// parseBenchTSFile mirrors `parseTSFile` for benchmark callers,
// calling the parser directly so it does not depend on *testing.T.
func parseBenchTSFile(b *testing.B, fileName, source string) *shimast.SourceFile {
  b.Helper()
  opts := shimast.SourceFileParseOptions{FileName: fileName}
  file := shimparser.ParseSourceFile(opts, source, shimcore.ScriptKindTS)
  if file == nil {
    b.Fatalf("parser returned nil source file")
  }
  return file
}

// engineBenchSource returns a synthetic TS source mixing the AST
// patterns the lint rules in the bench fixtures (rxjs / vue)
// actually fire on. The body is repeated to amortize parser cost
// across enough nodes that lint dispatch dominates the timing.
func engineBenchSource() string {
  const block = `
var legacyOne = 1;
var legacyTwo = 2;
let mutableValue = 3;
let alsoMutable = legacyOne + legacyTwo;
mutableValue = alsoMutable;

const objLiteralOne = {
  foo: foo,
  bar: bar,
  baz,
  qux: function () { return 1; },
};
const objLiteralTwo = { ...objLiteralOne, extra: extra };

if (legacyOne == legacyTwo) {
  legacyOne = legacyTwo;
}
if (legacyOne != legacyTwo) {
  legacyTwo = legacyOne;
}

const ternaryOne = legacyOne ? true : false;
const ternaryTwo = legacyOne > legacyTwo ? legacyOne : legacyTwo;
const ternaryThree = legacyOne ? legacyTwo : legacyOne;

const concatOne = "hello " + name + "!";
const concatTwo = "a" + "b" + name + "c";
const concatThree = name + " says " + greeting;

const { foo: foo, bar: bar, baz: bazRenamed } = objLiteralOne;
const renamedExport = objLiteralOne["bar"];
const dotAccess = objLiteralOne["foo"];
const bracketKey = objLiteralOne["complex-key"];

const boolean1 = !!legacyOne;
const boolean2 = Boolean(legacyTwo);
if (!!objLiteralOne) {
  doSomething();
}
const escaped = "a\\.b";
const escapedTwo = /[a\\b]/g;

const literalCheck = "abc" as const;
const literalUnion = "def" as "def";

namespace LegacyMod {
  export const value = 1;
}
module LegacyMod2 {
  export const value = 2;
}

function example(a: number, b: number) {
  return a + b;
}

class Worker {
  private value: number;
  public name: string;
  constructor(value: number, name: string) {
    this.value = value;
    this.name = name;
  }
  public run(): number {
    return this.value;
  }
}

for (let i = 0; i < items.length; i++) {
  void items[i];
}

const reducer = arr.reduce((a, b) => a + b, 0);
const mapped = arr.map((x) => x.id);
const filtered = arr.filter((x) => x.active);

`
  return strings.Repeat(block, 8)
}

// engineBenchIdentifierSource returns a source dominated by simple
// identifier-bearing declarations and member access, so per-identifier
// rule work (lowercasing, dictionary lookup) is the hot path.
func engineBenchIdentifierSource() string {
  const decl = `
const a${i} = 1;
const b${i} = a${i};
const result${i} = a${i} + b${i};
let temp${i} = result${i};
const obj${i} = { val: a${i}, other: b${i}, derived: temp${i} };
function fn${i}(arg: number) { return arg + a${i}; }
`
  var sb strings.Builder
  for i := 0; i < 60; i++ {
    s := strings.ReplaceAll(decl, "${i}", repeatRune('A'+rune(i%26), 1)+digitsFor(i))
    sb.WriteString(s)
  }
  // Sprinkle some abbreviation-likely names (idx, ctx, ret, …) that
  // `unicorn/prevent-abbreviations` should detect once enabled.
  sb.WriteString(`
function ctxHandler(ctx: any, idx: number, ret: any, opts: any) {
  const tmp = ctx;
  const obj = ret;
  const cfg = opts;
  return { tmp, obj, cfg, idx };
}
`)
  return sb.String()
}

func repeatRune(r rune, n int) string {
  return strings.Repeat(string(r), n)
}

func digitsFor(i int) string {
  if i < 10 {
    return string(rune('0' + i))
  }
  return string(rune('0'+i/10)) + string(rune('0'+i%10))
}

// engineBenchUnicornSource adds unicorn-rule-triggering patterns:
// arrays' .forEach / .reduce, classical for-loops, manual Math.log
// rewrites, .indexOf existence checks, string concat collapse
// candidates, etc.
func engineBenchUnicornSource() string {
  const block = `
declare const arr: number[];
declare const str: string;

arr.forEach((value) => { useValue(value); });
const sum = arr.reduce((acc, value) => acc + value, 0);
for (let i = 0; i < arr.length; i++) { void arr[i]; }

if (arr.indexOf(target) !== -1) {}
if (arr.indexOf(target) === -1) {}
if (arr.indexOf(target) < 0) {}
if (arr.indexOf(target) >= 0) {}

const log10 = Math.log(value) * Math.LOG10E;
const log2 = Math.log(value) * Math.LOG2E;
const minVal = arr[0] < arr[1] ? arr[0] : arr[1];
const truncated = parseInt(strNumber, 10);

const lastOne = arr[arr.length - 1];
const lastTwo = arr[arr.length - 2];

const fromNew = new Array(5);
const setEmpty = new Set([]);

const concat = "prefix " + str + " suffix";

try { run(); } catch (e) { console.error(e); }
try { run(); } catch (error) {}

const replaced = "hello world".replace(/world/g, "ttsc");

const negated = !!flag === true;
const condTernary = isReady ? doIt() : !isReady ? skip() : fallback();
`
  return strings.Repeat(block, 4)
}
