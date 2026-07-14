package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoEmptyFunctionAllowCategories verifies every canonical allow value maps
// to exactly the corresponding TypeScript AST function kind.
func TestNoEmptyFunctionAllowCategories(t *testing.T) {
  tests := []struct {
    option string
    source string
  }{
    {option: "functions", source: `function empty() {}`},
    {option: "arrowFunctions", source: `const empty = () => {};`},
    {option: "generatorFunctions", source: `function* empty() {}`},
    {option: "methods", source: `class Example { method() {} }`},
    {option: "generatorMethods", source: `class Example { *method() {} }`},
    {option: "getters", source: `class Example { get value() {} }`},
    {option: "setters", source: `class Example { set value(_value: unknown) {} }`},
    {option: "constructors", source: `class Example { constructor() {} }`},
    {option: "asyncFunctions", source: `async function empty() {}`},
    {option: "asyncMethods", source: `class Example { async method() {} }`},
    {option: "privateConstructors", source: `class Example { private constructor() {} }`},
    {option: "protectedConstructors", source: `class Example { protected constructor() {} }`},
    {
      option: "decoratedFunctions",
      source: `declare function decorate(...args: unknown[]): unknown;
class Example { @decorate method() {} }`,
    },
    {
      option: "overrideMethods",
      source: `class Base { method() { return; } }
class Example extends Base { override method() {} }`,
    },
  }

  for _, test := range tests {
    t.Run(test.option, func(t *testing.T) {
      _, _, defaultFindings := runRuleFindingsSnapshot(t, "no-empty-function", test.source, nil)
      if len(defaultFindings) != 1 {
        t.Fatalf("default finding count = %d, want 1; findings=%+v", len(defaultFindings), defaultFindings)
      }
      options, err := json.Marshal(noEmptyFunctionOptions{Allow: []string{test.option}})
      if err != nil {
        t.Fatal(err)
      }
      _, _, allowedFindings := runRuleFindingsSnapshot(t, "no-empty-function", test.source, options)
      if len(allowedFindings) != 0 {
        t.Fatalf("finding count with allow %q = %d, want 0; findings=%+v", test.option, len(allowedFindings), allowedFindings)
      }
    })
  }
}

// TestNoEmptyFunctionCommentsPreserveEveryKind ensures a comment must be
// inside each function body's braces and works for every primary function kind.
func TestNoEmptyFunctionCommentsPreserveEveryKind(t *testing.T) {
  source := `function ordinary() { /* intentional */ }
const arrow = () => { /* intentional */ };
function* generator() { /* intentional */ }
async function asynchronous() { /* intentional */ }
class Example {
  constructor() { /* intentional */ }
  method() { /* intentional */ }
  *generatorMethod() { /* intentional */ }
  async asyncMethod() { /* intentional */ }
  get value() { /* intentional */ }
  set value(_value: unknown) { /* intentional */ }
}
void [ordinary, arrow, generator, asynchronous, Example];`
  _, _, findings := runRuleFindingsSnapshot(t, "no-empty-function", source, nil)
  if len(findings) != 0 {
    t.Fatalf("commented function bodies produced findings: %+v", findings)
  }
}

// TestNoEmptyFunctionTypeScriptExceptionsAndCategoryBoundaries protects the
// parameter-property exception and categories that deliberately do not widen
// to nearby function shapes.
func TestNoEmptyFunctionTypeScriptExceptionsAndCategoryBoundaries(t *testing.T) {
  tests := []struct {
    name    string
    source  string
    allow   []string
    want    int
  }{
    {
      name:   "parameter property constructor always has work",
      source: `class Example { constructor(public value: number) {} }`,
    },
    {
      name: "private constructor option stays private",
      source: `class PrivateExample { private constructor() {} }
class PublicExample { constructor() {} }`,
      allow: []string{"privateConstructors"},
      want:  1,
    },
    {
      name: "decorated option stays decorated",
      source: `declare function decorate(...args: unknown[]): unknown;
class Example {
  @decorate decorated() {}
  ordinary() {}
}`,
      allow: []string{"decoratedFunctions"},
      want:  1,
    },
    {
      name: "override option stays override",
      source: `class Base { method() { return; } }
class Example extends Base {
  override method() {}
  ordinary() {}
}`,
      allow: []string{"overrideMethods"},
      want:  1,
    },
    {
      name:   "async function option does not include async arrows",
      source: `const empty = async () => {};`,
      allow:  []string{"asyncFunctions"},
      want:   1,
    },
    {
      name:   "arrow option includes async arrows",
      source: `const empty = async () => {};`,
      allow:  []string{"arrowFunctions"},
    },
    {
      name:   "async generator method uses generator category",
      source: `class Example { async *method() {} }`,
      allow:  []string{"generatorMethods"},
    },
    {
      name:   "async method category excludes async generators",
      source: `class Example { async *method() {} }`,
      allow:  []string{"asyncMethods"},
      want:   1,
    },
    {
      name:   "exterior comments do not preserve function",
      source: `/* before */ function empty() {} /* after */`,
      want:   1,
    },
    {
      name:   "object property function remains a function",
      source: `const object = { value: function () {} };`,
      allow:  []string{"functions"},
    },
  }

  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      var options json.RawMessage
      if len(test.allow) != 0 {
        encoded, err := json.Marshal(noEmptyFunctionOptions{Allow: test.allow})
        if err != nil {
          t.Fatal(err)
        }
        options = encoded
      }
      _, _, findings := runRuleFindingsSnapshot(t, "no-empty-function", test.source, options)
      if len(findings) != test.want {
        t.Fatalf("finding count = %d, want %d; findings=%+v", len(findings), test.want, findings)
      }
    })
  }
}
