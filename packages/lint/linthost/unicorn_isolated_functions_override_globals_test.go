package linthost

import "testing"

// TestUnicornIsolatedFunctionsOverrideGlobals verifies the overrideGlobals
// policy matrix over an ambient global (`console`): default readonly allows
// reads but reports writes as not-writable, "writable" allows writes, "off"
// disallows the global entirely, and "readonly" restates the default. A
// captured source binding is never allowed by an override.
//
// The native rule treats resolved ambient globals as readonly by default.
// overrideGlobals changes writability or admission, but cannot whitelist an
// ordinary captured source binding.
//
//  1. Assert the read/write outcome of `console` under no option, "writable",
//     "off", and "readonly".
//  2. Assert `overrideGlobals: {foo: true}` still reports a captured source
//     `foo`.
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify ambient console read/write outcomes change with writable/off/readonly and captured source foo remains rejected; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations Authored line/target/message records establish global-writability outcomes, including a literal empty result for writable, independently of the production reason builder.
// @evidence contracts/testing.md#distinguishing-cases Default and readonly permit reads only, writable permits writes, off reports both; an override cannot whitelist a source capture.
// @evidence contracts/testing.md#execution-ownership TestUnicornIsolatedFunctionsOverrideGlobals is a discoverable Go unit host; its literal option/source cases run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
func TestUnicornIsolatedFunctionsOverrideGlobals(t *testing.T) {
  reason := `callee of function named "makeSynchronous"`
  writeSource := `makeSynchronous(function () {
  console.log("x");
  console = undefined;
});
`

  // Default: read is allowed, the write to the readonly global is reported.
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, writeSource, ""),
    unicornIsolatedFunctionsFinding{
      line:    3,
      target:  "console",
      message: unicornIsolatedFunctionsVariableMessage("console", reason+" (global variable is not writable)"),
    },
  )

  // "writable" allows the write; nothing is reported.
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, writeSource, `{"overrideGlobals": {"console": "writable"}}`),
  )

  // "off" disallows the global entirely: both the read and the write report,
  // neither with the not-writable suffix.
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, writeSource, `{"overrideGlobals": {"console": "off"}}`),
    unicornIsolatedFunctionsFinding{
      line:    2,
      target:  "console",
      message: unicornIsolatedFunctionsVariableMessage("console", reason),
    },
    unicornIsolatedFunctionsFinding{
      line:    3,
      target:  "console",
      message: unicornIsolatedFunctionsVariableMessage("console", reason),
    },
  )

  // "readonly" restates the default: read allowed, write reported.
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, writeSource, `{"overrideGlobals": {"console": "readonly"}}`),
    unicornIsolatedFunctionsFinding{
      line:    3,
      target:  "console",
      message: unicornIsolatedFunctionsVariableMessage("console", reason+" (global variable is not writable)"),
    },
  )

  // An override cannot whitelist a captured source binding.
  captured := `const foo = "hi";
makeSynchronous(function () {
  return foo.slice();
});
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, captured, `{"overrideGlobals": {"foo": true}}`),
    unicornIsolatedFunctionsFinding{
      line:    3,
      target:  "foo",
      message: unicornIsolatedFunctionsVariableMessage("foo", reason),
    },
  )
}
