package linthost

import "testing"

// TestNoUselessConstructorPreservesArgumentFiltering verifies constructor forwarding facts.
//
// An implicit derived constructor forwards every caller argument. A zero-arg
// or fixed positional super call filters extra arguments and is meaningful.
//
// 1. Parse each authored base or derived constructor with the owning Engine.
// 2. Assert exact findings for empty base and unchanged rest forwarding only.
//
// @evidence contracts/testing.md#behavioral-verification The Engine permits argument filtering, reordering and parameter work while reporting unchanged derived rest forwarding and an empty base constructor.
// @evidence contracts/testing.md#independent-expectations The implicit derived constructor's all-argument forwarding differs from super() and fixed positional calls, independently of a particular invocation's argument count. This syntax oracle does not establish runtime equivalence: explicit rest spread also observes the array iterator.
// @evidence contracts/testing.md#distinguishing-cases Zero arguments, positional filtering, exact rest, reordered/default/destructured parameters, visibility and parameter properties have authored finding-count oracles.
// @evidence contracts/testing.md#execution-ownership TestNoUselessConstructorPreservesArgumentFiltering uses runRuleFindingsSnapshot in the enrolled Go rules unit batch without compiling or installing a consumer or launching a host.
func TestNoUselessConstructorPreservesArgumentFiltering(t *testing.T) {
  cases := []struct { name, source string; want int }{
    {"empty-base", "class A { constructor() {} }", 1},
    {"zero-filter", "class A {} class B extends A { constructor() { super(); } }", 0},
    {"positional-filter", "class A {} class B extends A { constructor(a: unknown, b: unknown) { super(a, b); } }", 0},
    {"rest", "class A {} class B extends A { constructor(...args: unknown[]) { super(...args); } }", 1},
    {"prefix-rest", "class A {} class B extends A { constructor(a: unknown, ...args: unknown[]) { super(a, ...args); } }", 0},
    {"reordered", "class A {} class B extends A { constructor(a: unknown, b: unknown) { super(b, a); } }", 0},
    {"default", "class A {} class B extends A { constructor(a = 1) { super(a); } }", 0},
    {"destructured", "class A {} class B extends A { constructor({a}: {a: number}) { super(a); } }", 0},
    {"private", "class A { private constructor() {} }", 0},
    {"protected", "class A {} class B extends A { protected constructor(...args: unknown[]) { super(...args); } }", 0},
    {"parameter-property", "class A { constructor(private value: number) {} }", 0},
    {"parameter-decorator", "declare const dec: any; class A {} class B extends A { constructor(@dec ...args: unknown[]) { super(...args); } }", 0},
    {"ordinary-work", "class A { value = 0; constructor() { this.value++; } }", 0},
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "no-useless-constructor", c.source, nil)
      if len(findings) != c.want { t.Errorf("findings=%d, want %d: %+v", len(findings), c.want, findings) }
    })
  }
}
