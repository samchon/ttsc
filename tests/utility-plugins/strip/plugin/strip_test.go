// Unit tests for the strip output transform.
//
// The transform removes complete JavaScript statements. Declarations remain
// unchanged because strip patterns describe runtime code, not type output.
package main

import (
  "strings"
  "testing"
)

func TestApplyRemovesConfiguredCallsAndDebugger(t *testing.T) {
  out, err := Apply("/project/dist/main.js", strings.Join([]string{
    `"use strict";`,
    `debugger;`,
    `console.log("drop");`,
    `console.debug("drop");`,
    `assert.equal(1, 1);`,
    `console.info("keep");`,
    ``,
  }, "\n"), map[string]any{
    "calls":      []any{"console.log", "console.debug", "assert.*"},
    "statements": []any{"debugger"},
  })
  if err != nil {
    t.Fatal(err)
  }
  for _, dropped := range []string{"debugger", "console.log", "console.debug", "assert.equal"} {
    if strings.Contains(out, dropped) {
      t.Fatalf("expected %q to be stripped from:\n%s", dropped, out)
    }
  }
  if !strings.Contains(out, `console.info("keep")`) {
    t.Fatalf("expected non-matching call to stay:\n%s", out)
  }
}

func TestApplyRejectsMiddleWildcard(t *testing.T) {
  _, err := Apply("/project/dist/main.js", `console.log("x");`, map[string]any{
    "calls": []any{"console.*.bad"},
  })
  if err == nil || !strings.Contains(err.Error(), "wildcard is only supported at the end") {
    t.Fatalf("expected wildcard error, got %v", err)
  }
}

func TestApplySkipsDeclarations(t *testing.T) {
  const text = `declare const console: unknown;`
  out, err := Apply("/project/dist/main.d.ts", text, map[string]any{
    "calls": []any{"console.*"},
  })
  if err != nil {
    t.Fatal(err)
  }
  if out != text {
    t.Fatalf("declaration output should be unchanged: %q", out)
  }
}
