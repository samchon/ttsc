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
}
