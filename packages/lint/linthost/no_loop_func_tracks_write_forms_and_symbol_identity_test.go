package linthost

import "testing"

// TestNoLoopFuncTracksWriteFormsAndSymbolIdentity verifies every modifying
// reference is matched by checker symbol rather than identifier spelling.
//
// Compound, destructuring, for-of, update, and foreign-function writes all
// make a captured binding unsafe. A same-spelled shadow write must not taint
// the untouched outer binding beside them.
//
// 1. Capture five bindings with distinct write forms plus one stable binding.
// 2. Write the stable spelling only through a separate local symbol.
// 3. Assert the diagnostic lists exactly the five truly mutable symbols.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings require the one original closure range and exactly five unsafe variable names, excluding stable.
// @evidence contracts/testing.md#independent-expectations Authored compound/destructuring/loop/update/foreign-function writes mutate their resolved upper bindings; the same-spelled stable write resolves to a different local symbol.
// @evidence contracts/testing.md#distinguishing-cases Five actual mutable symbols report in the message; the separately shadowed stable symbol does not. ReportsOnlyUnsafeReferences owns source-border differences.
// @evidence contracts/testing.md#execution-ownership TestNoLoopFuncTracksWriteFormsAndSymbolIdentity is selected in the shared Go unit population. It calls runNoLoopFunc and assertNoLoopFuncFindings through the owning Engine with a real Program/Checker; all authored in-source cases belong to this entry. No installed consumer, native artifact build or real product host runs.
func TestNoLoopFuncTracksWriteFormsAndSymbolIdentity(t *testing.T) {
  source := `let assigned = 0;
let destructured = 0;
let iterated = 0;
let updated = 0;
let foreign = 0;
let stable = 0;
function mutateForeign(): void { foreign = 1; }
function mutateShadow(): void { let stable = 0; stable++; }
for (let iteration = 0; iteration < 1; iteration++) {
  const closure = () => assigned + destructured + iterated + updated + foreign + stable;
  assigned += 1;
  [destructured] = [1];
  for (iterated of [] as number[]) {}
  updated++;
  void [closure, mutateForeign, mutateShadow];
}
`
  assertNoLoopFuncFindings(
    t,
    runNoLoopFunc(t, source),
    noLoopFuncFinding{
      line:    10,
      target:  "() => assigned + destructured + iterated + updated + foreign + stable",
      message: "Function declared in a loop contains unsafe references to variable(s) 'assigned', 'destructured', 'iterated', 'updated', 'foreign'.",
    },
  )
}
