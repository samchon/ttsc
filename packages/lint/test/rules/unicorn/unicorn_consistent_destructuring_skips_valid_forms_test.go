package linthost

import "testing"

// TestRuleCorpusUnicornConsistentDestructuringSkipsValidForms verifies the
// negative twin of every reporting surface: forms the upstream rule leaves
// alone must produce zero findings.
//
// Over-matching is the failure mode this rule invites — a write target
// mistaken for a read, a shadowed root treated as the tracked one, or a
// type-narrowing `in` guard ignored each turn a valid file noisy. Every
// scenario is adapted from the upstream valid corpus, plus destructuring-
// assignment-slot twins for the left-hand-side arm.
//
//  1. Enable unicorn/consistent-destructuring on one type-clean source that
//     stacks every upstream-valid form.
//  2. Run the checker-backed snapshot path.
//  3. Assert the rule reports nothing.
func TestRuleCorpusUnicornConsistentDestructuringSkipsValidForms(t *testing.T) {
  source := `declare const sibling: { a: number; b: number };
declare const invoked: { a: () => void };
declare const constructed: { A: new () => object };
declare const tagged: { tag: (parts: TemplateStringsArray) => string };
declare const computed: Record<string, number>;
declare const erased: { a?: number };
declare const updated: { a: number };
declare const written: { a: number };
declare const patterned: { a: number };
declare const restTarget: { a: number[] };
declare const looped: { a: number };
declare const keyed: { k: string };
declare const relet: { a: number };
declare let reassigned: { a: number };
declare let crossWritten: { a: number };
declare const crossMember: { a: number };
declare const shadowedRoot: { a: number };
declare const shadowedBinding: { a: number };
declare const guarded: { a: string; b?: number };
declare const late: { a: number };
declare const sameStatement: { a: number };
declare const stringKey: { a: number };
declare const defaultKey: { a?: number };
declare const nested: { a: { b: number } };
declare const restRead: { a: number; c: number };
declare const viaMember: { bar: { a: number } };
declare function viaCall(): { a: number };

const {a: siblingA} = sibling;
void [siblingA, sibling.b];

const {a: invokedA} = invoked;
void invokedA;
invoked.a();

const {A: constructedA} = constructed;
void constructedA;
void new constructed.A();

const {tag} = tagged;
void tag;
void tagged.tag` + "`template`" + `;

const {a: computedA} = computed;
void computedA;
void computed["a"];

const {a: erasedA} = erased;
void erasedA;
delete erased.a;
void erased.a;

const {a: updatedA} = updated;
void updatedA;
updated.a++;
--updated.a;
updated.a += 1;
void updated.a;

const {a: writtenA} = written;
void writtenA;
written.a = 1;
void written.a;

const {a: patternedA} = patterned;
void patternedA;
[patterned.a] = [1];
({a: patterned.a} = {a: 2});
void patterned.a;

const {a: restTargetA} = restTarget;
void restTargetA;
[...restTarget.a] = [3];
void restTarget.a;

const {a: loopedA} = looped;
void loopedA;
for (looped.a of [4]) {}
for ([looped.a] of [[5]]) {}
void looped.a;

const {k: keyedK} = keyed;
void keyedK;
for (keyed.k in {x: 6}) {}
void keyed.k;

let {a: reletA} = relet;
void [reletA, relet.a];

const {a: reassignedA} = reassigned;
void reassignedA;
reassigned = {a: 7};
void reassigned.a;

const {a: crossWrittenA} = crossWritten;
void crossWrittenA;
function writeRoot(): void {
  crossWritten = {a: 8};
}
void [writeRoot, crossWritten.a];

const {a: crossMemberA} = crossMember;
void crossMemberA;
function writeMember(): void {
  crossMember.a = 9;
}
void [writeMember, crossMember.a];

const {a: shadowedRootA} = shadowedRoot;
void shadowedRootA;
{
  const shadowedRoot = {a: 10};
  void shadowedRoot.a;
}

const {a: shadowedBindingA} = shadowedBinding;
void shadowedBindingA;
{
  const shadowedBindingA = 11;
  void [shadowedBindingA, shadowedBinding.a];
}

const {a: guardedA, b: guardedB} = guarded;
void [guardedA, guardedB];
if ('b' in guarded) {
  void guarded.b;
}
if ('b' in guarded && guardedA) {
  void guarded.b;
}
const guardedLogical = 'b' in guarded && guarded.b;
void guardedLogical;
const guardedTernary = 'b' in guarded ? guarded.b : undefined;
void guardedTernary;
if ('b' in guarded) {
  const guardedArrow = () => guarded.b;
  void guardedArrow;
  const guardedExpression = function (): number | undefined {
    return guarded.b;
  };
  void guardedExpression;
  const guardedObject = {
    read(): number | undefined {
      return guarded.b;
    },
  };
  void guardedObject;
}

void late.a;
const {a: lateA} = late;
void lateA;

const sameStatementValue = sameStatement.a, {a: sameStatementA} = sameStatement;
void [sameStatementValue, sameStatementA];

const {'a': stringKeyA} = stringKey;
void [stringKeyA, stringKey.a];

const {a: defaultKeyA = 12} = defaultKey;
void [defaultKeyA, defaultKey.a];

const {a: {b: nestedB}} = nested;
void [nestedB, nested.a];

const {a: restReadA, ...restReadRest} = restRead;
void [restReadA, restReadRest, restRead.c];

const {a: viaMemberA} = viaMember.bar;
void [viaMemberA, viaMember.bar.a];

const {a: viaCallA} = viaCall();
void [viaCallA, viaCall().a];

class OwnThis {
  x = 1;
  destructure(): void {
    const {x} = this;
    void x;
  }
  read(): number {
    return this.x;
  }
  boundThis(): number {
    const {x} = this;
    void x;
    const inner = function (this: OwnThis): number {
      return this.x;
    };
    return inner.call(this);
  }
}
void OwnThis;
`
  assertRuleSkipsSource(t, "unicorn/consistent-destructuring", source)
}
