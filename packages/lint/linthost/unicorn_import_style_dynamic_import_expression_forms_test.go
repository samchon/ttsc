package linthost

import (
  "testing"
)

// TestUnicornImportStyleDynamicImportExpressionForms verifies the two
// dynamic-import listeners: a bare or promise-assigned `import()` is
// unassigned style, an `(await import()).member` access is unassigned,
// and only the exact `const … = await import(…)` declarator shape is
// routed to the binding-target classifier.
//
// The skip predicate (isAssignedDynamicImport) must not swallow the
// non-declarator awaits, or those violations vanish.
//
//  1. Violate the default-only `chalk` policy through each dynamic
//     form.
//  2. Assert every form reports with the default-import message.
//  3. Assert the compliant awaited-default destructure is silent.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks five dynamic import findings and their authored expression ranges against an awaited-default clean counterpart.
// @evidence contracts/testing.md#independent-expectations The supported unassigned dynamic-expression listener and exact awaited-declarator classifier independently establish those styles.
// @evidence contracts/testing.md#distinguishing-cases Bare/promise/member access and nondefault awaited forms report; awaited default destructuring is clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleDynamicImportExpressionForms owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleDynamicImportExpressionForms(t *testing.T) {
  assertRuleSkipsSource(t, unicornImportStyleRuleName, `async () => {
  const { default: chalk } = await import("chalk");
  void chalk;
};
`)

  source := `import("chalk");
const promise = import("chalk");
async () => {
  const { red } = await import("chalk");
  void red;
};
async () => {
  const chalk = await import("chalk");
  void chalk;
};
async () => {
  const value = (await import("chalk")).default;
  void value;
};
void promise;
`
  findings := runUnicornImportStyleFindings(t, source, "")
  message := "Use default import for module `chalk`."
  if len(findings) != 5 {
    t.Fatalf("want 5 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
  if findings[0].target != `import("chalk")` {
    t.Fatalf("bare dynamic import range mismatch: %q", findings[0].target)
  }
  // A promise-assigned dynamic import (no await) reports at the import
  // expression itself, exactly like upstream's ImportExpression listener.
  if findings[1].target != `import("chalk")` {
    t.Fatalf("promise-assigned dynamic import range mismatch: %q", findings[1].target)
  }
  if findings[4].target != `import("chalk")` {
    t.Fatalf("member-access dynamic import range mismatch: %q", findings[4].target)
  }
}
