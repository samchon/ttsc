package linthost

import (
  "testing"

  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// TestRuleCorpusUnicornNoUnusedProperties verifies the lint rule corpus
// fixture unicorn-no-unused-properties.ts through the type-aware engine path.
//
// The rule resolves references with the TypeScript checker, so the plain
// assertRuleCorpusCase helper (which runs without a Program) can never see
// its findings. This twin runs the exact corpus source through the real
// Program/checker lifecycle and pins the same three diagnostics the
// TypeScript feature runner asserts end-to-end: an unused object property,
// an unused property of a nested object, and an unused member of an inline
// parameter type literal.
//
//  1. Materialize the corpus fixture source in a strict project.
//  2. Run unicorn/no-unused-properties through loadProgram + runLintCycle.
//  3. Assert the reported lines match the fixture's `// expect:` targets.
func TestRuleCorpusUnicornNoUnusedProperties(t *testing.T) {
  engine := NewEngine(RuleConfig{"unicorn/no-unused-properties": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("unicorn/no-unused-properties did not request a type checker")
  }

  source := `export {};

const settings = {
  timeout: 1_000,
  // expect: unicorn/no-unused-properties error
  retries: 3,
  limits: {
    depth: 4,
    // expect: unicorn/no-unused-properties error
    breadth: 5,
  },
};
console.log(settings.timeout, settings.limits.depth);

// Negative twin: every property is read, so nothing is reported.
const used = { first: 1, second: 2 };
console.log(used.first, used["second"]);

// Negative: a dynamic key access can reach any property.
declare const anyKey: keyof { alpha: 1; beta: 2 };
const dynamic = { alpha: 1, beta: 2 };
console.log(dynamic[anyKey]);

// Negative: the object escapes as a call argument.
const escaped = { gamma: 1, delta: 2 };
console.log(escaped);

function report(args: {
  wanted: number;
  // expect: unicorn/no-unused-properties error
  ignored: number;
}): number {
  return args.wanted;
}
void report({ wanted: 1, ignored: 2 });
`

  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/no-unused-properties", source, nil)
  expectedLines := []int{6, 10, 31}
  if len(findings) != len(expectedLines) {
    t.Fatalf("want %d findings, got %d: %+v", len(expectedLines), len(findings), findings)
  }
  for index, finding := range findings {
    line := shimscanner.GetECMALineOfPosition(finding.File, finding.Pos) + 1
    if finding.Rule != "unicorn/no-unused-properties" || finding.Severity != SeverityError ||
      line != expectedLines[index] {
      t.Fatalf("finding %d: want line %d, got line %d (%+v)", index, expectedLines[index], line, finding)
    }
  }
}
