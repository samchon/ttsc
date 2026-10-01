package linthost

import (
  "strings"
  "testing"
)

// TestPreferConstHonorsDestructuringOption verifies partial-pattern policy.
//
// The default `any` policy reports stable leaves even when a sibling is
// reassigned. The `all` policy suppresses that partial pattern while still
// reporting every leaf of a wholly stable destructuring declaration.
//
//  1. Create partial declaration and assignment patterns plus one wholly stable pattern.
//  2. Run prefer-const under the default and `destructuring: "all"` policies.
//  3. Assert the finding counts are five and two respectively.
//
// @evidence contracts/testing.md#behavioral-verification The command preserves default five and all-policy two findings and compares their exact identifier sites, exposing missing or swapped stable leaves.
// @evidence contracts/testing.md#independent-expectations Authored sites identify second, stableFirst, stableSecond, assignedSecond and mixedAssigned under any; only both stable declaration leaves remain under all. Cross-scope var and parameter siblings prevent declaration conversion.
// @evidence contracts/testing.md#distinguishing-cases Partial declaration and assignment patterns differ from wholly stable patterns; initialized mutable, hoisted var and parameter siblings preserve the original excluded controls.
// @evidence contracts/testing.md#execution-ownership TestPreferConstHonorsDestructuringOption two temp projects are seeded with the same source and the in-process run(check) command is executed once under the default prefer-const setting and once with seedLintConfig destructuring all, each with a real Program and Checker; the finding counts (five, two) and every line:column site are compared with assertBindingDiagnosticSites. No consumer install, native build or product host runs.
func TestPreferConstHonorsDestructuringOption(t *testing.T) {
  source := `const input = { first: 1, second: 2 };
let { first, second } = input;
first += 1;

let { first: stableFirst, second: stableSecond } = input;

let assignedFirst: number, assignedSecond: number;
({ first: assignedFirst, second: assignedSecond } = input);
assignedFirst += 1;

let mixedAssigned: number;
let mixedMutable = 0;
[mixedAssigned, mixedMutable] = [1, 2];

{
  let nestedAssigned: number;
  var outerMutable = 0;
  [nestedAssigned, outerMutable] = [1, 2];
  console.log(nestedAssigned, outerMutable);
}

function keepParameter(parameter: number): void {
  let parameterSibling: number;
  [parameterSibling, parameter] = [1, 2];
  console.log(parameterSibling, parameter);
}

console.log(first, second, stableFirst, stableSecond, assignedFirst, assignedSecond, mixedAssigned, mixedMutable);
keepParameter(0);
`

  defaultRoot := seedLintProject(t, source)
  seedLintRules(t, defaultRoot, map[string]string{"prefer-const": "error"})
  defaultCode, defaultStdout, defaultStderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", defaultRoot, "--plugins-json", lintManifest(t)})
  })
  if defaultCode != 2 || defaultStdout != "" || strings.Count(defaultStderr, "[prefer-const]") != 5 {
    t.Fatalf("prefer-const destructuring any mismatch: code=%d stdout=%q stderr=%q", defaultCode, defaultStdout, defaultStderr)
  }

  allRoot := seedLintProject(t, source)
  seedLintConfig(t, allRoot, map[string]any{
    "rules": map[string]any{
      "prefer-const": []any{"error", map[string]any{"destructuring": "all"}},
    },
  })
  allCode, allStdout, allStderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", allRoot, "--plugins-json", lintManifest(t)})
  })
  if allCode != 2 || allStdout != "" || strings.Count(allStderr, "[prefer-const]") != 2 {
    t.Fatalf("prefer-const destructuring all mismatch: code=%d stdout=%q stderr=%q", allCode, allStdout, allStderr)
  }
  assertBindingDiagnosticSites(t, defaultStderr, [][2]int{{2, 14}, {5, 14}, {5, 35}, {8, 34}, {13, 2}})
  assertBindingDiagnosticSites(t, allStderr, [][2]int{{5, 14}, {5, 35}})
}
