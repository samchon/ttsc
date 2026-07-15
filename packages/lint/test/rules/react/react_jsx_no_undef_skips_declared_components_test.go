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
