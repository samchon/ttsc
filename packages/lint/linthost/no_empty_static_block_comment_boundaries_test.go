package linthost

import (
  "testing"
)

// TestNoEmptyStaticBlockCommentBoundaries ensures only comments between the
// static block's own braces make the empty block intentional.
//
// @evidence contracts/testing.md#behavioral-verification Reports empty static blocks and ignores only comments inside the static braces or actual statements.
// @evidence contracts/testing.md#independent-expectations Authored seven counts follow the supported intentional-empty policy; surrounding class comments are not interior evidence.
// @evidence contracts/testing.md#distinguishing-cases Interior block/line comments contrast with leading/trailing/before-brace comments, empty and nonempty bodies.
// @evidence contracts/testing.md#execution-ownership This Test registers each of the seven static-body rows with t.Run; runRuleFindingsSnapshot executes no-empty-static-block and the named subcase compares its authored count. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
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
