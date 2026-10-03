package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsRecognizesOnlyCanonicalStaticRequireCalls verifies that actual fix execution checks named require near-misses and the empty-specifier clean counterpart.
//
// The supported import recognizer independently requires a direct single static-string argument, leaving other initializers as ordinary variable bindings.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution checks named require near-misses and the empty-specifier clean counterpart.
// @evidence contracts/testing.md#independent-expectations The supported import recognizer independently requires a direct single static-string argument, leaving other initializers as ordinary variable bindings.
// @evidence contracts/testing.md#distinguishing-cases Extra argument, optional call and template argument still rename variables under disabled import checks; empty static specifier remains exempt.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsRecognizesOnlyCanonicalStaticRequireCalls owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsRecognizesOnlyCanonicalStaticRequireCalls(t *testing.T) {
  cases := []struct {
    name        string
    initializer string
  }{
    {name: "extra argument", initializer: `require("./local", {})`},
    {name: "optional call", initializer: `require?.("./local")`},
    {name: "template argument", initializer: "require(`./local`)"},
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      source := "declare function require(...values: unknown[]): unknown;\nconst err = " + testCase.initializer + ";\nvoid err;\n"
      assertFixSnapshotWithOptions(
        t,
        unicornPreventAbbreviationsRuleName,
        source,
        `{"checkDefaultAndNamespaceImports":false}`,
        "declare function require(...values: unknown[]): unknown;\nconst error = "+testCase.initializer+";\nvoid error;\n",
      )
    })
  }

  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "declare function require(...values: unknown[]): unknown;\nconst err = require(\"\");\nvoid err;\n",
    `{"checkDefaultAndNamespaceImports":false}`,
  )
}
