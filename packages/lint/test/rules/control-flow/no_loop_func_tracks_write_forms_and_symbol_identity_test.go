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
