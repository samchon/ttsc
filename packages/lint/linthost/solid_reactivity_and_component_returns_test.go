package linthost

import "testing"

// TestSolidReactivityAndComponentReturns verifies solid reactivity rules:
// authored component and tracked-scope shapes retain their diagnostics.
//
// Pins authored Solid component patterns that are visible without a type
// service: destructured props, early returns, missing JSX component bindings,
// async tracked scopes, and bare signal accessors in JSX.
//
//  1. Import Solid primitives and define one component with JSX.
//  2. Mix destructured props, an early return, an async effect, an undefined JSX tag, and a bare signal accessor.
//  3. Assert each enabled `solid/*` rule reports its matching pattern.
//
// @evidence contracts/testing.md#behavioral-verification The actual owning engine verifies five exact findings identify props destructuring, early return, async effect, missing component and bare signal; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations Authored lint policies prefer props-member access, one component return, synchronous tracked callbacks, declared component names and invoked signal accessors. Independent literal rule/severity/line triples identify those source patterns; actual runtime reactivity is not observed.
// @evidence contracts/testing.md#distinguishing-cases Separate rule/line expectations retain all five identities; props-member access, synchronous effect, known DOM tag and invoked signal form the accepted control.
// @evidence contracts/testing.md#execution-ownership TestSolidReactivityAndComponentReturns owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
func TestSolidReactivityAndComponentReturns(t *testing.T) {
  source := `
import { createEffect, createSignal } from "solid-js";

function App({ name }: { name: string }) {
  if (!name) return <span />;
  const [count] = createSignal(0);
  createEffect(async () => count());
  return <Missing>{count}</Missing>;
}
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/components-return-once": SeverityError,
    "solid/jsx-no-undef":           SeverityError,
    "solid/no-destructure":         SeverityError,
    "solid/reactivity":             SeverityError,
  }, []ruleExpectation{
    {Rule: "solid/no-destructure", Severity: SeverityError, Line: 4},
    {Rule: "solid/components-return-once", Severity: SeverityError, Line: 5},
    {Rule: "solid/reactivity", Severity: SeverityError, Line: 7},
    {Rule: "solid/jsx-no-undef", Severity: SeverityError, Line: 8},
    {Rule: "solid/reactivity", Severity: SeverityError, Line: 8},
  })
  assertSolidFindings(t, "import { createEffect, createSignal } from \"solid-js\"; function App(props: { name: string }) { const [count] = createSignal(0); createEffect(() => count()); return <div>{props.name}{count()}</div>; }\n", RuleConfig{
    "solid/components-return-once": SeverityError,
    "solid/jsx-no-undef": SeverityError,
    "solid/no-destructure": SeverityError,
    "solid/reactivity": SeverityError,
  }, nil)
}
