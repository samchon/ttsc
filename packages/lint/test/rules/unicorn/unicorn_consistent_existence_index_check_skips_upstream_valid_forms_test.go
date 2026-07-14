package linthost

import "testing"

// TestUnicornConsistentExistenceIndexCheckSkipsUpstreamValidForms verifies the
// negative twin of every reporting surface: forms upstream leaves alone must
// produce zero findings.
//
// Upstream reaches a comparison only through the references of a `const` bound
// to a plain `indexOf` / `lastIndexOf` / `findIndex` / `findLastIndex` call, and
// only when the reference sits on the left of `< 0`, `>= 0`, or `> -1`. Every
// other shape is a potential over-match: a `let` or `var` index (it can be
// reassigned to anything), a parameter or destructured binding, an index from a
// different call, an optional chain or computed member (a ChainExpression /
// computed MemberExpression upstream), a private-name method, the reversed
// operand order, the already-canonical `=== -1` forms, a neighbouring literal
// (`< 1`, `> 0`, `>= -1`, `<= -1`), a non-comparison use, and a bare
// `array.indexOf(x) < 0` that binds no index at all. Binding identity — not the
// name `index` — is what separates a shadowed inner declaration from the
// tracked one.
//
//  1. Enable unicorn/consistent-existence-index-check on one type-clean source
//     that stacks every upstream-valid form.
//  2. Run the checker-backed snapshot path.
//  3. Assert the rule reports nothing.
func TestUnicornConsistentExistenceIndexCheckSkipsUpstreamValidForms(t *testing.T) {
  source := `declare const array: number[];
declare const collection: { indexOf(value: number): number };
declare const table: Record<string, (value: number) => number>;
declare const holder: { indexOf: number };
declare const nested: { list: { indexOf(value: number): number } };
declare function indexOf(value: number): number;
declare function compute(): number;
declare function consume(value: number): void;

// Not a ` + "`const`" + `: the binding can be reassigned to any number.
let letIndex = array.indexOf(1);
void (letIndex < 0);
letIndex = compute();
var varIndex = array.indexOf(2);
void (varIndex >= 0);

// A ` + "`const`" + ` initialized from something other than an index call.
const computed = compute();
void (computed < 0);
const size = array.length;
void (size >= 0);
const dynamic = table["indexOf"](3);
void (dynamic < 0);
const bracketed = collection["indexOf"](4);
void (bracketed > -1);
// A standalone call, not a method call — the callee is no member at all.
const standalone = indexOf(18);
void (standalone < 0);
// The right name, but read as a property instead of called.
const property = holder.indexOf;
void (property >= 0);

// Optional chains are ChainExpressions upstream, which never match — including
// when the ` + "`?.`" + ` sits earlier in the chain than the index call itself.
const optionalMember = collection?.indexOf(5);
void (optionalMember < 0);
const optionalCall = collection.indexOf?.(6);
void (optionalCall >= 0);
const optionalRoot = nested?.list.indexOf(19);
void (optionalRoot < 0);

// A private-name method is not an Identifier property.
class PrivateIndex {
  #indexOf(value: number): number {
    return value;
  }
  absent(): boolean {
    const index = this.#indexOf(7);
    return index < 0;
  }
}
void PrivateIndex;

// Not an identifier reference on the left of the comparison.
const reversed = array.indexOf(8);
void (0 > reversed);
void (-1 < reversed);
void (array.indexOf(9) < 0);
void (array.indexOf(10) >= 0);
void (array.indexOf(11) > -1);

// Already the canonical sentinel comparison.
const canonical = array.indexOf(12);
void (canonical === -1);
void (canonical !== -1);
void (-1 === canonical);
void (-1 !== canonical);

// Operator and literal pairs upstream does not recognize. ` + "`-0`" + ` is a unary
// expression and ` + "`0n`" + ` is a BigInt literal, so neither is the numeric zero
// upstream matches.
const neighbours = array.indexOf(13);
void (neighbours < 1);
void (neighbours > 0);
void (neighbours >= -1);
void (neighbours <= -1);
void (neighbours > -2);
void (neighbours < -0);
void (neighbours < 0n);

// A parameter, not a declared index.
function fromParameter(index: number): boolean {
  return index < 0;
}
void fromParameter;

// A destructured binding is not an Identifier declarator id.
const [destructured] = [array.indexOf(14)];
void (destructured < 0);

// The name is not the binding: the inner declarations shadow the tracked one.
const shadowed = array.indexOf(15);
void (shadowed !== -1);
{
  const shadowed = compute();
  void (shadowed < 0);
}
{
  let shadowed = array.indexOf(16);
  void (shadowed >= 0);
  shadowed = compute();
}

// A tracked index that is never compared.
const unused = array.indexOf(17);
consume(unused);
void (unused + 1);

export {};
`
  assertRuleSkipsSource(t, "unicorn/consistent-existence-index-check", source)
}
