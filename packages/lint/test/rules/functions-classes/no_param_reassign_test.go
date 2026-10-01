package linthost

import "testing"

func assertNoParamReassignCorpusCase(t *testing.T, relativeFile, source string) {
  t.Helper()
  expected := parseRuleExpectations(t, source)
  if len(expected) == 0 {
    t.Fatalf("%s has no rule expectations", relativeFile)
  }
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    "no-param-reassign",
    relativeFile,
    source,
    nil,
  )
  if len(findings) != len(expected) {
    t.Fatalf("%s: want %v, got %+v", relativeFile, expected, findings)
  }
  actual := normalizeRuleFindings(findings[0].File, findings)
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf(
        "%s[%d]: want %+v, got %+v; all findings=%+v",
        relativeFile,
        index,
        expected[index],
        actual[index],
        actual,
      )
    }
  }
}

// TestRuleCorpusNoParamReassign verifies the lint rule corpus fixture no-param-reassign.ts.
//
// The embedded annotated source is identical to packages/lint/test/testdata/corpus/no-param-reassign.ts,
// which TestLintFixtureCorpus also executes. Embedding it lets this entry drive
// the checker-backed assertion helper directly under the Go unit runner.
//
// 1. Embed the annotated TypeScript fixture source below.
// 2. Run only no-param-reassign, with default options, through runRuleFindingsSnapshotFile on a real Program and checker.
// 3. Assert the findings equal the // expect: annotations as rule, severity and line triples.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed Engine compares the four annotated simple/compound/prefix/postfix parameter-write findings by rule, severity and line, and the three clean controls (localOk, propertyOk, innerOk) must add no further finding.
// @evidence contracts/testing.md#independent-expectations Writes to the resolved parameter binding violate the default contract; independently authored annotations distinguish those from local-variable updates and allowed default property mutation.
// @evidence contracts/testing.md#distinguishing-cases All four annotated modifying-reference forms (assignment, compound assignment, prefix and postfix update) report; local writes, property changes and captured mutable local remain clean. The complete semantics tests own wider binding/write families.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoParamReassign is selected in the shared Go unit population. It calls assertNoParamReassignCorpusCase and runRuleFindingsSnapshotFile with a real Program/Checker on no-param-reassign.ts. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoParamReassign(t *testing.T) {
  assertNoParamReassignCorpusCase(t, "no-param-reassign.ts", "function reassignSimple(x: number): number {\n  // expect: no-param-reassign error\n  x = 1;\n  return x;\n}\n\nfunction reassignCompound(n: number): number {\n  // expect: no-param-reassign error\n  n += 5;\n  return n;\n}\n\nfunction reassignPrefix(i: number): number {\n  // expect: no-param-reassign error\n  ++i;\n  return i;\n}\n\nconst reassignPostfix = (i: number): number => {\n  // expect: no-param-reassign error\n  i--;\n  return i;\n};\n\n// Local variable assignment is fine.\nfunction localOk(x: number): number {\n  let total = 0;\n  total += x;\n  return total;\n}\n\n// Property mutation is left alone unless the `props` option is enabled.\nfunction propertyOk(obj: { count: number }): number {\n  obj.count = 5;\n  return obj.count;\n}\n\n// Reassigning a local variable in an inner function — the outer\n// parameter `x` is only read, never written.\nfunction innerOk(x: number): () => number {\n  let total = x;\n  return () => {\n    total = total + 1;\n    return total;\n  };\n}\n\nJSON.stringify([\n  reassignSimple(0),\n  reassignCompound(0),\n  reassignPrefix(0),\n  reassignPostfix(0),\n  localOk(0),\n  propertyOk({ count: 0 }),\n  innerOk(0)(),\n]);\n")
}
