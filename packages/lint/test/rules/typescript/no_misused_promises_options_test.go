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
void [Implementation, property, factory, variable, view];
export {};
`
  positions := []struct {
    name string
    line int
  }{
    {"arguments", 4},
    {"attributes", 5},
    {"inheritedMethods", 7},
    {"properties", 8},
    {"returns", 9},
    {"variables", 10},
  }
  allLines := []int{4, 5, 7, 8, 9, 10}
  for _, disabled := range positions {
    t.Run(disabled.name, func(t *testing.T) {
      expected := make([]int, 0, len(allLines)-1)
      for _, line := range allLines {
        if line != disabled.line {
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

  scalarSource := `declare const condition: Promise<boolean>;
const promisedObject = Promise.resolve({ value: 1 });
if (condition) {}
const spread = { ...promisedObject };
void spread;
`
  lines, code, stdout, stderr := runNoMisusedPromisesCase(t, "main.ts", scalarSource, map[string]any{
    "checksConditionals": false,
    "checksSpreads":      false,
  })
  if code != 0 || stdout != "" || len(lines) != 0 {
    t.Fatalf("option mismatch: code=%d stdout=%q lines=%v stderr=%s", code, stdout, lines, stderr)
  }
}
