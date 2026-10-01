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
// @evidence contracts/testing.md#behavioral-verification One configured native transform (strip.config.json auto-discovered; calls console.log, console.debug, assert.*, drop; statements debugger) must remove debugger, every console.log( call including those in if, do, while, for, for-in, for-of, with, label and block bodies, the else-branch console.debug, the assert.* wildcard call and the bare drop() call; retained keep(...) calls, console.info, keep(console.log), console["log"](...) and getConsole().log(...) must remain in the output.
// @evidence contracts/testing.md#independent-expectations The authored calls/statements JSON and literal removed/retained markers determine independent expectations. Text presence checks do not prove complete emitted grammar or runtime behavior.
// @evidence contracts/testing.md#distinguishing-cases Positive targets differ from keep calls, console.info, passing console.log as a value, console["log"] and getConsole().log. All supported embedded-statement forms share one project and invocation.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandStripsEmbeddedStatementForms entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The compiler and strip transformer must connect across parsed control-flow bodies into serialized TypeScript. Most traversal decisions are portable semantics and remain candidates for exact direct-unit ownership; this entry does not certify that the remaining native execution is minimal.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one transform process over one seeded project containing every embedded-statement form from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedProject writes the fixture project under t.TempDir, which the test framework removes at cleanup; the single transform process exits before stdout is decoded. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status/stderr check (L73), JSON decode (L77), the removed-marker loop (L81, now including console.log() ) and the retained-marker loop (L86) are all made in this body; text presence does not prove the printed TypeScript parses.
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
