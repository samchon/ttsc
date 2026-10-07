package linthost

import "testing"

// TestFormatIndentNormalizesClassMethodBodyDepth verifies a class method
// body statement lands at depth 2 (four spaces) under the default
// tabWidth.
//
// A class body is a descend-only +1 frame: it is not a statement list,
// but a method's Block nests inside it, adding another +1, so a
// method-body statement sits at depth 2. Without counting the class-body
// frame the statement would land one indentation level short. This pins that fix.
//
//  1. Parse a class whose method body statement is flush left.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the body statement is re-indented to four spaces.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must move the flush-left class method return to four spaces while leaving the two-space member header intact. Complete source catches omitting the class frame and choosing the ordinary function-body column.
// @evidence contracts/testing.md#independent-expectations The supported two-space class layout nests the method body one level below the member, so the literal return indentation is four spaces. The expected source retains the return value and braces independently of the depth walk.
// @evidence contracts/testing.md#distinguishing-cases This positive repairs a flush-left return under an already correctly positioned method header. IdempotentOnCorrectClassBody supplies the canonical no-finding counterpart.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentNormalizesClassMethodBodyDepth owns its literal source/output in the public Go unit population. The owning rule and syntax-only disk-backed edit harness execute in process without installing a consumer, producing a native artifact or starting a product host.
func TestFormatIndentNormalizesClassMethodBodyDepth(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class C {\n  m() {\nreturn 1;\n  }\n}\n",
    "class C {\n  m() {\n    return 1;\n  }\n}\n",
  )
}
