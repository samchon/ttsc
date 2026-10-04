package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseUpstreamInvalidFilenames checks the retained invalid
// filename/options table against independent literal diagnostic messages,
// including rename samples and their order.
//
// Message text is load-bearing: the disjunction list format, the configured
// case order, the leading-underscore prefix, the lowercased extension in
// rename samples, and the cartesian rename enumeration all surface here, so a
// drift in any helper breaks an exact string.
//
// 1. Lint a virtual file for each filename/options pair.
// 2. Assert exactly one finding carrying the authored literal message.
//
// @evidence contracts/testing.md#behavioral-verification The real rule evaluates the retained invalid filename/options matrix and requires exact authored diagnostic messages.
// @evidence contracts/testing.md#independent-expectations Literal supported case conversions and independently authored expected alternatives distinguish wrong normalization, message ordering and missed reports.
// @evidence contracts/testing.md#distinguishing-cases The retained table distinguishes default and explicit cases, acronyms, underscore prefixes, middle extensions, directories and ordered rename alternatives.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseUpstreamInvalidFilenames owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseUpstreamInvalidFilenames(t *testing.T) {
  cases := []struct {
    file    string
    options string
    message string
  }{
    {
      "src/foo/foo_bar.js",
      "",
      "Filename is not in kebab case. Rename it to `foo-bar.js`.",
    },
    {
      "src/fooBar",
      "",
      "Filename is not in kebab case. Rename it to `foo-bar`.",
    },
    {
      "src/foo/foo_bar.JS",
      `{"case":"camelCase"}`,
      "Filename is not in camel case. Rename it to `fooBar.js`.",
    },
    {
      "src/foo/foo_bar.test.js",
      `{"case":"camelCase"}`,
      "Filename is not in camel case. Rename it to `fooBar.test.js`.",
    },
    {
      "test/foo/foo_bar.test_utils.js",
      `{"case":"camelCase"}`,
      "Filename is not in camel case. Rename it to `fooBar.test_utils.js`.",
    },
    {
      "test/foo/fooBar.js",
      `{"case":"snakeCase"}`,
      "Filename is not in snake case. Rename it to `foo_bar.js`.",
    },
    {
      "test/foo/fooBar.test.js",
      `{"case":"snakeCase"}`,
      "Filename is not in snake case. Rename it to `foo_bar.test.js`.",
    },
    {
      "test/foo/fooBar.testUtils.js",
      `{"case":"snakeCase"}`,
      "Filename is not in snake case. Rename it to `foo_bar.testUtils.js`.",
    },
    {
      "test/foo/fooBar.js",
      `{"case":"kebabCase"}`,
      "Filename is not in kebab case. Rename it to `foo-bar.js`.",
    },
    {
      "test/foo/fooBar.test.js",
      `{"case":"kebabCase"}`,
      "Filename is not in kebab case. Rename it to `foo-bar.test.js`.",
    },
    {
      "test/foo/fooBar.testUtils.js",
      `{"case":"kebabCase"}`,
      "Filename is not in kebab case. Rename it to `foo-bar.testUtils.js`.",
    },
    {
      "src/foo/Article.ts",
      `{"cases":{"kebabCase":true}}`,
      "Filename is not in kebab case. Rename it to `article.ts`.",
    },
    {
      "Test/Foo/fooBar.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `FooBar.js`.",
    },
    {
      "Test/Foo/foo_bar.test.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `FooBar.test.js`.",
    },
    {
      "Test/Foo/foo-bar.test-utils.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `FooBar.test-utils.js`.",
    },
    {
      "Src/Foo/PageFAQ.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `PageFaq.js`.",
    },
    {
      "Src/Foo/FAQ-Page.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `FaqPage.js`.",
    },
    {
      "Src/Foo/FAQpage.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `FaQpage.js`.",
    },
    {
      "Src/Foo/FAQPageFOO.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `FaqPageFoo.js`.",
    },
    {
      "Src/FAQpage/Foo.js",
      `{"case":"pascalCase"}`,
      "Directory name `FAQpage` is not in pascal case. Rename it to `FaQpage`.",
    },
    {
      "Src/Foo/URL2path.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `Url2path.js`.",
    },
    {
      "Src/Foo/UIPath.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `UiPath.js`.",
    },
    {
      "Src/Foo/UI2Path.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `Ui2Path.js`.",
    },
    {
      "Src/Foo/FOO2.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `Foo2.js`.",
    },
    {
      "src/foo/FAQPage.js",
      `{"case":"camelCase"}`,
      "Filename is not in camel case. Rename it to `faqPage.js`.",
    },
    {
      "src/foo/innerHTML.js",
      `{"case":"camelCase"}`,
      "Filename is not in camel case. Rename it to `innerHtml.js`.",
    },
    {
      "src/foo/HTMLParser.js",
      `{"case":"camelCaseWithAcronyms"}`,
      "Filename is not in camel case with acronyms. Rename it to `htmlParser.js`.",
    },
    {
      "src/foo/XMLHttpRequest.js",
      `{"case":"camelCaseWithAcronyms"}`,
      "Filename is not in camel case with acronyms. Rename it to `xmlHttpRequest.js`.",
    },
    {
      "src/foo/FAQPage.js",
      `{"case":"camelCaseWithAcronyms"}`,
      "Filename is not in camel case with acronyms. Rename it to `faqPage.js`.",
    },
    {
      "src/foo/FAQPage.js",
      "",
      "Filename is not in kebab case. Rename it to `faq-page.js`.",
    },
    {
      "src/foo/_FOO-BAR.js",
      `{"case":"camelCase"}`,
      "Filename is not in camel case. Rename it to `_fooBar.js`.",
    },
    {
      "src/foo/___FOO-BAR.js",
      `{"case":"camelCase"}`,
      "Filename is not in camel case. Rename it to `___fooBar.js`.",
    },
    {
      "src/foo/_FOO-BAR.js",
      `{"case":"snakeCase"}`,
      "Filename is not in snake case. Rename it to `_foo_bar.js`.",
    },
    {
      "src/foo/___FOO-BAR.js",
      `{"case":"snakeCase"}`,
      "Filename is not in snake case. Rename it to `___foo_bar.js`.",
    },
    {
      "src/foo/_FOO-BAR.js",
      `{"case":"kebabCase"}`,
      "Filename is not in kebab case. Rename it to `_foo-bar.js`.",
    },
    {
      "src/foo/___FOO-BAR.js",
      `{"case":"kebabCase"}`,
      "Filename is not in kebab case. Rename it to `___foo-bar.js`.",
    },
    {
      "Src/Foo/_FOO-BAR.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `_FooBar.js`.",
    },
    {
      "Src/Foo/___FOO-BAR.js",
      `{"case":"pascalCase"}`,
      "Filename is not in pascal case. Rename it to `___FooBar.js`.",
    },
    {
      "src/foo/foo_bar.js",
      `{}`,
      "Filename is not in kebab case. Rename it to `foo-bar.js`.",
    },
    {
      "src/foo/foo-bar.js",
      `{"cases":{"camelCase":true,"pascalCase":true}}`,
      "Filename is not in camel case or pascal case. Rename it to `fooBar.js` or `FooBar.js`.",
    },
    {
      "src/foo-bar/file.js",
      `{"cases":{"camelCase":true,"pascalCase":true}}`,
      "Directory name `foo-bar` is not in camel case or pascal case. Rename it to `fooBar` or `FooBar`.",
    },
    {
      "src/foo/_foo_bar.js",
      `{"cases":{"camelCase":true,"pascalCase":true,"kebabCase":true}}`,
      "Filename is not in camel case, pascal case, or kebab case. Rename it to `_fooBar.js`, `_FooBar.js`, or `_foo-bar.js`.",
    },
    {
      "src/foo/_FOO-BAR.js",
      `{"cases":{"snakeCase":true}}`,
      "Filename is not in snake case. Rename it to `_foo_bar.js`.",
    },
    {
      "src/foo/[foo_bar].js",
      "",
      "Filename is not in kebab case. Rename it to `[foo-bar].js`.",
    },
    {
      "src/foo/foo$Bar.js",
      "",
      "Filename is not in kebab case. Rename it to `foo$bar.js`.",
    },
    {
      "src/foo/{foo_bar}.js",
      `{"cases":{"camelCase":true,"pascalCase":true,"kebabCase":true}}`,
      "Filename is not in camel case, pascal case, or kebab case. Rename it to `{fooBar}.js`, `{FooBar}.js`, or `{foo-bar}.js`.",
    },
    {
      "src/foo/1_.js",
      `{"cases":{"camelCase":true,"pascalCase":true,"kebabCase":true}}`,
      "Filename is not in camel case, pascal case, or kebab case. Rename it to `1.js`.",
    },
  }
  for _, testCase := range cases {
    assertUnicornFilenameCaseMessage(t, testCase.file, testCase.options, testCase.message)
  }
}
