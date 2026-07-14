package linthost

import "testing"

// TestUnicornNoUnusedPropertiesKeyMatching verifies the strict key identity
// upstream applies between property names and access expressions.
//
// Upstream compares JavaScript key VALUES with strict equality: identifier
// and string keys share one class, numbers normalize (`0x10` reaches
// `foo[16]`) but never match strings (`foo["1"]` cannot reach `{1: ...}`),
// bigints compare by value, boolean/null literal indexes stay distinct from
// the identifier property names they resolve to at runtime, computed
// identifier keys match by NAME (not runtime value), and parentheses are
// transparent on both sides because ESTree has no parenthesized-expression
// node. Any relaxation or tightening of one class flips a case here.
//
//  1. Declare one object per key class with a matching and a mismatching
//     access, plus `__proto__` skips and unpredictable-key reports.
//  2. Run the rule through the real Program/checker lifecycle.
//  3. Assert exactly the `/* unused:NAME */`-marked properties are reported.
func TestUnicornNoUnusedPropertiesKeyMatching(t *testing.T) {
  source := `export {};
declare function consume(...values: unknown[]): void;
declare const outside: { tag: string };

const numeric = { 255: "a", /* unused:256 */ 256: "b" };
consume(numeric[0xff]);

const normalized = { 0x10: "a", /* unused:17 */ 17: "b", 1e2: "c", 1.5: "d", 1_000: "e" };
consume(normalized[16], normalized[100], normalized[1.5], normalized[1000]);

const stringVsNumber = { /* unused:1 */ 1: "a", /* unused:2 */ 2: "b" };
consume(stringVsNumber["1"]);

const numberVsString = { /* unused:3 */ "3": "a", four: "b" };
consume(numberVsString[3], numberVsString.four);

const big = { 0x10n: "a", /* unused:17 */ 17n: "b" };
consume(big[16n]);

const bigVsNumber = { /* unused:5 */ 5n: "a", other: "b" };
consume(bigVsNumber[5], bigVsNumber.other);

const keyword = { /* unused:true */ true: "a", /* unused:null */ null: "b", done: "c" };
consume(keyword[true], keyword[null], keyword.done);

const keywordByName = { true: "a", null: "b" };
consume(keywordByName["true"], keywordByName["null"]);

const label = "runtime";
const byIdentifier = { [label]: "a", direct: "b" };
consume(byIdentifier.label, byIdentifier.direct);

const byIdentifierMiss = { /* unused:label */ [label]: "a", kept: "b" };
consume(byIdentifierMiss.kept, byIdentifierMiss["runtime"]);

const unpredictable = { /* unused:outside.tag */ [outside.tag]: "a", steady: "b" };
consume(unpredictable.steady);

const parenKey = { [("wrapped")]: "a", /* unused:bare */ bare: "b" };
consume(parenKey.wrapped);

const parenIndex = { reached: "a", /* unused:missed */ missed: "b" };
consume(parenIndex[("reached")]);

const negated = { [-1]: "a", alsoNegated: "b" };
consume(negated[-1]);

const protoSkip = {
  __proto__: { hidden: 1 },
  ["__proto__"]: 2,
  /* unused:visibleDrop */ visibleDrop: 3,
  read: 4,
};
consume(protoSkip.read);
`
  assertUnusedPropertiesFindings(t, source)
}
