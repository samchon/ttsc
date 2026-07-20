package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "sort"
  "strings"
  "testing"
)

// TestFormatPrettierConformance verifies every registered format rule has a
// real `ttsc format` corpus case checked against the pinned Prettier module.
//
// A rule-local expectation can prove that a rule fired without proving its
// output agrees with the formatter it claims to mirror. The corpus is keyed by
// rule name and compared through the real command, so adding a format rule
// without an oracle witness fails this test.
//
// 1. Match the conformance corpus against the registered format-rule set.
// 2. Format each source through pinned Prettier 3.8.3.
// 3. Run `ttsc format` over the same source and require byte equality.
func TestFormatPrettierConformance(t *testing.T) {
  cases := []prettierConformanceCase{
    {"format/arrow-parens", "const identity = (value) => value;\n", nil},
    {"format/bracket-spacing", "const value = { item: 1 };\n", nil},
    {"format/clause-join", "if (ready) {\n  run();\n} else {\n  stop();\n}\n", nil},
    {"format/declaration-header", "interface Result {\n  value: string;\n}\n", nil},
    {"format/indent", "if (ready) {\n  run();\n}\n", nil},
    {"format/jsdoc", "/**\n * Returns a value.\n */\nfunction value(): number {\n  return 1;\n}\n", nil},
    {"format/orphan-semi", "const value = 1;\n", nil},
    {"format/parameter-properties", "class Value {\n  constructor(readonly value: string) {}\n}\n", nil},
    {"format/print-width", "const values = [1, 2, 3];\n", nil},
    {"format/quote-props", "const value = { \"item\": 1 };\n", nil},
    {"format/quotes", "const value = \"text\";\n", nil},
    {"format/semi", "const value = 1;\n", nil},
    {"format/sort-imports", "import { alpha, beta } from \"module\";\n", nil},
    {"format/statement-split", "const first = 1;\nconst second = 2;\n", nil},
    {"format/ternary-nullish-parens", "const value = left ?? (ready ? first : second);\n", nil},
    {"format/trailing-comma", "const values = [\n  first,\n  second,\n];\n", nil},
    {"format/whitespace", "const value = 1;\n", nil},
  }
  assertPrettierConformanceCorpusCoversFormatRules(t, cases)
  for _, testCase := range cases {
    testCase := testCase
    t.Run(testCase.rule, func(t *testing.T) {
      want := formatWithPinnedPrettier(t, testCase.source, testCase.format)
      assertFormatResultWithFormat(t, testCase.source, want, testCase.format)
    })
  }
}

type prettierConformanceCase struct {
  rule   string
  source string
  format map[string]any
}

func assertPrettierConformanceCorpusCoversFormatRules(t *testing.T, cases []prettierConformanceCase) {
  t.Helper()
  covered := make(map[string]struct{}, len(cases))
  for _, testCase := range cases {
    if _, exists := covered[testCase.rule]; exists {
      t.Fatalf("duplicate Prettier conformance case for %q", testCase.rule)
    }
    covered[testCase.rule] = struct{}{}
  }
  var registeredNames []string
  for _, name := range AllRuleNames() {
    rule := LookupRule(name)
    if rule != nil && isFormatRule(rule) {
      registeredNames = append(registeredNames, name)
    }
  }
  sort.Strings(registeredNames)
  var missing, unknown []string
  for _, name := range registeredNames {
    if _, exists := covered[name]; !exists {
      missing = append(missing, name)
    }
  }
  for name := range covered {
    if rule := LookupRule(name); rule == nil || !isFormatRule(rule) {
      unknown = append(unknown, name)
    }
  }
  sort.Strings(unknown)
  if len(missing) > 0 || len(unknown) > 0 {
    t.Fatalf("Prettier conformance corpus mismatch: missing=%v unknown=%v", missing, unknown)
  }
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
const { format } = await import(pathToFileURL(process.env.TTSC_PRETTIER_MODULE).href);
process.stdout.write(await format(input.source, { parser: "typescript", ...input.format }));
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

func (c prettierConformanceCase) String() string {
  return fmt.Sprintf("%s", c.rule)
}
