package linthost

import (
  "fmt"
  "strings"
  "testing"
)

// unicornConsistentDestructuringMarkedRanges returns the byte ranges wrapped
// by `/*<*/` … `/*>*/` marker pairs in source order. The rule reports whole
// member expressions (multi-token ranges such as `(foo as Foo).a`), so the
// identifier-suffix scanner in the shared helpers cannot express the expected
// spans; paired markers pin the exact Pos/End of every diagnostic instead.
func unicornConsistentDestructuringMarkedRanges(t *testing.T, source string) [][2]int {
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

// TestRuleCorpusUnicornConsistentDestructuring verifies every reporting
// surface of the destructured-binding rule against the upstream oracle.
//
// A name-only scan would collude shadowed roots, miss TypeScript assertion
// wrappers, and confuse write targets with reads. Each scenario pins one
// upstream-invalid form: checker binding identity, `this` boundaries,
// latest-declaration selection, non-shielding writes, type-guard boundaries,
// and the member-parent split between suggestion and message-only reports.
//
//  1. Enable unicorn/consistent-destructuring on one type-clean source file.
//  2. Mark every expected member-expression range with `/*<*/ … /*>*/`.
//  3. Assert range, message, and suggestion payload for each finding, in
//     source order, with the replacement text taken from the upstream output.
func TestRuleCorpusUnicornConsistentDestructuring(t *testing.T) {
  engine := NewEngine(RuleConfig{"unicorn/consistent-destructuring": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("unicorn/consistent-destructuring did not request a type checker")
  }

  source := `type Shape = { a: number };
declare const basic: { a: number; b: number };
declare const aliased: { b: number };
declare const repeated: { a: number };
declare const wrapped: Shape;
declare const otherRoot: { a: number };
declare const namesake: { a: number };
declare const preWritten: { a: number };
declare const shadowWrite: { a: number };
declare const captured: { a: number };
declare const params: { a: string; b?: number; c?: unknown };
declare const chain: { a: { b: number } };
declare const indexed: { i: number };
declare const table: Record<number, number>;
declare const defaulted: { a: number };
declare let sink: number;
declare const plain: { p: number };
declare const listed: { l: number };
declare const user: { profile: { name: string } };
declare const rested: { a: number; c: number };
declare const opt: { a: { b: number } };
declare const optIndex: { i: number };
declare const spreadable: { a: number[] };
declare function consume(...values: number[]): void;

const {a} = basic;
void a;
void /*<*/basic.a/*>*/;

const {b: alias} = aliased;
void alias;
void /*<*/aliased.b/*>*/;

const {a: first} = repeated;
void first;
void /*<*/repeated.a/*>*/;
const {a: second} = repeated;
void second;
void /*<*/repeated.a/*>*/;

const {a: unwrappedValue} = wrapped;
void unwrappedValue;
void /*<*/(wrapped as Shape).a/*>*/;
void /*<*/wrapped!.a/*>*/;
void /*<*/(<Shape>wrapped).a/*>*/;
void /*<*/(wrapped satisfies Shape).a/*>*/;

const {a: unrelatedWrite} = otherRoot;
void unrelatedWrite;
namesake.a = 1;
void /*<*/otherRoot.a/*>*/;

preWritten.a = 1;
const {a: afterWrite} = preWritten;
void afterWrite;
void /*<*/preWritten.a/*>*/;

const {a: outerBinding} = shadowWrite;
void outerBinding;
{
  const shadowWrite = {a: 2};
  shadowWrite.a = 3;
}
void /*<*/shadowWrite.a/*>*/;

const {a: capturedBinding} = captured;
void capturedBinding;
function readCaptured(): number {
  return /*<*/captured.a/*>*/;
}
void readCaptured;

const {a: guardA, b: guardB} = params;
void [guardA, guardB];
if ('c' in params) {
  void /*<*/params.b/*>*/;
}
if ('b' in params) {
  function guardedDeclaration(): number | undefined {
    return /*<*/params.b/*>*/;
  }
  void guardedDeclaration;
  class GuardedMembers {
    field = /*<*/params.b/*>*/;
    accessor stored = /*<*/params.b/*>*/;
    read(): number | undefined {
      return /*<*/params.b/*>*/;
    }
  }
  void GuardedMembers;
}

const {a: chained} = chain;
void chained;
/*<*/chain.a/*>*/.b = 1;

const {i} = indexed;
void i;
table[/*<*/indexed.i/*>*/] = 2;

const {a: defaultRead} = defaulted;
void defaultRead;
[sink = /*<*/defaulted.a/*>*/] = [4];

const {p} = plain;
void p;
const holder = {value: /*<*/plain.p/*>*/};
void holder;

const {l} = listed;
void l;
const list = [/*<*/listed.l/*>*/];
void list;

const {profile} = user;
void profile;
void /*<*/user.profile/*>*/.name;

const {a: restSibling, ...rest} = rested;
void [restSibling, rest];
void /*<*/rested.a/*>*/;

class ThisMethod {
  x = 1;
  read(): number {
    const {x} = this;
    void x;
    return /*<*/this.x/*>*/;
  }
}
void ThisMethod;

class ThisArrow {
  n = 2;
  make(): () => number {
    const {n} = this;
    void n;
    return () => /*<*/this.n/*>*/;
  }
}
void ThisArrow;

class ThisStatic {
  static s = 3;
  static {
    const {s} = this;
    void s;
    void /*<*/this.s/*>*/;
  }
}
void ThisStatic;

const {a: optA} = opt;
void optA;
void /*<*/opt?.a/*>*/;
void /*<*/opt?.a/*>*/.b;
void (/*<*/opt?.a/*>*/).b;

const {i: optI} = optIndex;
void optI;
void table[/*<*/optIndex?.i/*>*/];

const {a: spreadA} = spreadable;
void spreadA;
consume(.../*<*/spreadable.a/*>*/);
`

  // Replacement text of the expected suggestion for each marked range, in
  // order; "" pins a message-only finding (nested member chain parents).
  replacements := []string{
    "a",
    "alias",
    "first",
    "second",
    "unwrappedValue",
    "unwrappedValue",
    "unwrappedValue",
    "unwrappedValue",
    "unrelatedWrite",
    "afterWrite",
    "outerBinding",
    "capturedBinding",
    "guardB",
    "guardB",
    "guardB",
    "guardB",
    "guardB",
    "", // chain.a inside `chain.a.b = 1` — member parent, no suggestion
    "", // indexed.i inside `table[indexed.i]` — member parent, no suggestion
    "defaultRead",
    "p",
    "l",
    "", // user.profile inside `user.profile.name` — member parent, no suggestion
    "restSibling",
    "x",
    "n",
    "s",
    "optA", // `opt?.a` alone — ChainExpression caps the chain, suggestion applies
    "",     // `opt?.a` continued by `.b` in the same chain — member parent, no suggestion
    "optA", // `(opt?.a).b` — parens cap the chain upstream, suggestion applies
    "optI", // `table[optIndex?.i]` — chain capped in argument position, suggestion applies
    "spreadA",
  }

  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/consistent-destructuring", source, nil)
  expected := unicornConsistentDestructuringMarkedRanges(t, source)
  if len(expected) != len(replacements) {
    t.Fatalf("test wiring: %d marked ranges but %d replacements", len(expected), len(replacements))
  }
  if len(findings) != len(expected) {
    t.Fatalf("expected %d findings, got %d: %+v", len(expected), len(findings), findings)
  }
  for index, finding := range findings {
    want := expected[index]
    if finding.Rule != "unicorn/consistent-destructuring" || finding.Severity != SeverityError ||
      finding.Pos != want[0] || finding.End != want[1] {
      t.Fatalf("finding %d range mismatch: got=%+v want=%v", index, finding, want)
    }
    if finding.Message != "Use destructured variables over properties." {
      t.Fatalf("finding %d message mismatch: got=%q", index, finding.Message)
    }
    if len(finding.Fix) != 0 {
      t.Fatalf("finding %d must never carry an autofix: %+v", index, finding)
    }
    replacement := replacements[index]
    if replacement == "" {
      if len(finding.Suggestions) != 0 {
        t.Fatalf("finding %d must be message-only, got suggestions %+v", index, finding.Suggestions)
      }
      continue
    }
    if len(finding.Suggestions) != 1 {
      t.Fatalf("finding %d suggestions = %d, want 1", index, len(finding.Suggestions))
    }
    suggestion := finding.Suggestions[0]
    expression := source[want[0]:want[1]]
    title := fmt.Sprintf("Replace `%s` with destructured property `%s`.", expression, replacement)
    if suggestion.Title != title {
      t.Fatalf("finding %d suggestion title mismatch:\nwant %q\ngot  %q", index, title, suggestion.Title)
    }
    if len(suggestion.Edits) != 1 {
      t.Fatalf("finding %d suggestion edits = %d, want 1", index, len(suggestion.Edits))
    }
    edit := suggestion.Edits[0]
    if edit.Pos != want[0] || edit.End != want[1] || edit.Text != replacement {
      t.Fatalf("finding %d suggestion edit mismatch: got=%+v want={%d %d %q}", index, edit, want[0], want[1], replacement)
    }
  }
}
