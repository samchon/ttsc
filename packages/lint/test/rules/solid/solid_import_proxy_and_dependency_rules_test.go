package linthost

import "testing"

/**
 * Verifies solid import and call-shape rules: canonical modules and non-React APIs are enforced.
 *
 * Locks the source-aware rules that only need import declarations and call
 * expressions. They catch wrong Solid module imports, React dependency arrays,
 * and Proxy-backed APIs without using type information.
 *
 * 1. Import Solid APIs from the wrong modules and the store package.
 * 2. Call `createEffect` with a dependency array and construct `Proxy`.
 * 3. Assert import, dependency, and proxy diagnostics are reported.
 */
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
}
