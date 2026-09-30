package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsKeepsTypeScriptSignatureScopesIndependent verifies that the actual fixer compares all authored signature parameter renames.
//
// Separate TypeScript call/construct/interface-method parameter scopes independently permit context in each signature without false collisions.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer compares all authored signature parameter renames.
// @evidence contracts/testing.md#independent-expectations Separate TypeScript call/construct/interface-method parameter scopes independently permit context in each signature without false collisions.
// @evidence contracts/testing.md#distinguishing-cases Function type, constructor type, interface call and method signature ctx bindings all become context.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsKeepsTypeScriptSignatureScopesIndependent owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsKeepsTypeScriptSignatureScopesIndependent(t *testing.T) {
  source := "type First = (ctx: object) => void;\ntype Second = new (ctx: object) => object;\ninterface Third {\n  (ctx: object): void;\n  method(ctx: object): void;\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "type First = (context: object) => void;\ntype Second = new (context: object) => object;\ninterface Third {\n  (context: object): void;\n  method(context: object): void;\n}\n",
  )
}
