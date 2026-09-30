package linthost

import "testing"

// TestUnicornIsolatedFunctionsBrowserAndPageCallees verifies the built-in
// `browser.execute` / `page.evaluate` recognition: only the first argument of
// a non-computed call on those exact identifiers is isolated.
//
// These shapes are hardcoded upstream (not part of the `functions` option),
// so they must keep firing when `functions` is emptied, must accept optional
// chaining, and must reject computed member access, other receivers, and
// later argument positions.
//
//  1. Assert captures in the first argument of browser.execute and
//     page.evaluate (plain and optional-chained) are reported.
//  2. Assert frame.evaluate, computed page["evaluate"], and second arguments
//     stay clean.
//  3. Re-run with functions [] and assert the built-in shapes still report.
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify three exact browser.execute/page.evaluate first-argument captures report under default and empty functions options; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations The authored capture targets, lines and upstream reason strings independently specify builtin browser/page recognition. Test-owned message interpolation composes the authored upstream sentence and does not call the production reason builder.
// @evidence contracts/testing.md#distinguishing-cases Plain/optional exact page calls match, later arguments, frame receiver and computed property do not; empty functions cannot disable the builtins.
// @evidence contracts/testing.md#execution-ownership TestUnicornIsolatedFunctionsBrowserAndPageCallees is a discoverable Go unit host; its literal option/source cases run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
func TestUnicornIsolatedFunctionsBrowserAndPageCallees(t *testing.T) {
  source := `declare const browser: { execute(...args: unknown[]): unknown };
declare const page: { evaluate(...args: unknown[]): unknown };
declare const frame: { evaluate(...args: unknown[]): unknown };

const captured = "hi";

browser.execute(() => captured.slice());
page.evaluate(() => captured.slice());
page?.evaluate(() => captured.slice());
page.evaluate(() => "first", () => captured.slice());
frame.evaluate(() => captured.slice());
page["evaluate"](() => captured.slice());
`
  expected := []unicornIsolatedFunctionsFinding{
    {
      line:    7,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", `callee of method named "browser.execute"`),
    },
    {
      line:    8,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", `callee of method named "page.evaluate"`),
    },
    {
      line:    9,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", `callee of method named "page.evaluate"`),
    },
  }
  assertUnicornIsolatedFunctionsFindings(t, runUnicornIsolatedFunctions(t, source, ""), expected...)
  // The browser/page shapes are hardcoded upstream; emptying `functions`
  // must not disable them.
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, `{"functions": []}`),
    expected...,
  )
}
