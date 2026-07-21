package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrettierConformance verifies every registered format rule has a
// real formatter corpus case checked against the pinned Prettier module.
//
// A rule-local expectation can prove that a rule fired without proving its
// output agrees with the formatter it claims to mirror. The corpus is keyed by
// rule name and compared through the native disk-backed fix path, so adding a format rule
// without an oracle witness fails this test. Every ordinary case must make
// Prettier change the source; a canonical input cannot prove a formatter path
// ran. The two documented ttsc-only extensions (`jsDoc` and `sortImports`) are
// intentionally marked as canonical because core Prettier has no equivalent
// option to use as their oracle. A true Prettier no-op (such as
// quoteProps:"preserve") is marked the same way, but its rule must still have
// another changing witness.
//
//  1. Match the conformance corpus against the registered format-rule set.
//  2. Format each source through pinned Prettier 3.8.3.
//  3. Translate the public `format` block through expandFormatBlock, then run
//     only that rule through ttsc's native disk-backed fixer.
//  4. Require byte equality, without letting a sibling rule's known divergence
//     obscure the rule being measured.
func TestFormatPrettierConformance(t *testing.T) {
  cases := []prettierConformanceCase{
    {"format/arrow-parens", "default", "const identity = value => value;\n", nil, false},
    {"format/arrow-parens", "avoid", "const identity = (value) => value;\n", map[string]any{"arrowParens": "avoid"}, false},
    {"format/bracket-spacing", "mapped-type", "type Picked = {[Key in keyof Source]: Source[Key]};\n", nil, false},
    {"format/bracket-spacing", "import-attributes", "import data from \"data\" with {type: \"json\"};\n", nil, false},
    {"format/bracket-spacing", "bindings-and-clauses", "import {read, write} from \"module\";\nexport {read, write};\nconst {value} = source;\ntype Shape = {value: string};\n", nil, false},
    {"format/bracket-spacing", "disabled", "const value = { item: 1 };\n", map[string]any{"bracketSpacing": false}, false},
    {"format/clause-join", "control-flow", "if (ready)\n  run();\nwhile (ready)\n  tick();\nfor (let i = 0; i < count; i++)\n  visit(i);\nfor (const item of items)\n  visit(item);\nfor (const key in record)\n  visit(key);\n", nil, false},
    {"format/declaration-header", "interface", "interface Result\nextends Base {}\n", nil, false},
    {"format/declaration-header", "class", "class Result\nextends Base {}\n", nil, false},
    {"format/declaration-header", "multi-type-width", "interface Result extends First, Second, Third, Fourth, Fifth, Sixth {\n  value: number;\n}\n", map[string]any{"printWidth": 50}, false},
    {"format/indent", "tab-width", "function value() {\n        return 1;\n}\n", map[string]any{"tabWidth": 4}, false},
    {"format/indent", "tabs", "function value() {\n    return 1;\n}\n", map[string]any{"useTabs": true}, false},
    {"format/jsdoc", "extension-canonical", "/**\n * @returns A value.\n */\nfunction value(): number {\n  return 1;\n}\n", map[string]any{"jsDoc": true}, true},
    {"format/orphan-semi", "asi-guard", "// guard\n;\n(bar as Baz).qux()\n", map[string]any{"semi": false}, false},
    {"format/parameter-properties", "multiple-properties", "class Value {\n  constructor(private first: First, public second: Second) {}\n}\n", map[string]any{"trailingComma": "none"}, false},
    {"format/print-width", "object", "const value = { first: 1, second: 2, third: 3 };\n", map[string]any{"printWidth": 20}, false},
    {"format/print-width", "array", "const values = [first, second, third];\n", map[string]any{"printWidth": 20}, false},
    {"format/print-width", "call", "process(aaaaaa, bbbbbb, cccccc);\n", map[string]any{"printWidth": 24}, false},
    {"format/print-width", "new", "new Factory(aaaaaa, bbbbbb, cccccc);\n", map[string]any{"printWidth": 20}, false},
    {"format/print-width", "named-import", "import { alpha, bravo, charlie } from \"module\";\n", map[string]any{"printWidth": 30}, false},
    {"format/print-width", "named-export", "export { alpha, bravo, charlie };\n", map[string]any{"printWidth": 20}, false},
    {"format/print-width", "conditional", "const result = aaaaaaaaaa ? bbbbbbbbbb ? cccccccccc : dddddddddd : eeeeeeeeee;\n", map[string]any{"printWidth": 40}, false},
    // Well under printWidth on purpose: Prettier breaks a non-empty block
    // unconditionally, so this row proves the rule against the oracle for a
    // case width alone can never explain.
    {"format/print-width", "expression-nested-block", "run(() => { a(); b(); });\n", nil, false},
    {"format/quote-props", "consistent-object", "const value = { first: 1, \"second-value\": 2 };\n", map[string]any{"quoteProps": "consistent"}, false},
    {"format/quote-props", "class-method", "class Value {\n  \"method\"(): void {}\n}\n", nil, false},
    {"format/quote-props", "class-expression-and-types", "const Value = class {\n  \"method\"(): void {}\n};\ninterface Shape {\n  \"value\": string;\n}\ntype Alias = {\n  \"name\": string;\n};\n", nil, false},
    {"format/quote-props", "preserve-canonical", "const value = { \"item\": 1 };\n", map[string]any{"quoteProps": "preserve"}, true},
    {"format/quotes", "single-quote", "const value = \"text\";\n", map[string]any{"singleQuote": true}, false},
    {"format/quotes", "double-quote", "const value = 'text';\n", nil, false},
    {"format/semi", "all-asi-terminators", "import value from \"value\"\nimport required = require(\"required\")\nexport * from \"all\"\nexport = value\nlet count = 1\ntype Count = number\nclass Value {\n  field = 1;\n  get value(): number {\n    return this.field;\n  }\n  set value(next: number) {\n    this.field = next;\n  }\n}\ninterface Shape {\n  value: string;\n  method(): void;\n  [key: string]: string;\n  (): void;\n  new (): Shape;\n}\nJSON.stringify(count)\nfunction loop() {\n  do {} while (false)\n  for (;;) {\n    break\n  }\n  for (;;) {\n    continue\n  }\n  return 1\n  throw 1\n}\ndebugger\n", nil, false},
    {"format/semi", "disabled", "const value = 1;\n", map[string]any{"semi": false}, false},
    {"format/sort-imports", "extension-canonical", "import { alpha, beta } from \"module\";\n", map[string]any{"sortImports": true}, true},
    {"format/statement-split", "same-line-statements", "const first = 1; const second = 2;\n", nil, false},
    {"format/ternary-nullish-parens", "all-positions", "const value = first ?? second ? third ?? fourth : fifth ?? sixth;\n", nil, false},
    {"format/trailing-comma", "es5-type-level", "enum Values {\n  Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n}\ntype Pair = [\n  Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n];\nfunction pair<\n  Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n>() {}\n", map[string]any{"printWidth": 40, "trailingComma": "es5"}, false},
    {"format/trailing-comma", "none-removes", "const values = [\n  Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,\n];\ncallWithLongName(\n  Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,\n);\n", map[string]any{"printWidth": 40, "trailingComma": "none"}, false},
    {"format/trailing-comma", "all-governed-list-kinds", "const object = {\n  firstProperty: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  secondProperty: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n};\nnew ConstructorWithLongName(\n  Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n);\nimport {\n  Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n} from \"module\";\nexport {\n  Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n};\nconst expression = function (\n  firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n) {};\nconst arrow = (\n  firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n) => {};\nclass Value {\n  method(\n    firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n    secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n  ) {}\n  constructor(\n    firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n    secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n  ) {}\n  get value() {\n    return this.stored;\n  }\n  set value(nextParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) {}\n}\ninterface Shape {\n  method(\n    firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n    secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n  ): void;\n  (\n    firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n    secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n  ): void;\n  new (\n    firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n    secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n  ): Shape;\n}\ntype Callable = (\n  firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n) => void;\ntype Constructable = new (\n  firstParameter: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n  secondParameter: Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n) => Shape;\n", map[string]any{"printWidth": 80, "trailingComma": "all"}, false},
    {"format/whitespace", "crlf", "const value = 1;\n", map[string]any{"endOfLine": "crlf"}, false},
    {"format/whitespace", "default", "const value = 1; ", nil, false},
  }
  assertPrettierConformanceCorpusCoversFormatRules(t, cases)
  for _, testCase := range cases {
    testCase := testCase
    t.Run(testCase.rule+"/"+testCase.name, func(t *testing.T) {
      format := normalizePrettierFormatOptions(testCase.format)
      want := formatWithPinnedPrettier(t, testCase.source, format)
      if testCase.prettierCanonical {
        if want != testCase.source {
          t.Fatalf("%s/%s must be canonical for Prettier: got %q", testCase.rule, testCase.name, want)
        }
      } else if want == testCase.source {
        t.Fatalf("%s/%s is already Prettier-canonical; add a real oracle witness", testCase.rule, testCase.name)
      }
      got := formatOneRuleWithResolvedFormatOptions(t, testCase.rule, testCase.source, format)
      if got != want {
        t.Fatalf("%s/%s result mismatch:\nwant %q\ngot  %q", testCase.rule, testCase.name, want, got)
      }
    })
  }
}

type prettierConformanceCase struct {
  rule              string
  name              string
  source            string
  format            map[string]any
  prettierCanonical bool
}

func normalizePrettierFormatOptions(format map[string]any) map[string]any {
  if format != nil {
    return format
  }
  return map[string]any{}
}

func assertPrettierConformanceCorpusCoversFormatRules(t *testing.T, cases []prettierConformanceCase) {
  t.Helper()
  covered := make(map[string]struct{}, len(cases))
  witnessed := make(map[string]bool, len(cases))
  visitCoverage := make(map[string]map[shimast.Kind]struct{}, len(cases))
  namedCases := make(map[string]struct{}, len(cases))
  for _, testCase := range cases {
    if testCase.rule == "" || testCase.name == "" {
      t.Fatalf("Prettier conformance cases require both rule and name: %+v", testCase)
    }
    key := testCase.rule + "/" + testCase.name
    if _, exists := namedCases[key]; exists {
      t.Fatalf("duplicate Prettier conformance case %q", key)
    }
    namedCases[key] = struct{}{}
    covered[testCase.rule] = struct{}{}
    if !testCase.prettierCanonical {
      witnessed[testCase.rule] = true
    }
    kinds := visitCoverage[testCase.rule]
    if kinds == nil {
      kinds = make(map[shimast.Kind]struct{})
      visitCoverage[testCase.rule] = kinds
    }
    for kind := range sourceNodeKinds(t, testCase.source) {
      kinds[kind] = struct{}{}
    }
  }
  var registeredNames []string
  for _, name := range AllRuleNames() {
    rule := LookupRule(name)
    if rule != nil && strings.HasPrefix(name, "format/") && isFormatRule(rule) {
      registeredNames = append(registeredNames, name)
    }
  }
  sort.Strings(registeredNames)
  var missing, missingWitness, missingVisits, unknown []string
  for _, name := range registeredNames {
    if _, exists := covered[name]; !exists {
      missing = append(missing, name)
      continue
    }
    if !witnessed[name] && !formatRuleHasNoPrettierOracle(name) {
      missingWitness = append(missingWitness, name)
    }
    for _, kind := range LookupRule(name).Visits() {
      if _, found := visitCoverage[name][kind]; !found {
        missingVisits = append(missingVisits, fmt.Sprintf("%s:%d", name, kind))
      }
    }
  }
  for name := range covered {
    if rule := LookupRule(name); rule == nil || !strings.HasPrefix(name, "format/") || !isFormatRule(rule) {
      unknown = append(unknown, name)
    }
  }
  sort.Strings(unknown)
  if len(missing) > 0 || len(missingWitness) > 0 || len(missingVisits) > 0 || len(unknown) > 0 {
    t.Fatalf("Prettier conformance corpus mismatch: missing=%v missingWitness=%v missingVisits=%v unknown=%v", missing, missingWitness, missingVisits, unknown)
  }
}

func formatRuleHasNoPrettierOracle(name string) bool {
  return name == "format/jsdoc" || name == "format/sort-imports"
}

// sourceNodeKinds walks a parsed corpus source and returns every node kind it
// actually contains. The registry check above makes a new `Visits()` kind a
// test failure until a real oracle case contains that syntax.
func sourceNodeKinds(t *testing.T, source string) map[shimast.Kind]struct{} {
  t.Helper()
  kinds := make(map[shimast.Kind]struct{})
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil {
      return
    }
    kinds[node.Kind] = struct{}{}
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(parseTS(t, source).AsNode())
  return kinds
}

func formatWithPinnedPrettier(t *testing.T, source string, format map[string]any) string {
  t.Helper()
  module := os.Getenv("TTSC_PRETTIER_MODULE")
  if module == "" {
    t.Fatal("TTSC_PRETTIER_MODULE is required for the Prettier conformance corpus")
  }
  input, err := json.Marshal(struct {
    Source string         `json:"source"`
    Format map[string]any `json:"format"`
  }{Source: source, Format: format})
  if err != nil {
    t.Fatalf("marshal Prettier input: %v", err)
  }
  script := `
import { pathToFileURL } from "node:url";
const input = JSON.parse(process.argv[1]);
const module = await import(pathToFileURL(process.env.TTSC_PRETTIER_MODULE).href);
const prettier = module.default ?? module;
process.stdout.write(await prettier.format(input.source, { parser: "typescript", ...input.format }));
`
  command := exec.Command("node", "--input-type=module", "--eval", script, string(input))
  command.Env = os.Environ()
  output, err := command.Output()
  if err != nil {
    var stderr strings.Builder
    if exitError, ok := err.(*exec.ExitError); ok {
      stderr.Write(exitError.Stderr)
    }
    t.Fatalf("pinned Prettier failed: %v\n%s", err, stderr.String())
  }
  if len(output) == 0 {
    t.Fatal("pinned Prettier returned an empty result")
  }
  return string(output)
}

// formatOneRuleWithResolvedFormatOptions resolves the same public format block
// users configure, then applies only `ruleName`. Per-rule execution is
// deliberate: #856 owns whole-file fixed-point formatting, while this harness
// must identify which format rule differs from the pinned Prettier oracle.
func formatOneRuleWithResolvedFormatOptions(
  t *testing.T,
  ruleName string,
  source string,
  format map[string]any,
) string {
  t.Helper()
  expanded, err := expandFormatBlock(format)
  if err != nil {
    t.Fatalf("expand format options for %s: %v", ruleName, err)
  }
  entry, ok := expanded[ruleName]
  if !ok {
    t.Fatalf("format block did not enable %s", ruleName)
  }
  values, ok := entry.([]any)
  if !ok || len(values) != 2 {
    t.Fatalf("invalid expanded format entry for %s: %#v", ruleName, entry)
  }
  options, err := json.Marshal(values[1])
  if err != nil {
    t.Fatalf("marshal resolved options for %s: %v", ruleName, err)
  }

  root, filePath, findings := runRuleFindingsSnapshot(t, ruleName, source, options)
  if len(findings) > 0 {
    if _, err := applyFindingFixes(root, findings); err != nil {
      t.Fatalf("apply %s fixes: %v", ruleName, err)
    }
  }
  output, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("read %s result: %v", ruleName, err)
  }
  return string(output)
}
