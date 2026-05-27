package linthost

import "testing"

// TestRuleCorpusNoRedundantTypeConstituents verifies the lint rule corpus fixture
// typescript-no-redundant-type-constituents.ts.
//
// The AST-only baseline pins the syntactic cases the upstream rule can catch
// without consulting the Checker: `T | any` / `T | unknown` collapses to the
// top type, `T | never` drops the `never`, `T & never` collapses to `never`,
// `T & unknown` drops the `unknown`, and duplicates by textual identity fire
// on the second occurrence. Subset relations and generic alias resolution
// still require the type-aware path.
//
//  1. Load the annotated TypeScript fixture source embedded below.
//  2. Enable the rule severities declared by its `// expect:` comments.
//  3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoRedundantTypeConstituents(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-no-redundant-type-constituents.ts",
		"// Positive: union with `any` absorbs every other constituent.\n"+
			"// expect: typescript/no-redundant-type-constituents error\n"+
			"type WithAny = string | any;\n"+
			"\n"+
			"// Positive: union with `unknown` absorbs every other constituent.\n"+
			"// expect: typescript/no-redundant-type-constituents error\n"+
			"type WithUnknown = string | unknown;\n"+
			"\n"+
			"// Positive: `never` disappears from a union.\n"+
			"// expect: typescript/no-redundant-type-constituents error\n"+
			"type UnionNever = string | never;\n"+
			"\n"+
			"// Positive: `T & never` collapses to `never` — both constituents fire.\n"+
			"// expect: typescript/no-redundant-type-constituents error\n"+
			"// expect: typescript/no-redundant-type-constituents error\n"+
			"type InterNever = string & never;\n"+
			"\n"+
			"// Positive: `unknown` disappears from an intersection.\n"+
			"// expect: typescript/no-redundant-type-constituents error\n"+
			"type InterUnknown = string & unknown;\n"+
			"\n"+
			"// Positive: duplicate constituent in a union fires on the second.\n"+
			"// expect: typescript/no-redundant-type-constituents error\n"+
			"type DupeUnion = string | string;\n"+
			"\n"+
			"// Positive: duplicate constituent in an intersection fires on the second.\n"+
			"// expect: typescript/no-redundant-type-constituents error\n"+
			"type DupeInter = { a: 1 } & { a: 1 };\n"+
			"\n"+
			"// Negative: distinct constituents are fine.\n"+
			"type Ok1 = string | number;\n"+
			"type Ok2 = { a: 1 } & { b: 2 };\n"+
			"\n"+
			"// Use every declaration so it survives `isolatedModules` style checks.\n"+
			"declare const samples: [\n"+
			"  WithAny,\n"+
			"  WithUnknown,\n"+
			"  UnionNever,\n"+
			"  InterNever,\n"+
			"  InterUnknown,\n"+
			"  DupeUnion,\n"+
			"  DupeInter,\n"+
			"  Ok1,\n"+
			"  Ok2,\n"+
			"];\n"+
			"JSON.stringify(samples);\n")
}
