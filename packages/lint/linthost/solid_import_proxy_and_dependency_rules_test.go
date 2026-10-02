package linthost

import "testing"

// TestSolidImportProxyAndDependencyRules verifies solid import and call-shape
// rules: canonical modules and non-React APIs are enforced.
//
// Locks the source-aware rules that only need import declarations and call
// expressions. They catch wrong Solid module imports, React dependency arrays,
// and Proxy-backed APIs without using type information.
//
//  1. Import Solid APIs from the wrong modules and the store package.
//  2. Call `createEffect` with a dependency array and construct `Proxy`.
//  3. Assert import, dependency, and proxy diagnostics are reported.
//
// @evidence contracts/testing.md#behavioral-verification The actual owning engine verifies exact findings identify misrouted render/createStore, store produce, React dependency arrays and Proxy construction; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations The supported Solid module routes, non-Proxy policy and automatically tracked effect semantics determine the authored rule/line triples.
// @evidence contracts/testing.md#distinguishing-cases Distinct imported bindings and call shapes each retain their own finding identity; canonical imports and a dependency-free effect form the accepted control.
// @evidence contracts/testing.md#execution-ownership TestSolidImportProxyAndDependencyRules owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
func TestSolidImportProxyAndDependencyRules(t *testing.T) {
  source := `
import { createEffect, render } from "solid-js";
import { createStore } from "solid-js/web";
import { produce } from "solid-js/store";

function App() {
  createEffect(() => {}, []);
  new Proxy({}, {});
  return <div />;
}
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/imports":       SeverityError,
    "solid/no-proxy-apis": SeverityError,
    "solid/no-react-deps": SeverityError,
  }, []ruleExpectation{
    {Rule: "solid/imports", Severity: SeverityError, Line: 2},
    {Rule: "solid/imports", Severity: SeverityError, Line: 3},
    {Rule: "solid/no-proxy-apis", Severity: SeverityError, Line: 4},
    {Rule: "solid/no-react-deps", Severity: SeverityError, Line: 7},
    {Rule: "solid/no-proxy-apis", Severity: SeverityError, Line: 8},
  })
  assertSolidFindings(t, "import { createEffect } from \"solid-js\"; import { render } from \"solid-js/web\"; createEffect(() => {}); void render;\n", RuleConfig{
    "solid/imports": SeverityError,
    "solid/no-proxy-apis": SeverityError,
    "solid/no-react-deps": SeverityError,
  }, nil)
}
