package linthost

import "testing"

// TestUnicornIsolatedFunctionsExecuteScriptFuncProperty verifies the
// `chrome.scripting.executeScript` / `browser.scripting.executeScript`
// recognition: a function-valued `func` property (assignment, method
// shorthand, or computed string key) on the object passed as the first
// argument is isolated.
//
// The native rule requires a method or function initializer named "func"
// on the first argument's object literal, so accessors, computed identifier
// keys, later arguments, and computed executeScript access must stay silent.
//
//  1. Assert an arrow `func`, a method-shorthand `func`, and a function
//     expression under the computed string key `["func"]` report, spread
//     across the chrome and browser scripting objects.
//  2. Assert accessors, identifier-computed keys, identifier values, second
//     arguments, and computed executeScript member access are clean.
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify three first-object func captures report for chrome/browser scripting APIs; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations The authored exact capture lines and literal scripting reasons independently establish first-argument function-property recognition without calling the production reason builder.
// @evidence contracts/testing.md#distinguishing-cases Arrow/function/method and literal-computed func keys match; accessor, dynamic key, identifier value, second object argument and computed executeScript do not.
// @evidence contracts/testing.md#execution-ownership TestUnicornIsolatedFunctionsExecuteScriptFuncProperty is a discoverable Go unit host; its literal option/source cases run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
func TestUnicornIsolatedFunctionsExecuteScriptFuncProperty(t *testing.T) {
  source := `declare const chrome: { scripting: { executeScript(...args: unknown[]): unknown } };
declare const browser: { scripting: { executeScript(...args: unknown[]): unknown } };
declare const target: { tabId: number };

const captured = "hi";

chrome.scripting.executeScript({
  target: { tabId: 1 },
  func: () => captured.slice(),
});
browser.scripting.executeScript({
  func() {
    return captured.slice();
  },
});
chrome.scripting.executeScript({
  ["func"]: function (): string {
    return captured.slice();
  },
});
chrome.scripting.executeScript(target, {
  func: () => captured.slice(),
});
chrome.scripting.executeScript({
  get func(): () => string {
    return () => captured.slice();
  },
});
const dynamicKey = "func";
chrome.scripting.executeScript({
  [dynamicKey]: () => captured.slice(),
});
const funcValue = (): string => captured.slice();
chrome.scripting.executeScript({ func: funcValue });
chrome.scripting["executeScript"]({ func: () => captured.slice() });
`
  chromeReason := `property "func" passed to "chrome.scripting.executeScript"`
  browserReason := `property "func" passed to "browser.scripting.executeScript"`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, ""),
    unicornIsolatedFunctionsFinding{
      line:    9,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", chromeReason),
    },
    unicornIsolatedFunctionsFinding{
      line:    13,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", browserReason),
    },
    unicornIsolatedFunctionsFinding{
      line:    18,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", chromeReason),
    },
  )
}
