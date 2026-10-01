package linthost

import "testing"

// TestUnicornNoUnusedPropertiesScriptGlobalScopeExclusion verifies the
// upstream global-scope exclusion for script files.
//
// Upstream walks every scope except `global`. In a script (no import or
// export), top-level `const`/`let` and every hoisted `var` land in the
// global scope and must be skipped even with obviously unused properties,
// while block-scoped and function-scoped variables in the same file are
// still analyzed. A module file has no global variables, which the module
// test files cover; this fixture intentionally has no export statement.
//
//  1. Declare unused-property objects at the script top level (const and
//     var), inside a bare block (let and hoisted var), inside a function,
//     and in for-statement heads (initializer-free for-of, initialized for).
//  2. Run the rule through the real Program/checker lifecycle.
//  3. Assert only block-, function-, and for-scoped objects report.
//
// @evidence contracts/testing.md#behavioral-verification Actual checker-backed findings must equal the authored unused NAME@line markers, detecting accidentally analyzed globals or skipped local scopes.
// @evidence contracts/testing.md#independent-expectations The official Unicorn global-scope exclusion and JavaScript var versus lexical scope rules establish independent block/function/loop expectations.
// @evidence contracts/testing.md#distinguishing-cases Script top-level const/var and block-hoisted var stay clean; local lexical/function bindings and initialized for-head objects report unused siblings, while for-of bindings lack their own initializer.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnusedPropertiesScriptGlobalScopeExclusion owns this authored checker-source matrix as a discoverable Go unit entry. loadProgram and the lint cycle operate in the shared Go process on t.TempDir fixtures; no native build, installed consumer or real child product host runs.
func TestUnicornNoUnusedPropertiesScriptGlobalScopeExclusion(t *testing.T) {
  source := `const topLevel = { read: 1, skippedConst: 2 };
console.log(topLevel.read);

var hoisted = { seen: 1, skippedVar: 2 };
console.log(hoisted.seen);

{
  let blockScoped = { kept: 1, /* unused:blockDrop */ blockDrop: 2 };
  console.log(blockScoped.kept);

  var hoistedInBlock = { taken: 1, skippedHoisted: 2 };
  console.log(hoistedInBlock.taken);
}

function scoped(): void {
  const inner = { held: 1, /* unused:innerDrop */ innerDrop: 2 };
  console.log(inner.held);

  var innerVar = { got: 1, /* unused:innerVarDrop */ innerVarDrop: 2 };
  console.log(innerVar.got);
}
scoped();

// A for-of binding has no initializer of its own, so its object stays
// unanalyzed even though loopSkipped is never read.
for (const iterated of [{ once: 1, loopSkipped: 2 }]) {
  console.log(iterated.once);
}

// A for-statement head declaration carries a real initializer and lives in
// the for scope, not the global scope, so it is analyzed even in a script.
for (let step = { move: 1, /* unused:stayDrop */ stayDrop: 2 }; step.move < 3; step.move++) {
  console.log(step.move);
}
`
  assertUnusedPropertiesFindings(t, source)
}
