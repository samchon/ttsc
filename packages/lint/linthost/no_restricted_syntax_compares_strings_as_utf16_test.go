package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original astral string under the BMP-boundary comparison and leaves an equal BMP-boundary string clean.
// @evidence contracts/testing.md#independent-expectations ECMAScript string order uses UTF-16 code units; the astral high surrogate sorts before U+E000 even though its Unicode scalar is larger. The equal BMP twin independently fails strict less-than.
// @evidence contracts/testing.md#distinguishing-cases Astral versus BMP ordering reports; equality at the BMP threshold remains clean, distinguishing code-unit order from scalar order and inclusive comparison.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxComparesStringsAsUTF16 is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxComparesStringsAsUTF16(t *testing.T) {
  source := "const value = \"𐀀\";\nvoid value;\n"
  selector := "StringLiteral[value<'\ue000']"
  options, err := json.Marshal(selector)
  if err != nil {
    t.Fatal(err)
  }
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(options),
    noRestrictedSyntaxExpectation{target: "\"𐀀\"", message: noRestrictedDefaultMessage(selector)},
  )

  runNoRestrictedSyntax(t, "const value = \"\";\nvoid value;\n", json.RawMessage(options))
}
