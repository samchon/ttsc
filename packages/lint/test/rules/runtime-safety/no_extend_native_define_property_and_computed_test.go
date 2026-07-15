package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoExtendNativeDefinePropertyAndComputed covers the three prototype-
// extension shapes beyond the plain `X.prototype.y = …` assignment that the
// rule originally missed, mirroring ESLint's no-extend-native.
//
// Upstream flags any member write to a native `<Builtin>.prototype` plus
// `Object.defineProperty` / `Object.defineProperties` calls whose first
// argument is such a prototype. The negatives pin the boundary: a non-native
// receiver and a define-property target that is not a prototype must stay
// silent.
//
//  1. Parse each fixture with no type checker (AST-only rule).
//  2. Run the engine with only no-extend-native enabled.
//  3. Assert the finding count and, for the positives, the builtin in the message.
func TestNoExtendNativeDefinePropertyAndComputed(t *testing.T) {
  tests := []struct {
    name        string
    source      string
    wantBuiltin string // "" means no finding is expected
  }{
    {
      name:        "Object.defineProperty on a native prototype",
      source:      `Object.defineProperty(Array.prototype, "foo", { value: 1 });`,
      wantBuiltin: "Array",
    },
    {
      name:        "Object.defineProperties on a native prototype",
      source:      `Object.defineProperties(Array.prototype, { foo: { value: 1 } });`,
      wantBuiltin: "Array",
    },
    {
      name:        "computed string assignment to a native prototype",
      source:      `Array.prototype["baz"] = 1;`,
      wantBuiltin: "Array",
    },
    {
      name:   "assignment to a non-native prototype stays silent",
      source: `Foo.prototype.bar = 1;`,
    },
    {
      name:   "defineProperty on a non-prototype target stays silent",
      source: `Object.defineProperty(target, "x", { value: 1 });`,
    },
  }
  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      file := parseTS(t, test.source)
      findings := NewEngine(RuleConfig{"no-extend-native": SeverityError}).
        Run([]*shimast.SourceFile{file}, nil)
      if test.wantBuiltin == "" {
        if len(findings) != 0 {
          t.Fatalf("expected no findings, got %d: %+v", len(findings), findings)
        }
        return
      }
      if len(findings) != 1 {
        t.Fatalf("expected 1 finding, got %d: %+v", len(findings), findings)
      }
      want := test.wantBuiltin + " prototype is read only, properties should not be added."
      if findings[0].Message != want {
        t.Fatalf("message = %q, want %q", findings[0].Message, want)
      }
    })
  }
}
