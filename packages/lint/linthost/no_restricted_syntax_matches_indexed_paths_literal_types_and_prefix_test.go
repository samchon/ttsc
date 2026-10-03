package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedSyntaxMatchesIndexedPathsLiteralTypesAndPrefix verifies
// indexed paths, literal type coercion, prefix and Program length selectors.
//
// Canonical index spelling, UTF-16 length and JavaScript Number and BigInt
// coercion define the expectations.
//
//  1. Parse sources holding indexed members, numeric, string and BigInt literals,
//     overflow values and prefix versus postfix updates.
//  2. Run selectors over indexed paths, coerced comparisons, prefix and the Program
//     body length.
//  3. Assert each exact target and message and that non-canonical or invalid
//     coercions stay empty.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares every original exact target/message across indexed, numeric, string, BigInt, overflow, prefix and Program-length selectors.
// @evidence contracts/testing.md#independent-expectations Hand-authored constants follow canonical indexed paths, UTF-16 length and JavaScript Number/BigInt coercion contracts; expected ranges and messages are independent of selector evaluation.
// @evidence contracts/testing.md#distinguishing-cases Canonical index versus 01, exact/inexact large values, separator-invalid coercion strings, Infinity, prefix versus postfix and full body length preserve every original positive/empty selector outcome.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxMatchesIndexedPathsLiteralTypesAndPrefix is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxMatchesIndexedPathsLiteralTypesAndPrefix(t *testing.T) {
  source := `declare function choose(first: string, second: number): void;
let count = 0;
const emoji = "😀";
const amount = 0x10n;
const precise = 9007199254740993n;
const huge = 0x10000000000000000;
const decimal = 100000000000000000000;
const tiny = 0.000001;
const infinity = 1e999;
++count;
count++;
choose("x", count);
`
  indexedSelector := `FunctionDeclaration[params.0.name='first']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+indexedSelector+`"`),
    noRestrictedSyntaxExpectation{
      target:  "declare function choose(first: string, second: number): void;",
      message: noRestrictedDefaultMessage(indexedSelector),
    },
  )
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"FunctionDeclaration[params.01.name='second']"`),
  )

  numberSelector := `NumericLiteral[value=type(number)][value=.0]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+numberSelector+`"`),
    noRestrictedSyntaxExpectation{target: "0", message: noRestrictedDefaultMessage(numberSelector)},
  )

  stringSelector := `StringLiteral[raw='"😀"'][value.length=2]`
  stringOptions, err := json.Marshal(stringSelector)
  if err != nil {
    t.Fatal(err)
  }
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(stringOptions),
    noRestrictedSyntaxExpectation{target: `"😀"`, message: noRestrictedDefaultMessage(stringSelector)},
  )

  bigintSelector := `BigIntLiteral[value=16]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+bigintSelector+`"`),
    noRestrictedSyntaxExpectation{target: "0x10n", message: noRestrictedDefaultMessage(bigintSelector)},
  )

  preciseBigintSelector := `BigIntLiteral[value>'9007199254740992']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+preciseBigintSelector+`"`),
    noRestrictedSyntaxExpectation{target: "9007199254740993n", message: noRestrictedDefaultMessage(preciseBigintSelector)},
  )

  infiniteNumberSelector := `BigIntLiteral[value>9007199254740992][value<` + strings.Repeat("9", 400) + `]`
  infiniteNumberOptions, err := json.Marshal(infiniteNumberSelector)
  if err != nil {
    t.Fatal(err)
  }
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(infiniteNumberOptions),
    noRestrictedSyntaxExpectation{target: "9007199254740993n", message: noRestrictedDefaultMessage(infiniteNumberSelector)},
  )

  hugeNumberSelector := `NumericLiteral[value=18446744073709551616]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+hugeNumberSelector+`"`),
    noRestrictedSyntaxExpectation{target: "0x10000000000000000", message: noRestrictedDefaultMessage(hugeNumberSelector)},
  )

  decimalStringSelector := `NumericLiteral[value='100000000000000000000']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+decimalStringSelector+`"`),
    noRestrictedSyntaxExpectation{
      target:  "100000000000000000000",
      message: noRestrictedDefaultMessage(decimalStringSelector),
    },
  )

  tinyStringSelector := `NumericLiteral[value='0.000001'][value>'0x0']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+tinyStringSelector+`"`),
    noRestrictedSyntaxExpectation{target: "0.000001", message: noRestrictedDefaultMessage(tinyStringSelector)},
  )
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"NumericLiteral[raw='0.000001'][value<'0x1_0']"`),
  )
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"NumericLiteral[raw='0.000001'][value<'1_0']"`),
  )
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"NumericLiteral[raw='0.000001'][value<'+0x1p0']"`),
  )

  infinitySelector := `NumericLiteral[value=Infinity][value=type(number)]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+infinitySelector+`"`),
    noRestrictedSyntaxExpectation{target: "1e999", message: noRestrictedDefaultMessage(infinitySelector)},
  )

  prefixSelector := `UpdateExpression[prefix=true]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+prefixSelector+`"`),
    noRestrictedSyntaxExpectation{target: "++count", message: noRestrictedDefaultMessage(prefixSelector)},
  )

  bodySelector := `Program[body.length=12]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+bodySelector+`"`),
    noRestrictedSyntaxExpectation{target: source, message: noRestrictedDefaultMessage(bodySelector)},
  )
}
