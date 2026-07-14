package linthost

import (
  "strings"
  "testing"
)

// TestUnicornNoUnusedPropertiesReportingShape verifies the exact diagnostic
// surface: the reported range covers the whole property node, the message
// interpolates the resolved key (or the computed key's source text), and no
// autofix or suggestion is offered, mirroring upstream's fix-free rule.
//
// Range checks pin the node choice itself — upstream reports the property,
// not just its key — including a type-literal member whose trailing
// semicolon belongs to the member node, exactly as in typescript-eslint.
//
//  1. Declare one unused property per member kind: assignment, shorthand,
//     method, computed key, and an inline parameter type member.
//  2. Run the rule through the real Program/checker lifecycle.
//  3. Assert each finding's [Pos, End) range, message, and empty edit set.
func TestUnicornNoUnusedPropertiesReportingShape(t *testing.T) {
  // The raw literal below picks up CRLF on autocrlf checkouts while the
  // expectation needles spell "\n"; normalize so both use one representation.
  source := `export {};
declare function consume(...values: unknown[]): void;
declare const outer: { key: string };

const short = 1;
const subject = {
  used: 1,
  droppedValue: 2,
  short,
  droppedMethod() {
    return 3;
  },
  [outer.key]: 4,
};
consume(subject.used);

function typed(args: { wanted: number; ignored: number; }): number {
  return args.wanted;
}
consume(typed);
`
  source = strings.ReplaceAll(source, "\r\n", "\n")
  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/no-unused-properties", source, nil)
  type expectation struct {
    text    string
    message string
  }
  expectations := []expectation{
    {"droppedValue: 2", "Property `droppedValue` is defined but never used."},
    {"short,", "Property `short` is defined but never used."},
    {"droppedMethod() {\n    return 3;\n  }", "Property `droppedMethod` is defined but never used."},
    {"[outer.key]: 4", "Property `outer.key` is defined but never used."},
    {"ignored: number;", "Property `ignored` is defined but never used."},
  }
  if len(findings) != len(expectations) {
    t.Fatalf("want %d findings, got %d: %+v", len(expectations), len(findings), findings)
  }
  for index, finding := range findings {
    want := expectations[index]
    text := want.text
    if strings.HasSuffix(text, ",") {
      text = strings.TrimSuffix(text, ",")
    }
    start := strings.Index(source, want.text)
    if start < 0 {
      t.Fatalf("expectation %d text %q not in source", index, want.text)
    }
    if finding.Pos != start || finding.End != start+len(text) {
      t.Fatalf(
        "finding %d range: want [%d,%d) for %q, got [%d,%d) covering %q",
        index, start, start+len(text), text, finding.Pos, finding.End,
        source[finding.Pos:finding.End],
      )
    }
    if finding.Message != want.message {
      t.Fatalf("finding %d message: want %q, got %q", index, want.message, finding.Message)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d must not offer edits: %+v", index, finding)
    }
  }
}
