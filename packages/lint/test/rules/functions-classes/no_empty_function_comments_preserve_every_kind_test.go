package linthost

import "testing"

// TestNoEmptyFunctionCommentsPreserveEveryKind ensures a comment must be
// inside each function body's braces and works for every primary function kind.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for every original internally commented function body.
// @evidence contracts/testing.md#independent-expectations Intentional comments inside body braces establish the policy exemption independently of Engine output; exterior-comment counterexamples belong to the category-boundary test.
// @evidence contracts/testing.md#distinguishing-cases Declarations, expressions, arrows, generators, async functions, methods, constructor and accessors retain their internal comments and remain clean.
// @evidence contracts/testing.md#execution-ownership TestNoEmptyFunctionCommentsPreserveEveryKind is selected in the shared Go unit population. It calls runRuleFindingsSnapshot directly for the full authored comment matrix; this entry owns all in-source variants. No consumer install, native artifact build or real host runs.
func TestNoEmptyFunctionCommentsPreserveEveryKind(t *testing.T) {
  source := `function ordinary() { /* intentional */ }
const expression = function () { /* intentional */ };
const arrow = () => { /* intentional */ };
function* generator() { /* intentional */ }
const generatorExpression = function* () { /* intentional */ };
async function asynchronous() { /* intentional */ }
const asyncExpression = async function () { /* intentional */ };
const asyncGeneratorExpression = async function* () { /* intentional */ };
class Example {
  constructor() { /* intentional */ }
  method() { /* intentional */ }
  *generatorMethod() { /* intentional */ }
  async asyncMethod() { /* intentional */ }
  get value() { /* intentional */ }
  set value(_value: unknown) { /* intentional */ }
}
void [ordinary, expression, arrow, generator, generatorExpression,
  asynchronous, asyncExpression, asyncGeneratorExpression, Example];`
  _, _, findings := runRuleFindingsSnapshot(t, "no-empty-function", source, nil)
  if len(findings) != 0 {
    t.Fatalf("commented function bodies produced findings: %+v", findings)
  }
}
