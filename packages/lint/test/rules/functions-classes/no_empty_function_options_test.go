package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoEmptyFunctionAllowCategories verifies every canonical allow value maps
// to exactly the corresponding TypeScript AST function kind.
//
// @evidence contracts/testing.md#behavioral-verification Fourteen named cases compare default one-finding behavior with zero findings under the matching allow category.
// @evidence contracts/testing.md#independent-expectations Fixed category-to-source pairs independently specify the public option semantics; marshaling constructs inputs rather than expected findings.
// @evidence contracts/testing.md#distinguishing-cases Each ordinary/arrow/generator/method/accessor/constructor/async/decorated/override category contrasts default report with its explicit exemption; the boundary test owns neighboring categories.
// @evidence contracts/testing.md#execution-ownership TestNoEmptyFunctionAllowCategories is selected in the shared Go unit population. Its fourteen named subtests call runRuleFindingsSnapshot on the owning no-empty-function Engine twice, retaining category failure identities. No consumer install, native artifact build or real host runs.
func TestNoEmptyFunctionAllowCategories(t *testing.T) {
  tests := []struct {
    option string
    source string
  }{
    {option: "functions", source: `function empty() {}`},
    {option: "arrowFunctions", source: `const empty = () => {};`},
    {option: "generatorFunctions", source: `function* empty() {}`},
    {option: "methods", source: `class Example { method() {} }`},
    {option: "generatorMethods", source: `class Example { *method() {} }`},
    {option: "getters", source: `class Example { get value() {} }`},
    {option: "setters", source: `class Example { set value(_value: unknown) {} }`},
    {option: "constructors", source: `class Example { constructor() {} }`},
    {option: "asyncFunctions", source: `async function empty() {}`},
    {option: "asyncMethods", source: `class Example { async method() {} }`},
    {option: "privateConstructors", source: `class Example { private constructor() {} }`},
    {option: "protectedConstructors", source: `class Example { protected constructor() {} }`},
    {
      option: "decoratedFunctions",
      source: `declare function decorate(...args: unknown[]): unknown;
class Example { @decorate method() {} }`,
    },
    {
      option: "overrideMethods",
      source: `class Base { method() { return; } }
class Example extends Base { override method() {} }`,
    },
  }

  for _, test := range tests {
    t.Run(test.option, func(t *testing.T) {
      _, _, defaultFindings := runRuleFindingsSnapshot(t, "no-empty-function", test.source, nil)
      if len(defaultFindings) != 1 {
        t.Fatalf("default finding count = %d, want 1; findings=%+v", len(defaultFindings), defaultFindings)
      }
      options, err := json.Marshal(noEmptyFunctionOptions{Allow: []string{test.option}})
      if err != nil {
        t.Fatal(err)
      }
      _, _, allowedFindings := runRuleFindingsSnapshot(t, "no-empty-function", test.source, options)
      if len(allowedFindings) != 0 {
        t.Fatalf("finding count with allow %q = %d, want 0; findings=%+v", test.option, len(allowedFindings), allowedFindings)
      }
    })
  }
}
