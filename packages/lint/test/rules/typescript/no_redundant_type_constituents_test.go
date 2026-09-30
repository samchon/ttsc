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
// @evidence contracts/testing.md#behavioral-verification Syntactically redundant union/intersection constituents must report.
// @evidence contracts/testing.md#independent-expectations Eight authored markers fix complete errors including two for string&never; any/unknown/never and textual duplicates have independent occurrences.
// @evidence contracts/testing.md#distinguishing-cases Distinct primitive union and distinct object intersection stay clean; checker-backed subset or generic-alias reasoning is outside this oracle.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoRedundantTypeConstituents executes the AST Engine through assertRuleCorpusCase in the shared Go unit population; every original source/marker is preserved and no native artifact build, installation or child compiler runs.
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
