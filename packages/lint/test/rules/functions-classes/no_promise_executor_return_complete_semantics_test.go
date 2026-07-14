package linthost

import (
  "slices"
  "sort"
  "strings"
  "testing"
)

// TestNoPromiseExecutorReturnCompleteSemantics verifies the rule follows the
// global Promise binding through every executor return scope.
//
// The old implementation only inspected concise arrow bodies and matched the
// callee by text. These cases pin explicit returns in nested control flow,
// function-expression executors, global binding identity, and the function
// boundaries that must prevent an inner closure's return from leaking outward.
//
// 1. Run the rule against global Promise executors and collect every marked line.
// 2. Exercise concise, block, function-expression, and nested control-flow returns.
// 3. Assert local and top-level Promise bindings plus nested functions stay silent.
func TestNoPromiseExecutorReturnCompleteSemantics(t *testing.T) {
  cases := []struct {
    name   string
    source string
  }{
    {
      name: "global Promise executor scopes",
      source: `interface Promise<T> { marker?: T }
declare const condition: boolean;
declare function consume(value: unknown): void;

new Promise(() => 1); // diagnostic
new (Promise)(() => 2); // diagnostic
new Promise(() => {
  if (condition) {
    return 3; // diagnostic
  }
  try {
    return 4; // diagnostic
  } catch {
    return 5; // diagnostic
  }
});
new Promise(function executor() {
  switch (condition) {
    case true:
      return 6; // diagnostic
    default:
      return 7; // diagnostic
  }
});
new Promise(function Promise() {
  return 8; // diagnostic
});
new Promise(() => {
  function declared() {
    return 20;
  }
  const arrow = () => 21;
  const expression = function () {
    return 22;
  };
  class Nested {
    method() {
      return 23;
    }
  }
  consume([declared, arrow, expression, Nested]);
  return;
});
new Promise(() => {
  new Promise(() => 9); // diagnostic
});
new Promise(() => void consume(10)); // diagnostic
new Promise(() => {
  return void consume(11); // diagnostic
});

new globalThis.Promise(() => 12);
function parameterShadow(Promise: new (executor: () => unknown) => unknown) {
  new Promise(() => 13);
}
{
  class Promise {
    constructor(_executor: () => unknown) {}
  }
  new Promise(() => 14);
}
consume(parameterShadow);
`,
    },
    {
      name: "module top-level shadow",
      source: `let Promise = class {
  constructor(_executor: () => unknown) {}
};
new Promise(() => 1);
export {};
`,
    },
    {
      name: "script global value declaration",
      source: `declare var Promise: PromiseConstructor;
new Promise(() => 1);
`,
    },
  }

  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      expectedLines := make([]int, 0)
      for index, line := range strings.Split(testCase.source, "\n") {
        if strings.Contains(line, "// diagnostic") {
          expectedLines = append(expectedLines, index+1)
        }
      }

      _, _, findings := runRuleFindingsSnapshot(
        t,
        "no-promise-executor-return",
        testCase.source,
        nil,
      )
      actualLines := make([]int, 0, len(findings))
      for _, finding := range findings {
        if finding.Pos < 0 || finding.Pos > len(testCase.source) {
          t.Fatalf("finding position %d is outside source length %d", finding.Pos, len(testCase.source))
        }
        actualLines = append(actualLines, strings.Count(testCase.source[:finding.Pos], "\n")+1)
      }
      sort.Ints(actualLines)
      if !slices.Equal(actualLines, expectedLines) {
        t.Fatalf("diagnostic lines mismatch: want %v, got %v", expectedLines, actualLines)
      }
    })
  }
}
