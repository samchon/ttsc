package linthost

import "testing"

// TestAwaitThenablePreservesMigratedAllFamilyContexts verifies the preserved rule-family diagnostic set.
//
// Separates the original consumer case's portable semantics from package
// discovery while retaining its exact source and compiler settings.
//
// 1. Materialize the original source and compiler configuration.
// 2. Run the owning command operation with the scalar rule setting.
// 3. Compare every diagnostic rule, severity and line and failure status.
//
// @evidence contracts/testing.md#behavioral-verification Exact findings reject non-awaitable scalar, synchronous iterable, synchronous disposal and non-awaitable Promise aggregator inputs without reporting Promise, async iterable and async disposal controls.
// @evidence contracts/testing.md#independent-expectations Literal lines 2, 4, 8 and 14 designate the four authored invalid contexts from issue 413 independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases All four visitor families have valid adjacent controls in the original source; exact complete diagnostics detect both missed visitors and over-reporting.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePreservesMigratedAllFamilyContexts executes through assertMigratedTypedRuleCase and the owning Go command in the shared lint unit process. Fixture files require no native build or consumer installation; package auto-discovery and native transport remain in the surviving E2E batch.
func TestAwaitThenablePreservesMigratedAllFamilyContexts(t *testing.T) {
  assertMigratedTypedRuleCase(t, "async function run(): Promise<void> {\n  await 42;\n\n  for await (const value of [1, 2, 3]) {\n    console.log(value);\n  }\n\n  await using resource = {\n    [Symbol.dispose](): void {\n      console.log(\"disposed\");\n    },\n  };\n\n  void Promise.all([42]);\n\n  await Promise.resolve();\n\n  void Promise.all([Promise.resolve(42)]);\n\n  for await (const value of (async function* (): AsyncGenerator<number> {\n    yield 1;\n  })()) {\n    console.log(value);\n  }\n\n  await using asyncResource = {\n    async [Symbol.asyncDispose](): Promise<void> {\n      await Promise.resolve();\n    },\n  };\n\n  console.log(resource, asyncResource);\n}\n\nexport { run };\n", "{\"compilerOptions\":{\"noEmit\":true,\"strict\":true,\"target\":\"ES2022\",\"module\":\"NodeNext\",\"moduleResolution\":\"NodeNext\",\"lib\":[\"ES2022\",\"DOM\",\"ESNext.Disposable\"]},\"files\":[\"src/main.ts\"]}", "{\"name\":\"await-thenable-no-plugins-entry-fixture\",\"private\":true,\"dependencies\":{\"@ttsc/lint\":\"*\"}}", "typescript/await-thenable", "error", []ruleExpectation{{Rule: "typescript/await-thenable", Severity: SeverityError, Line: 2}, {Rule: "typescript/await-thenable", Severity: SeverityError, Line: 4}, {Rule: "typescript/await-thenable", Severity: SeverityError, Line: 8}, {Rule: "typescript/await-thenable", Severity: SeverityError, Line: 14}})
}
