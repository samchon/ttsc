package linthost

import "testing"

// TestRuleCorpusParameterProperties verifies the lint rule corpus fixture
// typescript-parameter-properties.ts.
//
// The rule is AST-only: it inspects each `KindConstructor` and reports
// every parameter that carries an accessibility / `readonly` /
// `override` modifier. The fixture pins the trigger shape and the
// negative path where the same class is declared with plain fields and
// a plain constructor.
//
//  1. Load the annotated TypeScript fixture source embedded below.
//  2. Enable the rule severities declared by its `// expect:` comments.
//  3. Assert the native Engine reports one diagnostic per parameter-
//     property declaration and leaves the explicit-field shape alone.
// @evidence contracts/testing.md#behavioral-verification Constructor parameter properties must report each shorthand declaration.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/parameter-properties error findings at lines 4, 6 and 8; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases Public, private-readonly and protected shorthand parameters are paired with equivalent explicit fields and ordinary parameters.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusParameterProperties executes the AST Engine through assertRuleCorpusCase in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusParameterProperties(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-parameter-properties.ts", "class ParameterShorthand {\n  constructor(\n    // expect: typescript/parameter-properties error\n    public name: string,\n    // expect: typescript/parameter-properties error\n    private readonly id: number,\n    // expect: typescript/parameter-properties error\n    protected count: number,\n  ) {\n    JSON.stringify({ name, id, count });\n  }\n}\n\nclass ExplicitFields {\n  public name: string;\n  private readonly id: number;\n  protected count: number;\n  constructor(name: string, id: number, count: number) {\n    this.name = name;\n    this.id = id;\n    this.count = count;\n  }\n}\n\nJSON.stringify({ ParameterShorthand, ExplicitFields });\n")
}
