package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseExtensionLowercase verifies the extension arm of the
// native rule against independent literal messages.
//
// The extension diagnostic only fires when the stem already satisfies a
// configured case, and its rename sample lowercases the primary extension
// while leaving the untouched middle parts verbatim — `foo.SPEC.JS` keeps
// `.SPEC` but fixes `.JS`.
//
//  1. Lint each authored filename.
//  2. Assert the independent exact extension or filename message.
//
// @evidence contracts/testing.md#behavioral-verification Actual filename evaluation distinguishes extension spelling from the selected basename case and checks each authored error.
// @evidence contracts/testing.md#independent-expectations The supported lowercase-extension contract independently establishes the literal rejected names and rename alternatives without invoking the product case conversion.
// @evidence contracts/testing.md#distinguishing-cases Uppercase/mixed extensions require lowercase rename alternatives; the final bad-stem input retains the combined filename diagnostic. UpstreamValidFilenames owns clean lowercase paths.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseExtensionLowercase owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseExtensionLowercase(t *testing.T) {
  cases := []struct {
    file    string
    options string
    message string
  }{
    {
      "foo.JS",
      "",
      "File extension `.JS` is not in lowercase. Rename it to `foo.js`.",
    },
    {
      "foo.Js",
      "",
      "File extension `.Js` is not in lowercase. Rename it to `foo.js`.",
    },
    {
      "foo.jS",
      "",
      "File extension `.jS` is not in lowercase. Rename it to `foo.js`.",
    },
    {
      "index.JS",
      "",
      "File extension `.JS` is not in lowercase. Rename it to `index.js`.",
    },
    {
      "foo..JS",
      "",
      "File extension `.JS` is not in lowercase. Rename it to `foo..js`.",
    },
    {
      "foo.SPEC.JS",
      "",
      "File extension `.JS` is not in lowercase. Rename it to `foo.SPEC.js`.",
    },
    {
      "src/foo/$userId.TSX",
      "",
      "File extension `.TSX` is not in lowercase. Rename it to `$userId.tsx`.",
    },
    {
      "src/foo/foo_bar.mJS",
      `{"cases":{"camelCase":true,"kebabCase":true}}`,
      "Filename is not in camel case or kebab case. Rename it to `fooBar.mjs` or `foo-bar.mjs`.",
    },
  }
  for _, testCase := range cases {
    assertUnicornFilenameCaseMessage(t, testCase.file, testCase.options, testCase.message)
  }
}
