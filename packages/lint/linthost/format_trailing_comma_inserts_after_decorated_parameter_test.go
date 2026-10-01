package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterDecoratedParameter verifies the rule
// fires correctly when the last parameter carries a parameter decorator.
//
// Decorator punctuation belongs to the parameter, not to its list closer. The final comma must follow the complete decorated parameter without touching the decorator arguments.
//
//  1. Parse a source file with one class method whose last parameter
//     carries a decorator and spans across the line break.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     decorated parameter.
//
// @evidence contracts/testing.md#behavioral-verification The method must gain only a comma after tagged:number, retaining inject TOKEN decorator, plain parameter and addition body.
// @evidence contracts/testing.md#independent-expectations TypeScript decorated parameters still follow all-mode formal-parameter comma policy. The literal expected method preserves the complete decorator call and both bindings independently of their AST spans.
// @evidence contracts/testing.md#distinguishing-cases The final parameter carries a decorator with its own parentheses. Ordinary-method and stacked constructor-property hosts distinguish other parameter-prefix shapes.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterDecoratedParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterDecoratedParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "declare function inject(token: string): ParameterDecorator;\nclass Service {\n  method(\n    plain: number,\n    @inject(\"TOKEN\") tagged: number\n  ): number {\n    return plain + tagged;\n  }\n}\nService;\n",
    "declare function inject(token: string): ParameterDecorator;\nclass Service {\n  method(\n    plain: number,\n    @inject(\"TOKEN\") tagged: number,\n  ): number {\n    return plain + tagged;\n  }\n}\nService;\n",
  )
}
