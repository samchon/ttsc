package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsKeepsExportedJSDocAndJSXBindingsDiagnosticOnly verifies that the engine checks each named public/comment/JSX binding risk for one diagnostic and no fixes or suggestions.
//
// The supported rename-safety contract independently preserves external API, attached documentation and JSX naming across those authored inputs.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks each named public/comment/JSX binding risk for one diagnostic and no fixes or suggestions.
// @evidence contracts/testing.md#independent-expectations The supported rename-safety contract independently preserves external API, attached documentation and JSX naming across those authored inputs.
// @evidence contracts/testing.md#distinguishing-cases All fourteen retained export/JSDoc/JSX/parameter-property/ambient/wrapper cases remain diagnostic-only.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsKeepsExportedJSDocAndJSXBindingsDiagnosticOnly owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and exact diagnostic or editor-suggestion comparisons run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsKeepsExportedJSDocAndJSXBindingsDiagnosticOnly(t *testing.T) {
  cases := []struct {
    name     string
    fileName string
    source   string
  }{
    {
      name:     "exported declaration",
      fileName: "main.ts",
      source:   "export const err = new Error();\n",
    },
    {
      name:     "JSDoc parameter",
      fileName: "main.ts",
      source:   "/** @param err supplied error */\nfunction log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
    },
    {
      name:     "JSX tag",
      fileName: "main.tsx",
      source:   "const Btn = (): JSX.Element => <button />;\nconst view = <Btn />;\nvoid view;\n",
    },
    {
      name:     "merged exported declaration",
      fileName: "main.ts",
      source:   "interface Ctx {}\nexport namespace Ctx {}\nconst value: Ctx = {};\nvoid value;\n",
    },
    {
      name:     "parameter property",
      fileName: "main.ts",
      source:   "class Store {\n  constructor(public err: Error) {}\n}\nvoid Store;\n",
    },
    {
      name:     "JSDoc function type parameter",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\ntype Middleware = (ctx: object) => void;\n",
    },
    {
      name:     "JSDoc destructured parameter",
      fileName: "main.ts",
      source:   "/** @param options supplied options */\nfunction log({ cause: err }: { cause: Error }): void {\n  console.error(err);\n}\nvoid log;\n",
    },
    {
      name:     "exported destructured declaration",
      fileName: "main.ts",
      source:   "declare const source: { cause: Error };\nexport const { cause: err } = source;\n",
    },
    {
      name:     "nested ambient declaration",
      fileName: "main.ts",
      source:   "declare namespace API {\n  const err: Error;\n}\n",
    },
    {
      name:     "JSDoc parameter through parentheses",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = ((ctx: object): object => ctx);\n",
    },
    {
      name:     "JSDoc parameter through as assertion",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = (((ctx: object): object => ctx) as ((value: object) => object));\n",
    },
    {
      name:     "JSDoc parameter through satisfies",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = (((ctx: object): object => ctx) satisfies ((value: object) => object));\n",
    },
    {
      name:     "JSDoc parameter through non-null assertion",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = (((ctx: object): object => ctx)!);\n",
    },
    {
      name:     "JSDoc parameter through angle-bracket assertion",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = <((value: object) => object)>((ctx: object): object => ctx);\n",
    },
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshotFile(
        t,
        unicornPreventAbbreviationsRuleName,
        testCase.fileName,
        testCase.source,
        nil,
      )
      assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
      if len(findings) != 1 || len(findings[0].Fix) != 0 || len(findings[0].Suggestions) != 0 {
        t.Fatalf("expected one diagnostic-only binding, got %+v", findings)
      }
    })
  }
}
