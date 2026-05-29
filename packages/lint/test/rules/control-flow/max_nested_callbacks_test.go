package linthost

import "testing"

// TestRuleCorpusMaxNestedCallbacks verifies the lint rule corpus fixture max-nested-callbacks.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in max-nested-callbacks.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusMaxNestedCallbacks(t *testing.T) {
  assertRuleCorpusCase(t, "max-nested-callbacks.ts", "// Positive: eleven levels of nested arrow-function callbacks exceeds the\n// default depth of ten. The rule fires on the eleventh callback because\n// that is the first one whose stack-depth crossed the threshold.\ndeclare function schedule(fn: () => void): void;\n\nschedule(() =>\n  schedule(() =>\n    schedule(() =>\n      schedule(() =>\n        schedule(() =>\n          schedule(() =>\n            schedule(() =>\n              schedule(() =>\n                schedule(() =>\n                  schedule(() =>\n                    // expect: max-nested-callbacks error\n                    schedule(() => {\n                      void 0;\n                    }),\n                  ),\n                ),\n              ),\n            ),\n          ),\n        ),\n      ),\n    ),\n  ),\n);\n\n// Negative: ten levels deep sits exactly at the limit and stays silent —\n// the rule fires only when the count strictly exceeds the threshold.\nschedule(() =>\n  schedule(() =>\n    schedule(() =>\n      schedule(() =>\n        schedule(() =>\n          schedule(() =>\n            schedule(() =>\n              schedule(() =>\n                schedule(() =>\n                  schedule(() => {\n                    void 0;\n                  }),\n                ),\n              ),\n            ),\n          ),\n        ),\n      ),\n    ),\n  ),\n);\n")
}
