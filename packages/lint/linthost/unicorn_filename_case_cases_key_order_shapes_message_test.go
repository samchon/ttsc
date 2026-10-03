package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseCasesKeyOrderShapesMessage verifies that the
// configured `cases` key order drives both the case-name list and the rename
// sample order in the message.
//
// Upstream derives the enabled case list from `Object.keys(options.cases)`,
// so `{pascalCase, camelCase}` and `{camelCase, pascalCase}` produce
// differently ordered disjunctions; the port's order-preserving decoder must
// reproduce that, including all-false maps falling back to kebab case.
//
// 1. Lint the same filename under both key orders.
// 2. Lint with every case disabled.
// 3. Assert the order-sensitive and fallback messages.
//
// @evidence contracts/testing.md#behavioral-verification The actual rule checks diagnostic alternatives under differently ordered cases objects, detecting loss of configured order.
// @evidence contracts/testing.md#independent-expectations JavaScript object insertion order and authored full messages independently establish alternative ordering without reading the product table.
// @evidence contracts/testing.md#distinguishing-cases Retained cases key-order variants must preserve their literal message order while the same filename remains invalid.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseCasesKeyOrderShapesMessage owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseCasesKeyOrderShapesMessage(t *testing.T) {
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/foo_bar.js",
    `{"cases":{"pascalCase":true,"camelCase":true}}`,
    "Filename is not in pascal case or camel case. Rename it to `FooBar.js` or `fooBar.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/foo_bar.js",
    `{"cases":{"camelCase":true,"pascalCase":true}}`,
    "Filename is not in camel case or pascal case. Rename it to `fooBar.js` or `FooBar.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/foo_bar.js",
    `{"cases":{"camelCase":false,"pascalCase":false}}`,
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
}
