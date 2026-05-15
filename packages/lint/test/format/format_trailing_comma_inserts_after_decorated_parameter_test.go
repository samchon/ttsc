package main

import "testing"

// TestFormatTrailingCommaInsertsAfterDecoratedParameter verifies the rule
// fires correctly when the last parameter carries a parameter decorator.
//
// Parameter decorators (`@dec`) live inside `ParameterDeclaration` as
// leading-modifier syntax, so the decorator does NOT shift the parameter
// list's `last.End()` past the type annotation. Pinning the decorated
// case keeps the modifier-stacking invariant under a TS-specific shape
// that the existing parameter tests do not cover.
//
//  1. Parse a source file with one class method whose last parameter
//     carries a decorator and spans across the line break.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     decorated parameter.
func TestFormatTrailingCommaInsertsAfterDecoratedParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "declare function inject(token: string): ParameterDecorator;\nclass Service {\n  method(\n    plain: number,\n    @inject(\"TOKEN\") tagged: number\n  ): number {\n    return plain + tagged;\n  }\n}\nService;\n",
    "declare function inject(token: string): ParameterDecorator;\nclass Service {\n  method(\n    plain: number,\n    @inject(\"TOKEN\") tagged: number,\n  ): number {\n    return plain + tagged;\n  }\n}\nService;\n",
  )
}
