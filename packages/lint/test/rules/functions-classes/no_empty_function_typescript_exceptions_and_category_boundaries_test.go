package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoEmptyFunctionTypeScriptExceptionsAndCategoryBoundaries protects the
// parameter-property exception and categories that deliberately do not widen
// to nearby function shapes.
//
// @evidence contracts/testing.md#behavioral-verification Named cases compare exact finding counts for parameter-property work, category exclusions and exterior comments.
// @evidence contracts/testing.md#independent-expectations Authored allow lists and constructor initialization semantics distinguish actual work and precise category membership; fixed counts are not generated from findings.
// @evidence contracts/testing.md#distinguishing-cases Private/decorated/override versus ordinary, async versus generator/arrow, inner versus exterior comments and function/object expression boundaries retain all original counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoEmptyFunctionTypeScriptExceptionsAndCategoryBoundaries is selected in the shared Go unit population. Every named table subtest calls runRuleFindingsSnapshot with its explicit source and optional JSON allow input; original names remain failure identities. No consumer install, native artifact build or real host runs.
func TestNoEmptyFunctionTypeScriptExceptionsAndCategoryBoundaries(t *testing.T) {
  tests := []struct {
    name   string
    source string
    allow  []string
    want   int
  }{
    {
      name: "every parameter property constructor always has work",
      source: `class PublicExample { constructor(public value: number) {} }
class PrivateExample { constructor(private value: number) {} }
class ProtectedExample { constructor(protected value: number) {} }
class ReadonlyExample { constructor(readonly value: number) {} }
class Base { value = 0; }
class OverrideExample extends Base { constructor(override value: number) {} }`,
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
      name:   "async function expression reports by default",
      source: `const empty = async function () {};`,
      want:   1,
    },
    {
      name:   "async function expressions use async function category",
      source: `const empty = async function () {};`,
      allow:  []string{"asyncFunctions"},
    },
    {
      name:   "async generator functions use generator category",
      source: `const empty = async function* () {};`,
      allow:  []string{"generatorFunctions"},
    },
    {
      name:   "async function category excludes async generators",
      source: `const empty = async function* () {};`,
      allow:  []string{"asyncFunctions"},
      want:   1,
    },
    {
      name:   "concise arrows have no empty block body",
      source: `const identity = (value: unknown) => value;`,
    },
    {
      name:   "nonempty functions remain accepted",
      source: `function work() { return; }`,
    },
    {
      name:   "exterior comments do not preserve function",
      source: `/* before */ function empty() {} /* after */`,
      want:   1,
    },
    {
      name:   "comment before function opening brace stays exterior",
      source: `function empty() /* before brace */ {}`,
      want:   1,
    },
    {
      name:   "object property function remains a function",
      source: `const object = { value: function () {} };`,
      allow:  []string{"functions"},
    },
    {
      name:   "function expression reports by default",
      source: `const empty = function () {};`,
      want:   1,
    },
    {
      name:   "functions includes function expressions",
      source: `const empty = function () {};`,
      allow:  []string{"functions"},
    },
    {
      name:   "generator expression reports by default",
      source: `const empty = function* () {};`,
      want:   1,
    },
    {
      name:   "generator functions includes expressions",
      source: `const empty = function* () {};`,
      allow:  []string{"generatorFunctions"},
    },
    {
      name:   "object method reports by default",
      source: `const object = { method() {} };`,
      want:   1,
    },
    {
      name:   "methods includes object methods",
      source: `const object = { method() {} };`,
      allow:  []string{"methods"},
    },
    {
      name: "decorated method family reports by default",
      source: `declare function decorate(...args: unknown[]): unknown;
class Example {
  @decorate method() {}
  @decorate *generatorMethod() {}
  @decorate async asyncMethod() {}
  @decorate get first() {}
  @decorate set second(_value: unknown) {}
}`,
      want: 5,
    },
    {
      name: "decorated option includes methods and accessors",
      source: `declare function decorate(...args: unknown[]): unknown;
class Example {
  @decorate method() {}
  @decorate *generatorMethod() {}
  @decorate async asyncMethod() {}
  @decorate get first() {}
  @decorate set second(_value: unknown) {}
}`,
      allow: []string{"decoratedFunctions"},
    },
    {
      name: "override method family reports by default",
      source: `class Base {
  method() { return; }
  *generatorMethod() { yield 1; }
  async asyncMethod() { return; }
  get first() { return 1; }
  set second(_value: unknown) { return; }
}
class Example extends Base {
  override method() {}
  override *generatorMethod() {}
  override async asyncMethod() {}
  override get first() {}
  override set second(_value: unknown) {}
}`,
      want: 5,
    },
    {
      name: "override option includes methods and accessors",
      source: `class Base {
  method() { return; }
  *generatorMethod() { yield 1; }
  async asyncMethod() { return; }
  get first() { return 1; }
  set second(_value: unknown) { return; }
}
class Example extends Base {
  override method() {}
  override *generatorMethod() {}
  override async asyncMethod() {}
  override get first() {}
  override set second(_value: unknown) {}
}`,
      allow: []string{"overrideMethods"},
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
