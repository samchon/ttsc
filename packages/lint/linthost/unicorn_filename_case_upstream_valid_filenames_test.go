package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseUpstreamValidFilenames verifies every JSON-expressible
// valid case of the upstream test suite produces zero findings.
//
// The table is transcribed from eslint-plugin-unicorn's tests/filename-case.js
// `valid` list (RegExp-typed ignore entries and the no-filename placeholders
// have no JSON counterpart in this host). It locks stem/middle/extension
// splitting, every case family including the acronym-aware ones, leading
// underscores, `$` prefixes, ignored character runs, and dotted middles.
//
// 1. Lint a virtual file for each filename/options pair.
// 2. Assert the engine reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The real filename rule evaluates the complete retained valid path/options matrix and requires zero findings.
// @evidence contracts/testing.md#independent-expectations Independently authored upstream valid spellings follow the selected case policies and exemptions; no expected name is produced by the Go normalizer.
// @evidence contracts/testing.md#distinguishing-cases All retained compliant stems, paths and configured forms remain; the invalid matrix owns their reported counterparts.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseUpstreamValidFilenames owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseUpstreamValidFilenames(t *testing.T) {
  cases := []struct {
    file    string
    options string
  }{
    {"src/foo/bar.js", `{"case":"camelCase"}`},
    {"src/foo/fooBar.js", `{"case":"camelCase"}`},
    {"src/foo/bar.test.js", `{"case":"camelCase"}`},
    {"src/foo/fooBar.test.js", `{"case":"camelCase"}`},
    {"src/foo/fooBar.test-utils.js", `{"case":"camelCase"}`},
    {"src/foo/fooBar.test_utils.js", `{"case":"camelCase"}`},
    {"src/foo/.test_utils.js", `{"case":"camelCase"}`},
    {"src/foo/innerHTML.js", `{"case":"camelCaseWithAcronyms"}`},
    {"src/foo/getDOMRangeRect.js", `{"case":"camelCaseWithAcronyms"}`},
    {"src/foo/apiURL.js", `{"case":"camelCaseWithAcronyms"}`},
    {"src/foo/getHTML5Parser.js", `{"case":"camelCaseWithAcronyms"}`},
    {"src/foo/domSelection.js", `{"case":"camelCaseWithAcronyms"}`},
    {"src/getDOMRangeRect/file.js", `{"case":"camelCaseWithAcronyms"}`},
    {"src/foo/foo.js", `{"case":"snakeCase"}`},
    {"src/foo/foo_bar.js", `{"case":"snakeCase"}`},
    {"src/foo/foo.test.js", `{"case":"snakeCase"}`},
    {"src/foo/foo_bar.test.js", `{"case":"snakeCase"}`},
    {"src/foo/foo_bar.test_utils.js", `{"case":"snakeCase"}`},
    {"src/foo/foo_bar.test-utils.js", `{"case":"snakeCase"}`},
    {"src/foo/.test-utils.js", `{"case":"snakeCase"}`},
    {"src/foo/foo.js", `{"case":"kebabCase"}`},
    {"src/foo/foo-bar.js", `{"case":"kebabCase"}`},
    {"src/foo/foo.test.js", `{"case":"kebabCase"}`},
    {"src/foo/foo-bar.test.js", `{"case":"kebabCase"}`},
    {"src/foo/foo-bar.test-utils.js", `{"case":"kebabCase"}`},
    {"src/foo/foo-bar.test_utils.js", `{"case":"kebabCase"}`},
    {"src/foo/.test_utils.js", `{"case":"kebabCase"}`},
    {"Src/Foo/Foo.js", `{"case":"pascalCase"}`},
    {"Src/Foo/FooBar.js", `{"case":"pascalCase"}`},
    {"Src/Foo/FAQPage.js", `{"case":"pascalCase"}`},
    {"Src/Foo/DIYWidget.js", `{"case":"pascalCase"}`},
    {"Src/Foo/URL2Path.js", `{"case":"pascalCase"}`},
    {"Src/Foo/FAQI18n.js", `{"case":"pascalCase"}`},
    {"Src/Foo/URL2I18n.js", `{"case":"pascalCase"}`},
    {"Src/FAQPage/Foo.js", `{"case":"pascalCase"}`},
    {"Src/URL2Path/Foo.js", `{"case":"pascalCase"}`},
    {"Src/URL2I18n/Foo.js", `{"case":"pascalCase"}`},
    {"Src/Foo/Foo.test.js", `{"case":"pascalCase"}`},
    {"Src/Foo/FooBar.test.js", `{"case":"pascalCase"}`},
    {"Src/Foo/FooBar.test-utils.js", `{"case":"pascalCase"}`},
    {"Src/Foo/FooBar.test_utils.js", `{"case":"pascalCase"}`},
    {"Src/Foo/.test_utils.js", `{"case":"pascalCase"}`},
    {"spec/iss47Spec.js", `{"case":"camelCase"}`},
    {"spec/iss47Spec100.js", `{"case":"camelCase"}`},
    {"spec/i18n.js", `{"case":"camelCase"}`},
    {"spec/iss47-spec.js", `{"case":"kebabCase"}`},
    {"spec/iss-47-spec.js", `{"case":"kebabCase"}`},
    {"spec/iss47-100spec.js", `{"case":"kebabCase"}`},
    {"spec/i18n.js", `{"case":"kebabCase"}`},
    {"spec/iss47_spec.js", `{"case":"snakeCase"}`},
    {"spec/iss_47_spec.js", `{"case":"snakeCase"}`},
    {"spec/iss47_100spec.js", `{"case":"snakeCase"}`},
    {"spec/i18n.js", `{"case":"snakeCase"}`},
    {"Spec/Iss47Spec.js", `{"case":"pascalCase"}`},
    {"Spec/Iss47.100spec.js", `{"case":"pascalCase"}`},
    {"Spec/I18n.js", `{"case":"pascalCase"}`},
    {"src/foo/_fooBar.js", `{"case":"camelCase"}`},
    {"src/foo/___fooBar.js", `{"case":"camelCase"}`},
    {"src/foo/_foo_bar.js", `{"case":"snakeCase"}`},
    {"src/foo/___foo_bar.js", `{"case":"snakeCase"}`},
    {"src/foo/_foo-bar.js", `{"case":"kebabCase"}`},
    {"src/foo/___foo-bar.js", `{"case":"kebabCase"}`},
    {"Src/Foo/_FooBar.js", `{"case":"pascalCase"}`},
    {"Src/Foo/___FooBar.js", `{"case":"pascalCase"}`},
    {"src/foo/$foo.js", ""},
    {"src/foo/$userId.tsx", ""},
    {"src/foo/$foo_bar.js", ""},
    {"src/foo/$fooBar.js", ""},
    {"src/foo/foo-bar.js", `{}`},
    {"src/foo/foo-bar.js", `{"cases":{}}`},
    {"src/foo/fooBar.js", `{"cases":{"camelCase":true}}`},
    {"src/foo/innerHTML.js", `{"cases":{"camelCaseWithAcronyms":true}}`},
    {"src/foo/innerHTML.js", `{"cases":{"camelCaseWithAcronyms":true,"kebabCase":true}}`},
    {"Src/Foo/FooBar.js", `{"cases":{"kebabCase":true,"pascalCase":true}}`},
    {"src/foo/$idCertidao.tsx", `{"cases":{"kebabCase":true,"pascalCase":true}}`},
    {"src/foo/___foo_bar.js", `{"cases":{"snakeCase":true,"pascalCase":true}}`},
    {"src/foo/bar.js", ""},
    {"src/foo/[fooBar].js", `{"case":"camelCase"}`},
    {"src/foo/{foo_bar}.js", `{"case":"snakeCase"}`},
    {"src/foo/index.js", `{"case":"kebabCase","ignore":["FOOBAR\\.js"]}`},
    {"src/foo/FOOBAR.js", `{"case":"kebabCase","ignore":["FOOBAR\\.js"]}`},
    {"src/foo/FOOBAR.js", `{"case":"camelCase","ignore":["FOOBAR\\.js"]}`},
    {"src/foo/FOOBAR.js", `{"case":"snakeCase","ignore":["FOOBAR\\.js"]}`},
    {"src/foo/FOOBAR.js", `{"case":"pascalCase","ignore":["FOOBAR\\.js"]}`},
    {"src/foo/BARBAZ.js", `{"case":"kebabCase","ignore":["FOOBAR\\.js","BARBAZ\\.js"]}`},
    {"src/foo/[FOOBAR].js", `{"case":"camelCase","ignore":["\\[FOOBAR\\]\\.js"]}`},
    {"src/foo/{FOOBAR}.js", `{"case":"snakeCase","ignore":["\\{FOOBAR\\}\\.js"]}`},
    {"src/foo/foo.js", `{"case":"kebabCase","ignore":["^(F|f)oo"]}`},
    {"src/foo/foo-bar.js", `{"case":"kebabCase","ignore":["^(F|f)oo"]}`},
    {"src/foo/fooBar.js", `{"case":"kebabCase","ignore":["^(F|f)oo"]}`},
    {"src/foo/foo_bar.js", `{"case":"kebabCase","ignore":["^(F|f)oo"]}`},
    {"src/foo/foo-bar.js", `{"case":"kebabCase","ignore":["\\.(web|android|ios)\\.js$"]}`},
    {"src/foo/FooBar.web.js", `{"case":"kebabCase","ignore":["\\.(web|android|ios)\\.js$"]}`},
    {"src/foo/FooBar.android.js", `{"case":"kebabCase","ignore":["\\.(web|android|ios)\\.js$"]}`},
    {"src/foo/FooBar.ios.js", `{"case":"kebabCase","ignore":["\\.(web|android|ios)\\.js$"]}`},
    {"src/foo/FooBar.js", `{"case":"kebabCase","ignore":["^(F|f)oo"]}`},
    {"src/foo/FOOBAR.js", `{"case":"kebabCase","ignore":["^FOO","BAZ\\.js$"]}`},
    {"src/foo/BARBAZ.js", `{"case":"kebabCase","ignore":["^FOO","BAZ\\.js$"]}`},
    {
      "src/foo/FOOBAR.js",
      `{"cases":{"kebabCase":true,"camelCase":true,"snakeCase":true,"pascalCase":true},"ignore":["FOOBAR\\.js"]}`,
    },
    {
      "src/foo/BaRbAz.js",
      `{"cases":{"kebabCase":true,"camelCase":true,"snakeCase":true,"pascalCase":true},"ignore":["FOOBAR\\.js","BaRbAz\\.js"]}`,
    },
    {"index.tsx", `{"case":"pascalCase","multipleFileExtensions":false}`},
    {"Src/Index/index.tsx", `{"case":"pascalCase","multipleFileExtensions":false}`},
    {"src/foo/fooBar.test.js", `{"case":"camelCase","multipleFileExtensions":false}`},
    {"src/foo/fooBar.testUtils.js", `{"case":"camelCase","multipleFileExtensions":false}`},
    {"src/foo/foo_bar.test_utils.js", `{"case":"snakeCase","multipleFileExtensions":false}`},
    {"src/foo/foo.test.js", `{"case":"kebabCase","multipleFileExtensions":false}`},
    {"src/foo/foo-bar.test.js", `{"case":"kebabCase","multipleFileExtensions":false}`},
    {"src/foo/foo-bar.test-utils.js", `{"case":"kebabCase","multipleFileExtensions":false}`},
    {"src/foo/$userId.test.tsx", `{"case":"kebabCase","multipleFileExtensions":false}`},
    {"Src/Foo/Foo.Test.js", `{"case":"pascalCase","multipleFileExtensions":false}`},
    {"Src/Foo/FooBar.Test.js", `{"case":"pascalCase","multipleFileExtensions":false}`},
    {"Src/Foo/FooBar.TestUtils.js", `{"case":"pascalCase","multipleFileExtensions":false}`},
    {"Spec/Iss47.100Spec.js", `{"case":"pascalCase","multipleFileExtensions":false}`},
    {"src/foo/fooBar.Test.js", `{"case":"camelCase"}`},
    {"test/foo/fooBar.testUtils.js", `{"case":"camelCase"}`},
    {"test/foo/.testUtils.js", `{"case":"camelCase"}`},
    {"test/foo/foo_bar.Test.js", `{"case":"snakeCase"}`},
    {"test/foo/foo_bar.Test_Utils.js", `{"case":"snakeCase"}`},
    {"test/foo/.Test_Utils.js", `{"case":"snakeCase"}`},
    {"test/foo/foo-bar.Test.js", `{"case":"kebabCase"}`},
    {"test/foo/foo-bar.Test-Utils.js", `{"case":"kebabCase"}`},
    {"test/foo/.Test-Utils.js", `{"case":"kebabCase"}`},
    {"Test/Foo/FooBar.Test.js", `{"case":"pascalCase"}`},
    {"Test/Foo/FooBar.TestUtils.js", `{"case":"pascalCase"}`},
    {"Test/Foo/.TestUtils.js", `{"case":"pascalCase"}`},
    {"src/foo-bar/file.js", ""},
    {"src/$userId/page.js", ""},
    {"src/FooBar/file.js", `{"checkDirectories":false}`},
    {"src/FooBar/file.js", `{"case":"kebabCase","checkDirectories":false}`},
    {"src/meta/BadName.js", `{"case":"kebabCase","ignore":["^meta$"]}`},
    // Snapshot-suite valid filenames.
    {"src/foo-js/bar.js", ""},
    {"src/foo-js/bar.spec.js", ""},
    {"src/foo-js/.spec.js", ""},
    {"src/foo-js/bar", ""},
    {"foo.SPEC.js", ""},
    {".SPEC.js", ""},
  }
  for _, testCase := range cases {
    assertUnicornFilenameCaseValid(t, testCase.file, testCase.options)
  }
}
