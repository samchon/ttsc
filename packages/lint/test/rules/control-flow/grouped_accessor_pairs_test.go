package linthost

import "testing"

// TestRuleCorpusGroupedAccessorPairs verifies the lint rule corpus fixture grouped-accessor-pairs.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in grouped-accessor-pairs.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusGroupedAccessorPairs(t *testing.T) {
  assertRuleCorpusCase(t, "grouped-accessor-pairs.ts", "// Positive: the `get value` and `set value` accessors are split apart by an\n// unrelated method, so a reader scanning the class has to chase the pair\n// across the body — the rule wants getter/setter pairs to sit together.\nclass Splayed {\n  private state = 0;\n\n  get value(): number {\n    return this.state;\n  }\n\n  other(): void {\n    this.state += 1;\n  }\n\n  // expect: grouped-accessor-pairs error\n  set value(next: number) {\n    this.state = next;\n  }\n}\n\n// Negative: the matching `get` and `set` declarations are adjacent, which\n// is the layout the rule wants every accessor pair to follow.\nclass Grouped {\n  private state = 0;\n\n  get value(): number {\n    return this.state;\n  }\n  set value(next: number) {\n    this.state = next;\n  }\n}\n\n// Positive: object literals are inspected too. This one splits its\n// `get total` and `set total` halves with an unrelated method between them,\n// so the trailing setter is reported just like the split class above.\nlet counted = 0;\nconst splitObject = {\n  get total(): number {\n    return counted;\n  },\n  bump(): void {\n    counted += 1;\n  },\n  // expect: grouped-accessor-pairs error\n  set total(next: number) {\n    counted = next;\n  },\n};\n\n// Negative: the object literal keeps its `get`/`set` pair adjacent, the\n// grouped layout the rule wants, so nothing is reported.\nconst groupedObject = {\n  get total(): number {\n    return counted;\n  },\n  set total(next: number) {\n    counted = next;\n  },\n};\n\nJSON.stringify({\n  splayed: new Splayed(),\n  grouped: new Grouped(),\n  splitObject,\n  groupedObject,\n});\n")
}
