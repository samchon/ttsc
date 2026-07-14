package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoEmptyCompleteSemantics protects every empty control-flow body, switch
// handling, the catch option, and exact interior-comment boundaries.
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

// TestNoEmptyStaticBlockCommentBoundaries ensures only comments between the
// static block's own braces make the empty block intentional.
func TestNoEmptyStaticBlockCommentBoundaries(t *testing.T) {
  tests := []struct {
    name   string
    source string
    want   int
  }{
    {name: "empty", source: `class Example { static {} }`, want: 1},
    {name: "interior block comment", source: `class Example { static { /* intentional */ } }`},
    {name: "interior line comment", source: "class Example { static { // intentional\n} }"},
    {name: "leading exterior comment", source: `class Example { /* before */ static {} }`, want: 1},
    {name: "comment before opening brace", source: `class Example { static /* before brace */ {} }`, want: 1},
    {name: "trailing exterior comment", source: `class Example { static {} /* after */ }`, want: 1},
    {name: "nonempty", source: `class Example { static { initialize(); } }`},
  }

  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "no-empty-static-block", test.source, nil)
      if len(findings) != test.want {
        t.Fatalf("finding count = %d, want %d; findings=%+v", len(findings), test.want, findings)
      }
    })
  }
}
