package linthost

import "testing"

// TestRuleCorpusNoLossOfPrecision verifies the lint rule corpus fixture no-loss-of-precision.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-loss-of-precision.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoLossOfPrecision(t *testing.T) {
  assertRuleCorpusCase(t, "no-loss-of-precision.ts", "// expect: no-loss-of-precision error\nconst big = 9007199254740993;\n// expect: no-loss-of-precision error\nconst fractional = 1.0000000000000001;\n// expect: no-loss-of-precision error\nconst exponent = 9.007199254740993e15;\n// expect: no-loss-of-precision error\nconst binary = 0b100000000000000000000000000000000000000000000000000001;\n// expect: no-loss-of-precision error\nconst octal = 0o400000000000000001;\n// expect: no-loss-of-precision error\nconst hexadecimal = 0x20000000000001;\n// expect: no-loss-of-precision error\nconst overflow = 1e999;\n// expect: no-loss-of-precision error\nconst underflow = 1e-324;\n\nconst exactBoundary = 9007199254740992;\nconst exactFraction = 1.0000000000000002;\nconst exactSubnormal = 5e-324;\nconst exactHexadecimal = 0x20000000000000;\nconst bigint = 9007199254740993n;\n\nvoid [\n  big,\n  fractional,\n  exponent,\n  binary,\n  octal,\n  hexadecimal,\n  overflow,\n  underflow,\n  exactBoundary,\n  exactFraction,\n  exactSubnormal,\n  exactHexadecimal,\n  bigint,\n];\n")
}
