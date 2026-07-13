package linthost

import (
  "reflect"
  "testing"
)

// TestNoMisusedPromisesOptions verifies independent scalar and every
// positional option gate.
//
// 1. Disable each void-return position independently against one shared case.
// 2. Require every other position to keep reporting in each run.
// 3. Disable conditions and spreads independently from void-return checks.
func TestNoMisusedPromisesOptions(t *testing.T) {
  voidSource := `declare function consume(callback: () => void): void;
declare global { namespace JSX { interface IntrinsicElements { button: { onClick?: () => void } } } }

consume(async () => {});
const view = <button onClick={async () => {}} />;
interface Contract { execute(): void; }
class Implementation implements Contract { async execute(): Promise<void> {} }
const property: { run: () => void } = { run: async () => {} };
function factory(): () => void { return async () => {}; }
const variable: () => void = async () => {};
function resources(): void {
  using invalid = { async [Symbol.dispose](): Promise<void> {} };
  void invalid;
}
void [Implementation, property, factory, variable, resources, view];
export {};
`
  positions := []struct {
    name  string
    lines []int
  }{
    {"arguments", []int{4}},
    {"attributes", []int{5}},
    {"inheritedMethods", []int{7}},
    {"properties", []int{8}},
    {"returns", []int{9}},
    {"variables", []int{10, 12}},
  }
  allLines := []int{4, 5, 7, 8, 9, 10, 12}
  for _, disabled := range positions {
    t.Run(disabled.name, func(t *testing.T) {
      disabledLines := make(map[int]bool, len(disabled.lines))
      for _, line := range disabled.lines {
        disabledLines[line] = true
      }
      expected := make([]int, 0, len(allLines)-len(disabled.lines))
      for _, line := range allLines {
        if !disabledLines[line] {
          expected = append(expected, line)
        }
      }
      lines, code, stdout, stderr := runNoMisusedPromisesCase(t, "main.tsx", voidSource, map[string]any{
        "checksVoidReturn": map[string]any{disabled.name: false},
      })
      if code != 2 || stdout != "" || !reflect.DeepEqual(lines, expected) {
        t.Fatalf("%s option mismatch: code=%d stdout=%q lines=%v want=%v stderr=%s", disabled.name, code, stdout, lines, expected, stderr)
      }
    })
  }

  lines, code, stdout, stderr := runNoMisusedPromisesCase(t, "main.tsx", voidSource, map[string]any{
    "checksVoidReturn": false,
  })
  if code != 0 || stdout != "" || len(lines) != 0 {
    t.Fatalf("checksVoidReturn option mismatch: code=%d stdout=%q lines=%v stderr=%s", code, stdout, lines, stderr)
  }

  scalarSource := `declare const condition: Promise<boolean>;
const promisedObject = Promise.resolve({ value: 1 });
if (condition) {}
const spread = { ...promisedObject };
void spread;
`
  scalarCases := []struct {
    name     string
    options  map[string]any
    expected []int
  }{
    {"conditionals", map[string]any{"checksConditionals": false}, []int{4}},
    {"spreads", map[string]any{"checksSpreads": false}, []int{3}},
    {"both", map[string]any{"checksConditionals": false, "checksSpreads": false}, []int{}},
  }
  for _, test := range scalarCases {
    t.Run(test.name, func(t *testing.T) {
      lines, code, stdout, stderr := runNoMisusedPromisesCase(t, "main.ts", scalarSource, test.options)
      expectedCode := 2
      if len(test.expected) == 0 {
        expectedCode = 0
      }
      if code != expectedCode || stdout != "" || !reflect.DeepEqual(lines, test.expected) {
        t.Fatalf("%s option mismatch: code=%d stdout=%q lines=%v want=%v stderr=%s", test.name, code, stdout, lines, test.expected, stderr)
      }
    })
  }
}
