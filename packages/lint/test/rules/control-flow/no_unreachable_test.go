package linthost

import "testing"

// TestRuleCorpusNoUnreachable verifies the lint rule corpus fixture no-unreachable.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-unreachable.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoUnreachable(t *testing.T) {
	assertRuleCorpusCase(t, "no-unreachable.ts", "function afterReturn(): number {\n  return 1;\n  // expect: no-unreachable error\n  console.log(\"dead\");\n}\n\nfunction afterThrow(): void {\n  throw new Error(\"boom\");\n  // expect: no-unreachable error\n  console.log(\"dead\");\n}\n\nfunction loop(): void {\n  for (let i = 0; i < 3; i += 1) {\n    if (i === 0) {\n      continue;\n      // expect: no-unreachable error\n      console.log(\"dead\");\n    }\n    if (i === 2) {\n      break;\n      // expect: no-unreachable error\n      console.log(\"dead\");\n    }\n  }\n}\n\n// Negative: a function declaration after the terminator is hoisted and\n// remains callable from earlier statements, so it is not dead code.\nfunction withHoistedDecl(): number {\n  return helper();\n  function helper(): number {\n    return 7;\n  }\n}\n\nJSON.stringify({\n  afterReturn: afterReturn(),\n  loop,\n  afterThrow,\n  withHoistedDecl: withHoistedDecl(),\n});\n")
}
