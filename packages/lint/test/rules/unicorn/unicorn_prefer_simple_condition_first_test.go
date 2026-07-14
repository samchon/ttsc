package linthost

import (
  "strings"
  "testing"
)

const preferSimpleConditionFirstRule = "unicorn/prefer-simple-condition-first"

func TestRuleCorpusUnicornPreferSimpleConditionFirst(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-simple-condition-first.ts", `declare const ready: boolean;
declare function check(): boolean;

if (
  check() &&
  // expect: unicorn/prefer-simple-condition-first error
  ready
) {
  void 0;
}

if (ready && check()) {
  void 0;
}
`)
}

func TestUnicornPreferSimpleConditionFirstReportsExactSafeFindingAndStableFix(t *testing.T) {
  source := `declare const gate: boolean;
declare const ready: boolean;
declare const kind: unknown;
if ((gate ? true : false) && ready && typeof kind === "string") {
  void 0;
}
`
  _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, source, nil)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  ready := strings.LastIndex(source, "ready")
  if finding.Pos != ready || finding.End != ready+len("ready") {
    t.Fatalf("range: want [%d,%d), got [%d,%d)", ready, ready+len("ready"), finding.Pos, finding.End)
  }
  wantMessage := "Prefer this simple condition first in the `&&` expression."
  if finding.Message != wantMessage {
    t.Fatalf("message: want %q, got %q", wantMessage, finding.Message)
  }
  if len(finding.Fix) != 1 {
    t.Fatalf("want one fix edit, got %+v", finding.Fix)
  }
  edit := finding.Fix[0]
  expression := `(gate ? true : false) && ready && typeof kind === "string"`
  start := strings.Index(source, expression)
  if edit.Pos != start || edit.End != start+len(expression) {
    t.Fatalf("edit range: want [%d,%d), got [%d,%d)", start, start+len(expression), edit.Pos, edit.End)
  }
  wantEdit := `ready && (typeof kind === "string") && (gate ? true : false)`
  if edit.Text != wantEdit {
    t.Fatalf("edit text: want %q, got %q", wantEdit, edit.Text)
  }

  expected := strings.Replace(source, expression, wantEdit, 1)
  fixed, count := runFixSnapshot(t, preferSimpleConditionFirstRule, source)
  if count != 1 || fixed != expected {
    t.Fatalf("fix: want count=1 and %q, got count=%d and %q", expected, count, fixed)
  }
  _, _, after := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, fixed, nil)
  if len(after) != 0 {
    t.Fatalf("second pass must be idempotent, got %+v", after)
  }
}

func TestUnicornPreferSimpleConditionFirstUsesCanonicalSimpleExpressionGrammar(t *testing.T) {
  valid := `declare const ready: boolean;
declare const value: unknown;
declare const count: number;
declare const big: bigint;
declare const pattern: RegExp;
declare function check(): boolean;
if (ready && check()) { void 0; }
if (!ready && check()) { void 0; }
if (!!ready && check()) { void 0; }
if (typeof value === "string" && check()) { void 0; }
if (count === +1 && check()) { void 0; }
if (count !== -1 && check()) { void 0; }
if (big === -1n && check()) { void 0; }
if (pattern === /x/ && check()) { void 0; }
if ((ready as boolean) && check()) { void 0; }
if ((<boolean>ready) && check()) { void 0; }
if ((ready satisfies boolean) && check()) { void 0; }
`
  assertRuleSkipsSource(t, preferSimpleConditionFirstRule, valid)

  cases := []struct {
    name   string
    source string
  }{
    {
      name:   "loose equality is complex",
      source: "declare const ready: boolean; declare const value: unknown; declare function check(): boolean; if (check() && value == 1 && ready) { void 0; }",
    },
    {
      name:   "literal-only comparison is complex",
      source: "declare const ready: boolean; declare function check(): boolean; if (check() && 1 === 1 && ready) { void 0; }",
    },
    {
      name:   "template literal is not an ESTree literal",
      source: "declare const ready: boolean; declare const value: unknown; declare function check(): boolean; if (check() && value === `x` && ready) { void 0; }",
    },
    {
      name:   "positive bigint is not a supported signed operand",
      source: "declare const ready: boolean; declare const value: bigint; declare function check(): boolean; if (check() && value === +1n && ready) { void 0; }",
    },
    {
      name:   "property access is complex",
      source: "declare const ready: boolean; declare const value: { ok: boolean }; declare function check(): boolean; if (check() && value.ok && ready) { void 0; }",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, test.source, nil)
      if len(findings) != 1 {
        t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
      }
      if findings[0].Message != unicornPreferSimpleConditionFirstUnsafeMessage || len(findings[0].Fix) != 0 {
        t.Fatalf("want unsafe diagnostic without fix, got %+v", findings[0])
      }
    })
  }
}

func TestUnicornPreferSimpleConditionFirstRestrictsReportsToBooleanContexts(t *testing.T) {
  ignored := `declare const ready: boolean;
declare function check(): boolean;
declare function consume(value: unknown): void;
const assigned = check() && ready;
consume(check() && ready);
const tuple = [check() && ready];
function value() { return check() && ready; }
void assigned;
void tuple;
void value;
`
  assertRuleSkipsSource(t, preferSimpleConditionFirstRule, ignored)

  contexts := []struct {
    name   string
    source string
  }{
    {"if", "if (check() && ready) { void 0; }"},
    {"while", "while (check() && ready) { break; }"},
    {"do while", "do { void 0; } while (check() && ready);"},
    {"for", "for (; check() && ready;) { break; }"},
    {"ternary test", "const value = check() && ready ? 1 : 0; void value;"},
    {"logical negation", "const value = !(check() && ready); void value;"},
    {"nested logical context", "if ((check() && ready) || other) { void 0; }"},
    {"global Boolean", "const value = Boolean(check() && ready); void value;"},
  }
  declarations := "declare const ready: boolean; declare const other: boolean; declare function check(): boolean; "
  for _, test := range contexts {
    t.Run(test.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, declarations+test.source, nil)
      if len(findings) != 1 {
        t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
      }
    })
  }

  shadowed := `declare const ready: boolean;
declare function check(): boolean;
function convert(Boolean: (value: unknown) => boolean) {
  return Boolean(check() && ready);
}
void convert;
`
  assertRuleSkipsSource(t, preferSimpleConditionFirstRule, shadowed)
}

func TestUnicornPreferSimpleConditionFirstWithholdsUnsafeAndSyntaxOwnedFixes(t *testing.T) {
  cases := []struct {
    name        string
    expression  string
    safeMessage bool
  }{
    {"call may short circuit", "check() && ready", false},
    {"member access may invoke a getter", "record.enabled && ready", false},
    {"optional access changes evaluation", "record?.enabled && ready", false},
    {"unsafe conditional branch", "(ready ? check() : false) && other", false},
    {"inner comment owns source", "(ready ? true : false) && /* keep */ other", true},
    {"trailing comment owns source", "(ready ? true : false) && other /* keep */", true},
    {"typescript wrapper owns a logical subchain", "(((ready ? true : false) && other) as boolean) && final", true},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      source := `declare const ready: boolean;
declare const other: boolean;
declare const final: boolean;
declare const record: { enabled?: boolean };
declare function check(): boolean;
if (` + test.expression + `) { void 0; }
`
      _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, source, nil)
      if len(findings) != 1 {
        t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
      }
      finding := findings[0]
      wantMessage := unicornPreferSimpleConditionFirstUnsafeMessage
      if test.safeMessage {
        wantMessage = "Prefer this simple condition first in the `&&` expression."
      }
      if finding.Message != wantMessage || len(finding.Fix) != 0 {
        t.Fatalf("want %q without fix, got %+v", wantMessage, finding)
      }
    })
  }
}

func TestUnicornPreferSimpleConditionFirstParserAwareCommentsDoNotMistakeLiteralText(t *testing.T) {
  source := `declare const ready: boolean;
declare const other: boolean;
if ((ready ? "//" : "/*") && other) { void 0; }
`
  expected := `declare const ready: boolean;
declare const other: boolean;
if (other && (ready ? "//" : "/*")) { void 0; }
`
  assertFixSnapshot(t, preferSimpleConditionFirstRule, source, expected)
}

func TestUnicornPreferSimpleConditionFirstPreservesMixedOperatorsAndParentheses(t *testing.T) {
  source := `declare const a: boolean;
declare const b: boolean;
declare const c: boolean;
if ((a || b) && c) { void 0; }
`
  _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, source, nil)
  if len(findings) != 1 {
    t.Fatalf("want one outer-chain finding, got %d (%+v)", len(findings), findings)
  }
  if findings[0].Message != unicornPreferSimpleConditionFirstUnsafeMessage || len(findings[0].Fix) != 0 {
    t.Fatalf("mixed logical operand must remain diagnostic-only, got %+v", findings[0])
  }
}
