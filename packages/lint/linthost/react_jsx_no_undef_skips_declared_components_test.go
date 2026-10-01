package linthost

import "testing"

// TestReactJSXNoUndefSkipsDeclaredComponents verifies that a capitalized JSX
// tag bound by any of the declaration forms the rule recognizes is left
// unflagged.
//
// The undeclared-name lookup was refactored from a per-tag whole-file walk
// into a once-per-file declared-name set; this pins that the set still covers
// every binding form the original predicate did — default / named / namespace
// imports, function, class, variable, enum declarations, and parameters — so
// the memoization changed cost, not findings.
//
//  1. Declare one uppercase component through each recognized form.
//  2. Use every one as a JSX tag with only react/jsx-no-undef enabled.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify all eight recognized declaration forms remain free of undeclared-component findings; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Imports, function/class/variable/enum declarations and a callback parameter are actual bindings under the supported source-level lookup.
// @evidence contracts/testing.md#distinguishing-cases Default/named/namespace imports and local declarations distinguish positive bindings from TestReactJSXNoUndefReportsUndeclaredComponent.
// @evidence contracts/testing.md#execution-ownership TestReactJSXNoUndefSkipsDeclaredComponents is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXNoUndefSkipsDeclaredComponents(t *testing.T) {
  assertReactRuleSkips(t, "react/jsx-no-undef", `import Imported from "imported";
import { Named } from "named";
import * as Namespace from "namespace";
function Declared() {
  return null;
}
class ClassComp {}
const Arrow = () => null;
enum Enumed {}
const render = (Param: () => null) => (
  <div>
    <Imported />
    <Named />
    <Namespace />
    <Declared />
    <ClassComp />
    <Arrow />
    <Enumed />
    <Param />
  </div>
);
JSON.stringify(render);`)
}
