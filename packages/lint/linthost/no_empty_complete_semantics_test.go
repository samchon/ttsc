package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoEmptyCompleteSemantics protects the authored empty bodies, switch
// handling, the catch option, and exact interior-comment boundaries.
//
// @evidence contracts/testing.md#behavioral-verification Reports empty control-flow bodies and switch while preserving intentional interior comments, nonempty bodies and the exact catch option scope.
// @evidence contracts/testing.md#independent-expectations Authored per-row counts follow no-empty policy: exterior comments do not explain an empty body, and allowEmptyCatch affects only catch.
// @evidence contracts/testing.md#distinguishing-cases Twenty-one named cases cover loop/block/switch/try/catch/finally, inside/outside comments, sibling function/static bodies and nonempty controls.
// @evidence contracts/testing.md#execution-ownership This Test registers every named table row with t.Run, then runRuleFindingsSnapshot executes no-empty using its exact source/options. Each subcase owns its literal finding-count expectation. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoEmptyCompleteSemantics(t *testing.T) {
  tests := []struct {
    name    string
    source  string
    options json.RawMessage
    want    int
  }{
    {name: "if block", source: `declare const value: boolean; if (value) {}`, want: 1},
    {name: "while block", source: `declare const value: boolean; while (value) {}`, want: 1},
    {name: "do block", source: `declare const value: boolean; do {} while (value);`, want: 1},
    {name: "for block", source: `declare const value: boolean; for (; value;) {}`, want: 1},
    {name: "for in block", source: `declare const object: object; for (const key in object) {}`, want: 1},
    {name: "for of block", source: `declare const values: unknown[]; for (const value of values) {}`, want: 1},
    {name: "standalone block", source: `{}`, want: 1},
    {name: "empty switch", source: `declare const value: boolean; switch (value) {}`, want: 1},
    {name: "try catch finally blocks", source: `try {} catch {} finally {}`, want: 3},
    {name: "catch is rejected by default", source: `try { work(); } catch {}`, want: 1},
    {
      name:    "allowEmptyCatch accepts catch",
      source:  `try { work(); } catch {}`,
      options: json.RawMessage(`{"allowEmptyCatch":true}`),
    },
    {
      name:    "allowEmptyCatch does not accept other blocks",
      source:  `declare const value: boolean; if (value) {}`,
      options: json.RawMessage(`{"allowEmptyCatch":true}`),
      want:    1,
    },
    {
      name: "interior comments preserve all control blocks",
      source: `declare const value: boolean;
if (value) { /* intentional */ }
while (value) { /* intentional */ }
do { /* intentional */ } while (value);
for (; value;) { /* intentional */ }
for (const key in { value }) { /* intentional */ }
for (const item of [value]) { /* intentional */ }
switch (value) { /* intentional */ }
try { /* intentional */ } catch { /* intentional */ } finally { /* intentional */ }`,
    },
    {
      name:   "comments outside braces do not preserve block",
      source: `declare const value: boolean; /* before */ if (value) {} /* after */`,
      want:   1,
    },
    {
      name:   "comment before block opening brace stays exterior",
      source: `declare const value: boolean; if (value) /* before brace */ {}`,
      want:   1,
    },
    {
      name:   "comments outside switch braces do not preserve switch",
      source: `declare const value: boolean; /* before */ switch (value) {} /* after */`,
      want:   1,
    },
    {
      name:   "comment before switch opening brace stays exterior",
      source: `declare const value: boolean; switch (value) /* before brace */ {}`,
      want:   1,
    },
    {name: "function body belongs to sibling rule", source: `function empty() {}`},
    {name: "static body belongs to sibling rule", source: `class Example { static {} }`},
    {name: "nonempty block", source: `declare const value: boolean; if (value) { work(); }`},
    {name: "nonempty switch", source: `declare const value: boolean; switch (value) { default: break; }`},
  }

  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "no-empty", test.source, test.options)
      if len(findings) != test.want {
        t.Fatalf("finding count = %d, want %d; findings=%+v", len(findings), test.want, findings)
      }
    })
  }
}
