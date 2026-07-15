package linthost

import "testing"

// TestUnicornIsolatedFunctionsOverrideGlobals verifies the overrideGlobals
// policy matrix over an ambient global (`console`): default readonly allows
// reads but reports writes as not-writable, "writable" allows writes, "off"
// disallows the global entirely, and "readonly" restates the default. A
// captured module binding is never allowed by an override.
//
// This mirrors getAllowedGlobalValue: an ambient global maps to ESLint's
// all-readonly ES-globals default, overrideGlobals is the writability/off
// escape hatch, and an override on a resolved non-global reference is ignored.
//
//  1. Assert the read/write outcome of `console` under no option, "writable",
//     "off", and "readonly".
//  2. Assert `overrideGlobals: {foo: true}` still reports a captured module
//     `foo`.
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

  // An override cannot whitelist a captured module binding.
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
