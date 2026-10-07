package linthost

import (
  "strings"
  "testing"
)

// TestPreferConstTracksLexicalBindingIdentity verifies same-spelled bindings stay independent.
//
// The former file-global name map let a write in one function suppress stable
// bindings in sibling and shadowing scopes. Checker symbols must associate each
// write with only the declaration it resolves to, including closure writes.
//
//  1. Declare stable and reassigned `value` bindings in sibling functions.
//  2. Add a stable outer shadow plus mutable inner and closure-captured controls.
//  3. Assert only the two stable lexical bindings are reported.
//
// @evidence contracts/testing.md#behavioral-verification The command reports exactly the two stable value declarations at 2:7 and 13:7, preserving original status and count while detecting wrong-scope substitutions.
// @evidence contracts/testing.md#independent-expectations Literal authored declaration locations identify the stable sibling and outer shadow independently; sibling, inner-shadow and closure writes mutate different symbols.
// @evidence contracts/testing.md#distinguishing-cases Same-spelled stable and mutable siblings plus nested shadows distinguish lexical identity; the closure write remains a separate mutable control.
// @evidence contracts/testing.md#execution-ownership TestPreferConstTracksLexicalBindingIdentity seedLintProject writes a temp tsconfig project and the in-process run(check) command loads a real Program and Checker with only prefer-const enabled; the test requires exit code 2, empty stdout and two rendered [prefer-const] errors, and compares their line:column sites with assertBindingDiagnosticSites. No consumer install, native build or product host runs.
func TestPreferConstTracksLexicalBindingIdentity(t *testing.T) {
  root := seedLintProject(t, `function stableSibling(): number {
  let value = 1;
  return value;
}

function mutableSibling(): number {
  let value = 1;
  value += 1;
  return value;
}

function shadowed(): number {
  let value = 1;
  {
    let value = 2;
    value++;
    console.log(value);
  }
  return value;
}

function closureWrite(): () => number {
  let captured = 0;
  return () => ++captured;
}

console.log(stableSibling(), mutableSibling(), shadowed(), closureWrite()());
`)
  seedLintRules(t, root, map[string]string{"prefer-const": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[prefer-const]") != 2 {
    t.Fatalf("prefer-const lexical diagnostics mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertBindingDiagnosticSites(t, stderr, [][2]int{{2, 7}, {13, 7}})
}
