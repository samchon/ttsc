package linthost

import (
  "path/filepath"
  "testing"
)

// TestNoUnnecessaryTypeArgumentsPreservesCallableSemantics verifies that generic
// defaults belong to the selected call signature rather than an arbitrary symbol
// declaration, and that specializing a function or class value retains its arguments.
//
// @evidence contracts/testing.md#behavioral-verification Actual in-process check compares complete literal finding lines for overload, callable-interface and function-type calls, and requires clean checks for local and imported function/class value instantiations.
// @evidence contracts/testing.md#independent-expectations Authored overload tags select the number-default signature independently of declaration order; explicit instantiation produces a specialized callable or constructor, whereas removing its arguments would restore the generic value.
// @evidence contracts/testing.md#distinguishing-cases Each selected-signature default-equal call contrasts a distinct argument; local and imported value instantiation contrast calls, exercising the adjacent syntax that alias resolution must not misdiagnose.
// @evidence contracts/testing.md#execution-ownership The discoverable public Go unit owns its named subcases and uses real multi-file Programs and Checkers through the in-process check command, without child hosts or native compilation.
func TestNoUnnecessaryTypeArgumentsPreservesCallableSemantics(t *testing.T) {
  cases := []struct {
    name   string
    source string
    lines  []int
  }{
    {
      name: "resolved overload",
      source: `declare function choose<T = string>(tag: "first"): T;
declare function choose<T = number>(tag: "second"): T;
const repeated = choose<number>("second");
const distinct = choose<string>("second");
`,
      lines: []int{3},
    },
    {
      name: "callable interface",
      source: `interface Callable { <T = string>(): T; }
declare const callable: Callable;
const repeated = callable<string>();
const distinct = callable<number>();
`,
      lines: []int{3},
    },
    {
      name: "function type",
      source: `declare const callable: <T = string>() => T;
const repeated = callable<string>();
const distinct = callable<number>();
`,
      lines: []int{2},
    },
    {
      name: "local function value",
      source: `declare function make<T = string>(): T;
const specialized = make<string>;
const result: string = specialized();
`,
    },
    {
      name: "imported function value",
      source: `import { make } from './origin';
const specialized = make<string>;
const result: string = specialized();
`,
    },
    {
      name: "local class value",
      source: `class Box<T = string> {}
const Specialized = Box<string>;
const value = new Specialized();
`,
    },
    {
      name: "imported class value",
      source: `import { Box } from './origin';
const Specialized = Box<string>;
const value = new Specialized();
`,
    },
  }
  const rule = "typescript/no-unnecessary-type-arguments"
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      root := seedLintProject(t, test.source)
      writeFile(t, filepath.Join(root, "src", "origin.ts"), "export declare function make<T = string>(): T;\nexport class Box<T = string> {}\n")
      seedLintRules(t, root, map[string]string{rule: "error"})
      code, stdout, stderr := captureCommandOutput(t, func() int {
        return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
      })
      if len(test.lines) == 0 {
        if code != 0 || stdout != "" || stderr != "" {
          t.Fatalf("instantiation must retain its specialization: code=%d stdout=%q stderr=%q", code, stdout, stderr)
        }
        return
      }
      if code != 2 || stdout != "" {
        t.Fatalf("call diagnostics: code=%d stdout=%q stderr=%q", code, stdout, stderr)
      }
      assertTypedRuleRenderedErrors(t, rule, stderr, test.lines...)
    })
  }
}
