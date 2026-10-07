package strip_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestCommandStripsEmbeddedStatementForms verifies strip traversal through nested syntax.
//
// Calls can appear as standalone statements or as the embedded body of control
// flow nodes. This fixture walks each embedded-statement branch through the
// real transform path so the rewriter preserves structure while replacing only
// stripped bodies with empty statements. Configuration is supplied via a
// strip.config.json file rather than inline tsconfig keys.
//
//  1. Create a script using if, loops, with, labels, wildcard calls, and retained calls;
//     supply explicit calls and debugger config via strip.config.json.
//  2. Run transform with a manifest carrying no inline config, so the
//     strip.config.json is auto-discovered from the tsconfig directory.
//  3. Assert stripped calls disappear while non-target calls and non-call expressions remain.
//
// @evidence contracts/testing.md#behavioral-verification One configured transform (strip.config.json auto-discovered; calls console.log, console.debug, assert.*, drop; statements debugger) must remove debugger, every console.log( call including those in if, do, while, for, for-in, for-of, with, label and block bodies, the else-branch console.debug, the assert.* wildcard call and the bare drop() call; retained keep(...) calls, console.info, keep(console.log), console["log"](...) and getConsole().log(...) must remain in the output.
// @evidence contracts/testing.md#independent-expectations The authored calls/statements JSON and literal removed/retained markers determine independent expectations. Text presence checks do not prove complete emitted grammar or runtime behavior.
// @evidence contracts/testing.md#distinguishing-cases Positive targets differ from keep calls, console.info, passing console.log as a value, console["log"] and getConsole().log. All supported embedded-statement forms share one project and invocation.
// @evidence contracts/testing.md#execution-ownership Unit entry TestCommandStripsEmbeddedStatementForms is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. It dispatches through utility.RunCommandWithIO, the same entry the standalone sidecar's main delegates to, with invocation-owned buffers and a t.TempDir fixture; no producer binary or child process is built or started. The real compiler-plus-installed-package connection is owned by the strip scenes of tests/test-e2e.
func TestCommandStripsEmbeddedStatementForms(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":     `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":false},"include":["src"]}`,
    "strip.config.json": `{"calls":["console.log","console.debug","assert.*","drop"],"statements":["debugger"]}`,
    "src/main.ts": `// @ts-nocheck
let flag = true;
let obj: any = { value: 1 };
let arr: any[] = [1];
function keep(value?: unknown) { return value; }
function getConsole(): any { return console; }
const assert = { equal(value: unknown) { return value; } };
function drop() {}
debugger;
if (flag) console.log("if");
else console.debug("else");
if (!flag) keep("if-keep");
do console.log("do"); while (false);
while (flag) console.log("while");
for (let i = 0; i < 1; i++) console.log("for");
for (const key in obj) console.log(key);
for (const value of arr) console.log(value);
with (obj) console.log(value);
label: console.log("label");
if (flag) { console.log("block"); keep("block"); }
assert.equal("wildcard");
drop();
console.info("keep");
keep(console.log);
console["log"]("keep-element");
getConsole().log("keep-call-left");
`,
  })
  // Config-file path: auto-discovered from the tsconfig directory.
  manifest := shared.MustJSON(t, []map[string]any{{
    "name":  "@ttsc/strip",
    "stage": "transform",
    "config": map[string]any{
      "transform": "@ttsc/strip",
    },
  }})

  code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+manifest)
  if code != 0 || stderr != "" {
    t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var result transformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
    t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
  }
  main := result.TypeScript["src/main.ts"]
  for _, removed := range []string{"debugger", `"if"`, `"else"`, `"do"`, `"while"`, `"for"`, `"label"`, `"wildcard"`, "console.log(", "console.debug(", "assert.equal(", "drop();"} {
    if strings.Contains(main, removed) {
      t.Fatalf("strip target %q leaked into output:\n%s", removed, main)
    }
  }
  for _, retained := range []string{`keep("if-keep")`, `keep("block")`, `console.info("keep")`, `keep(console.log)`, `console["log"]("keep-element")`, `getConsole().log("keep-call-left")`} {
    if !strings.Contains(main, retained) {
      t.Fatalf("retained statement %q missing:\n%s", retained, main)
    }
  }
}
