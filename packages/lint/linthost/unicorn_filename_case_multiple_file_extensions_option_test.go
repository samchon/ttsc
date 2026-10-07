package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseMultipleFileExtensionsOption verifies the
// `multipleFileExtensions: false` matrix: the whole dotted stem is checked as
// one name instead of stopping at the first dot.
//
// With the option off, `foo_bar.test_utils` converts as a single name — dots
// become ignored separators inside the checked stem — so camel case yields
// `fooBar.testUtils.js` while the default mode leaves `.test_utils` untouched.
//
// 1. Lint each authored invalid path with the option disabled.
// 2. Assert the exact whole-stem rename samples.
//
// @evidence contracts/testing.md#behavioral-verification The rule evaluates multi-extension names with multipleFileExtensions disabled, detecting a wrong boundary between basename and suffix.
// @evidence contracts/testing.md#independent-expectations The supported multipleFileExtensions policy and authored names/messages independently determine which segments are case-normalized.
// @evidence contracts/testing.md#distinguishing-cases The retained camel, snake, kebab and pascal policies distinguish normalized dotted stems, including a leading dot and noncanonical middle parts.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseMultipleFileExtensionsOption owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseMultipleFileExtensionsOption(t *testing.T) {
  cases := []struct {
    file    string
    options string
    message string
  }{
    {
      "src/foo/foo_bar.test.js",
      `{"case":"camelCase","multipleFileExtensions":false}`,
      "Filename is not in camel case. Rename it to `fooBar.test.js`.",
    },
    {
      "test/foo/foo_bar.test_utils.js",
      `{"case":"camelCase","multipleFileExtensions":false}`,
      "Filename is not in camel case. Rename it to `fooBar.testUtils.js`.",
    },
    {
      "test/foo/fooBar.test.js",
      `{"case":"snakeCase","multipleFileExtensions":false}`,
      "Filename is not in snake case. Rename it to `foo_bar.test.js`.",
    },
    {
      "test/foo/fooBar.testUtils.js",
      `{"case":"snakeCase","multipleFileExtensions":false}`,
      "Filename is not in snake case. Rename it to `foo_bar.test_utils.js`.",
    },
    {
      "test/foo/fooBar.test.js",
      `{"case":"kebabCase","multipleFileExtensions":false}`,
      "Filename is not in kebab case. Rename it to `foo-bar.test.js`.",
    },
    {
      "test/foo/fooBar.testUtils.js",
      `{"case":"kebabCase","multipleFileExtensions":false}`,
      "Filename is not in kebab case. Rename it to `foo-bar.test-utils.js`.",
    },
    {
      "test/foo/.testUtils.js",
      `{"case":"kebabCase","multipleFileExtensions":false}`,
      "Filename is not in kebab case. Rename it to `.test-utils.js`.",
    },
    {
      "Test/Foo/foo_bar.test.js",
      `{"case":"pascalCase","multipleFileExtensions":false}`,
      "Filename is not in pascal case. Rename it to `FooBar.Test.js`.",
    },
    {
      "Test/Foo/foo-bar.test-utils.js",
      `{"case":"pascalCase","multipleFileExtensions":false}`,
      "Filename is not in pascal case. Rename it to `FooBar.TestUtils.js`.",
    },
  }
  for _, testCase := range cases {
    assertUnicornFilenameCaseMessage(t, testCase.file, testCase.options, testCase.message)
  }
}
