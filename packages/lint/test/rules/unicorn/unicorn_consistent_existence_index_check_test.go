package linthost

import (
  "strings"
  "testing"
)

// unicornConsistentExistenceIndexCheckMarkedRanges returns the byte ranges
// wrapped by `/*<*/` … `/*>*/` marker pairs in source order. The rule reports
// the `<operator> <right>` slice of a comparison rather than a whole node, so
// the shared identifier-suffix scanner cannot express the expected spans;
// paired markers pin the exact Pos/End of every diagnostic instead. The markers
// are comments, so they are trivia to the parser and never move a token.
func unicornConsistentExistenceIndexCheckMarkedRanges(t *testing.T, source string) [][2]int {
  t.Helper()
  const opening, closing = "/*<*/", "/*>*/"
  ranges := make([][2]int, 0)
  offset := 0
  for {
    begin := strings.Index(source[offset:], opening)
    if begin < 0 {
      return ranges
    }
    start := offset + begin + len(opening)
    length := strings.Index(source[start:], closing)
    if length <= 0 {
      t.Fatalf("marker at byte %d has no closing %q", offset+begin, closing)
    }
    ranges = append(ranges, [2]int{start, start + length})
    offset = start + length + len(closing)
  }
}

// TestRuleCorpusUnicornConsistentExistenceIndexCheck verifies every
// upstream-invalid comparison on a `const` bound to an index-returning call
// reports with the upstream range, message, and autofix.
//
// The rule is scope analysis, not syntax: upstream only ever reaches a
// comparison through the references of a `const` initialized from `indexOf`,
// `lastIndexOf`, `findIndex`, or `findLastIndex`. Pinning all three magnitude
// spellings (`< 0`, `>= 0`, `> -1`) against all four methods, through a closure
// capture, a twice-compared binding, a parenthesized reference, and an exported
// binding (whose declaration is reached through the checker's export symbol),
// locks both the binding resolution and the operator/value table — a name-only
// match or a missing operator arm would show up here immediately.
//
// The initializer arms matter as much: a non-null-asserted receiver and a
// parenthesis-capped optional chain are both plain method calls upstream (the
// `!` is transparent, and the parens end the ChainExpression before the call),
// so they must still report — the negative twin, an uncapped `a?.b.indexOf(x)`,
// lives in the skips case.
//
//  1. Enable unicorn/consistent-existence-index-check on one type-clean source
//     that stacks every upstream-invalid form.
//  2. Mark the expected `<operator> <right>` span of each with `/*<*/ … /*>*/`.
//  3. Assert range, message, and fix edits per finding, in source order, with
//     the replacement operators and values taken from the upstream oracle.
func TestRuleCorpusUnicornConsistentExistenceIndexCheck(t *testing.T) {
  engine := NewEngine(RuleConfig{"unicorn/consistent-existence-index-check": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("unicorn/consistent-existence-index-check did not request a type checker")
  }

  source := `declare const array: number[];
declare const text: string;
declare const collection: {
  indexOf(value: number): number;
  lastIndexOf(value: number): number;
  findIndex(predicate: (value: number) => boolean): number;
  findLastIndex(predicate: (value: number) => boolean): number;
};
declare const nested: { list: { indexOf(value: number): number } };
declare function predicate(value: number): boolean;

const lessThanZero = array.indexOf(1);
void (lessThanZero /*<*/< 0/*>*/);

const atLeastZero = array.indexOf(2);
void (atLeastZero /*<*/>= 0/*>*/);

const aboveMinusOne = array.indexOf(3);
void (aboveMinusOne /*<*/> -1/*>*/);

const lastIndex = collection.lastIndexOf(4);
void (lastIndex /*<*/< 0/*>*/);

const foundIndex = collection.findIndex(predicate);
void (foundIndex /*<*/>= 0/*>*/);

const foundLastIndex = collection.findLastIndex(predicate);
void (foundLastIndex /*<*/> -1/*>*/);

const textIndex = text.indexOf("a");
void (textIndex /*<*/< 0/*>*/);

const captured = array.indexOf(5);
const read = () => captured /*<*/< 0/*>*/;
void read;

const compared = array.indexOf(6);
void (compared /*<*/< 0/*>*/);
void (compared /*<*/>= 0/*>*/);

const parenthesized = array.indexOf(7);
void ((parenthesized) /*<*/< 0/*>*/);

const asserted = array!.indexOf(8);
void (asserted /*<*/< 0/*>*/);

const cappedChain = (nested?.list).indexOf(9);
void (cappedChain /*<*/>= 0/*>*/);

export const exported = array.indexOf(10);
void (exported /*<*/>= 0/*>*/);
`

  // The upstream replacement table, in the order the marked ranges appear.
  // `> -1` already spells the sentinel, so only its operator is edited.
  expectations := []struct {
    originalOperator string
    originalValue    string
    operator         string
  }{
    {originalOperator: "<", originalValue: "0", operator: "==="},
    {originalOperator: ">=", originalValue: "0", operator: "!=="},
    {originalOperator: ">", originalValue: "-1", operator: "!=="},
    {originalOperator: "<", originalValue: "0", operator: "==="},
    {originalOperator: ">=", originalValue: "0", operator: "!=="},
    {originalOperator: ">", originalValue: "-1", operator: "!=="},
    {originalOperator: "<", originalValue: "0", operator: "==="},
    {originalOperator: "<", originalValue: "0", operator: "==="},
    {originalOperator: "<", originalValue: "0", operator: "==="},
    {originalOperator: ">=", originalValue: "0", operator: "!=="},
    {originalOperator: "<", originalValue: "0", operator: "==="},
    {originalOperator: "<", originalValue: "0", operator: "==="},
    {originalOperator: ">=", originalValue: "0", operator: "!=="},
    {originalOperator: ">=", originalValue: "0", operator: "!=="},
  }

  ranges := unicornConsistentExistenceIndexCheckMarkedRanges(t, source)
  if len(ranges) != len(expectations) {
    t.Fatalf("test wiring: %d marked ranges but %d expectations", len(ranges), len(expectations))
  }

  _, _, findings := runRuleFindingsSnapshot(
    t,
    "unicorn/consistent-existence-index-check",
    source,
    nil,
  )
  if len(findings) != len(ranges) {
    t.Fatalf("expected %d findings, got %d: %+v", len(ranges), len(findings), findings)
  }
  for index, finding := range findings {
    want := ranges[index]
    expectation := expectations[index]
    if finding.Rule != "unicorn/consistent-existence-index-check" ||
      finding.Severity != SeverityError {
      t.Fatalf("finding %d identity mismatch: %+v", index, finding)
    }
    if finding.Pos != want[0] || finding.End != want[1] {
      t.Fatalf(
        "finding %d range mismatch: got=[%d,%d) want=%v (%q)",
        index, finding.Pos, finding.End, want, source[want[0]:want[1]],
      )
    }
    existence := "existence"
    if expectation.operator == "===" {
      existence = "non-existence"
    }
    message := "Prefer `" + expectation.operator + " -1` over `" +
      expectation.originalOperator + " " + expectation.originalValue +
      "` to check " + existence + "."
    if finding.Message != message {
      t.Fatalf("finding %d message mismatch:\nwant %q\ngot  %q", index, message, finding.Message)
    }
    if len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d must not carry suggestions: %+v", index, finding.Suggestions)
    }

    // The marked range opens on the operator token and closes on the right
    // operand, so both edit ranges are derivable from it.
    edits := []TextEdit{{
      Pos:  want[0],
      End:  want[0] + len(expectation.originalOperator),
      Text: expectation.operator,
    }}
    if expectation.originalValue != "-1" {
      edits = append(edits, TextEdit{
        Pos:  want[1] - len(expectation.originalValue),
        End:  want[1],
        Text: "-1",
      })
    }
    if len(finding.Fix) != len(edits) {
      t.Fatalf("finding %d fix = %+v, want %+v", index, finding.Fix, edits)
    }
    for editIndex, edit := range edits {
      if finding.Fix[editIndex] != edit {
        t.Fatalf(
          "finding %d edit %d mismatch: want=%+v got=%+v",
          index, editIndex, edit, finding.Fix[editIndex],
        )
      }
    }
  }
}
