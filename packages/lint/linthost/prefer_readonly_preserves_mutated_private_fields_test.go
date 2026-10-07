package linthost

import "testing"

// TestPreferReadonlyPreservesMutatedPrivateFields verifies private-field write discrimination.
//
// An initializer cannot establish that later assignments are absent. Actual
// Engine findings must distinguish immutable fields from direct, aliased,
// computed, destructured and nested writes without confusing object mutation
// or an unrelated class's equally named field with assignment to this field.
//
// 1. Parse each independently authored class through the owning Engine.
// 2. Compare exact finding counts with the field-assignment contract.
//
// @evidence contracts/testing.md#behavioral-verification The real Engine must leave writable private fields clean and report initialized immutable fields.
// @evidence contracts/testing.md#independent-expectations Assignments, updates and destructuring require field reassignment; reading or mutating a field's object does not require replacing the field.
// @evidence contracts/testing.md#distinguishing-cases The table covers hash/static fields, aliases, computed keys, nested callbacks, constructor writes, object mutation, already-readonly and public fields.
// @evidence contracts/testing.md#execution-ownership TestPreferReadonlyPreservesMutatedPrivateFields runs each named subcase through runRuleFindingsSnapshot in the enrolled rules unit population; a real Checker is supplied when the rule requires one, without a child host or native build.
func TestPreferReadonlyPreservesMutatedPrivateFields(t *testing.T) {
  cases := []struct {
    name, source string
    want         int
  }{
    {"initialized", "class A { private value = 0; read() { return this.value; } }", 1},
    {"increment", "class A { private value = 0; update() { this.value++; } }", 0},
    {"prefix", "class A { private value = 0; update() { --this.value; } }", 0},
    {"compound", "class A { private value = 0; update() { this.value += 1; } }", 0},
    {"assignment", "class A { private value = 0; update() { this.value = 1; } }", 0},
    {"constructor", "class A { private value = 0; constructor() { this.value = 1; } }", 0},
    {"alias", "class A { private value = 0; update() { const self = this; self.value++; } }", 0},
    {"other-instance", "class A { private value = 0; update(other: A) { other.value++; } }", 0},
    {"computed", "class A { private value = 0; update() { this['value']++; } }", 0},
    {"dynamic", "class A { private value = 0; update(key: 'value') { this[key]++; } }", 0},
    {"destructured", "class A { private value = 0; update() { [this.value] = [1]; } }", 0},
    {"object-destructured", "class A { private value = 0; update() { ({n: this.value} = {n: 1}); } }", 0},
    {"nested-default", "class A { private value = 0; update() { [[this.value] = [1]] = []; } }", 0},
    {"default-value-write", "class A { private value = 0; update() { let n; [n = (this.value = 1)] = []; } }", 0},
    {"wrapped", "class A { private value = 0; update() { (this.value as number)++; } }", 0},
    {"loop-target", "class A { private value = 0; update() { for (this.value of [1, 2]) {} } }", 0},
    {"delete", "class A { private value?: number = 0; update() { delete this.value; } }", 0},
    {"nested", "class A { private value = 0; update() { return () => { this.value++; }; } }", 0},
    {"hash", "class A { #value = 0; update() { this.#value++; } }", 0},
    {"static", "class A { private static value = 0; static update() { A.value++; } }", 0},
    {"static-constant", "class A { private static value = 0; static read() { return A.value; } }", 1},
    {"object-mutation", "class A { private value = { n: 0 }; update() { this.value.n++; } }", 1},
    {"unrelated-class", "class B { value = 0; } class A { private value = 0; update(other: B) { other.value++; } }", 1},
    {"readonly-public-uninitialized", "class A { private readonly value = 0; public other = 0; private unset: number | undefined; }", 0},
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "typescript/prefer-readonly", c.source, nil)
      if len(findings) != c.want {
        t.Errorf("findings=%d, want %d: %+v", len(findings), c.want, findings)
      }
    })
  }
}
