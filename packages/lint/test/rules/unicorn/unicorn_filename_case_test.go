package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

const unicornFilenameCaseRuleName = "unicorn/filename-case"

// unicornFilenameCaseTestRoot is the virtual project directory every
// engine-level scenario resolves path segments against. A rooted, driveless
// spelling works on both Windows and POSIX `filepath.Rel` and mirrors how the
// tsgo host hands normalized forward-slash paths to the rule.
const unicornFilenameCaseTestRoot = "/project"

// runUnicornFilenameCaseFile lints one statement-bearing virtual file at the
// given project-relative path and returns the engine findings.
func runUnicornFilenameCaseFile(t *testing.T, projectRelativePath, optionsJSON string) []*Finding {
  t.Helper()
  return runUnicornFilenameCaseAbsolute(
    t,
    unicornFilenameCaseTestRoot+"/"+projectRelativePath,
    optionsJSON,
  )
}

// runUnicornFilenameCaseAbsolute is runUnicornFilenameCaseFile for callers
// that need full control of the virtual absolute path (outside-project and
// project-rooted scenarios).
func runUnicornFilenameCaseAbsolute(t *testing.T, absolutePath, optionsJSON string) []*Finding {
  t.Helper()
  var engine *Engine
  if optionsJSON == "" {
    engine = NewEngine(RuleConfig{unicornFilenameCaseRuleName: SeverityError})
  } else {
    engine = NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornFilenameCaseRuleName: SeverityError},
      Options: RuleOptionsMap{unicornFilenameCaseRuleName: json.RawMessage(optionsJSON)},
    })
  }
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("options %s: unexpected config error: %v", optionsJSON, err)
  }
  engine.SetCurrentDirectory(unicornFilenameCaseTestRoot)
  file := parseTSFile(t, absolutePath, "export const value = 1;\n")
  return engine.Run([]*shimast.SourceFile{file}, nil)
}

func assertUnicornFilenameCaseValid(t *testing.T, projectRelativePath, optionsJSON string) {
  t.Helper()
  findings := runUnicornFilenameCaseFile(t, projectRelativePath, optionsJSON)
  if len(findings) != 0 {
    t.Fatalf(
      "%s options=%s: want no findings, got %d: %q",
      projectRelativePath, optionsJSON, len(findings), findings[0].Message,
    )
  }
}

func assertUnicornFilenameCaseMessage(t *testing.T, projectRelativePath, optionsJSON, message string) {
  t.Helper()
  assertUnicornFilenameCaseMessageAbsolute(
    t,
    unicornFilenameCaseTestRoot+"/"+projectRelativePath,
    optionsJSON,
    message,
  )
}

func assertUnicornFilenameCaseMessageAbsolute(t *testing.T, absolutePath, optionsJSON, message string) {
  t.Helper()
  findings := runUnicornFilenameCaseAbsolute(t, absolutePath, optionsJSON)
  if len(findings) != 1 {
    t.Fatalf(
      "%s options=%s: want exactly one finding, got %d (%+v)",
      absolutePath, optionsJSON, len(findings), findings,
    )
  }
  if findings[0].Rule != unicornFilenameCaseRuleName {
    t.Fatalf("%s: finding rule: want %q, got %q", absolutePath, unicornFilenameCaseRuleName, findings[0].Rule)
  }
  if findings[0].Message != message {
    t.Fatalf(
      "%s options=%s:\nwant %q\ngot  %q",
      absolutePath, optionsJSON, message, findings[0].Message,
    )
  }
}

// TestRuleCorpusUnicornFilenameCase verifies the Go twin of the corpus fixture
// `tests/test-lint/src/cases/unicorn-filename-case.ts`.
//
// The fixture rides the corpus harness's `@ttsc-corpus-filename` directive to
// materialize as `src/utils/FooBar.ts`, so the default kebab-case check fires
// on the PascalCase stem. This twin pins the same logical path through the
// engine directly so the fixture's expectation line stays covered by Go tests.
//
// 1. Parse the fixture body under the fixture's logical project path.
// 2. Run the engine with the rule enabled at the annotated severity.
// 3. Compare rule/severity/line triples against the `// expect:` annotation.
func TestRuleCorpusUnicornFilenameCase(t *testing.T) {
  source := "// expect: unicorn/filename-case error\nexport const utilities = [] as string[];\n"
  expected := parseRuleExpectations(t, source)
  if len(expected) == 0 {
    t.Fatal("fixture twin has no rule expectations")
  }
  rules := RuleConfig{}
  for _, exp := range expected {
    rules[exp.Rule] = exp.Severity
  }
  engine := NewEngine(rules)
  engine.SetCurrentDirectory(unicornFilenameCaseTestRoot)
  file := parseTSFile(t, unicornFilenameCaseTestRoot+"/src/utils/FooBar.ts", source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v", i, expected[i], actual[i])
    }
  }
}

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

// TestUnicornFilenameCaseUpstreamInvalidFilenames verifies every
// JSON-expressible invalid case of the upstream suite reports exactly the
// upstream message, including the rename samples and their order.
//
// Message text is load-bearing: the disjunction list format, the configured
// case order, the leading-underscore prefix, the lowercased extension in
// rename samples, and the cartesian rename enumeration all surface here, so a
// drift in any helper breaks an exact string.
//
// 1. Lint a virtual file for each filename/options pair.
// 2. Assert exactly one finding carrying the upstream-rendered message.
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

// TestUnicornFilenameCaseExtensionLowercase verifies the extension arm of the
// rule against the upstream snapshot suite.
//
// The extension diagnostic only fires when the stem already satisfies a
// configured case, and its rename sample lowercases the primary extension
// while leaving the untouched middle parts verbatim — `foo.SPEC.JS` keeps
// `.SPEC` but fixes `.JS`.
//
// 1. Lint each snapshot filename.
// 2. Assert the exact extension (or filename) message derived from the rule's
//    upstream source.
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

// TestUnicornFilenameCaseIgnorePatternsMatchSegments verifies `ignore`
// patterns are tested against every individual path segment, with negative
// twins for patterns that must not suppress the diagnostic.
//
// Upstream evaluates each configured pattern against each segment of the
// project-relative path, so a directory-only pattern like `^meta$` exempts the
// whole file while a partial match like `^meta$` on `metal` (or a pattern
// spanning a separator) must not.
//
// 1. Lint ignored/non-ignored filename pairs.
// 2. Assert suppression exactly when one segment matches one pattern.
func TestUnicornFilenameCaseIgnorePatternsMatchSegments(t *testing.T) {
  assertUnicornFilenameCaseValid(t, "src/meta/BadName.js", `{"case":"kebabCase","ignore":["^meta$"]}`)
  assertUnicornFilenameCaseMessage(
    t,
    "src/metal/BadName.js",
    `{"case":"kebabCase","ignore":["^meta$"]}`,
    "Filename is not in kebab case. Rename it to `bad-name.js`.",
  )
  // A pattern spanning a path separator can never match a single segment.
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/BadName.js",
    `{"case":"kebabCase","ignore":["src/foo"]}`,
    "Filename is not in kebab case. Rename it to `bad-name.js`.",
  )
  // The upstream suite's literal `/FOOBAR\.js/` STRING pattern (not a RegExp
  // literal) compiles with the slashes as plain characters and matches
  // nothing here.
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/barBaz.js",
    `{"case":"kebabCase","ignore":["/FOOBAR\\.js/"]}`,
    "Filename is not in kebab case. Rename it to `bar-baz.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/barBaz.js",
    `{"case":"kebabCase","ignore":["FOOBAR\\.js"]}`,
    "Filename is not in kebab case. Rename it to `bar-baz.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/fooBar.js",
    `{"case":"kebabCase","ignore":["FOOBAR\\.js","foobar\\.js"]}`,
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  for _, ignore := range []string{
    `["FOOBAR\\.js"]`,
    `["BaRbAz\\.js"]`,
    `["^foo"]`,
    `["^foo","^bar"]`,
  } {
    assertUnicornFilenameCaseMessage(
      t,
      "src/qux/FooBar.js",
      `{"cases":{"camelCase":true,"snakeCase":true},"ignore":`+ignore+`}`,
      "Filename is not in camel case or snake case. Rename it to `fooBar.js` or `foo_bar.js`.",
    )
  }
  // Ignore patterns also match middle extension segments of the basename.
  assertUnicornFilenameCaseValid(
    t,
    "src/foo/FooBar.something.js",
    `{"case":"kebabCase","ignore":["\\.(?:web|android|ios|something)\\.js$"]}`,
  )
}

// TestUnicornFilenameCaseDirectoryHandling verifies directory checking order,
// the `$` directory exemption, `checkDirectories: false`, and the
// path-boundary rules for files at, inside, and outside the project directory.
//
// Upstream reports the first offending directory before ever looking at the
// basename, skips `$`-prefixed directory segments, and judges files outside
// the ESLint cwd by basename alone — so `Src` in an outside path must never be
// reported.
//
// 1. Lint layouts with bad directories, `$` directories, and disabled
//    directory checking.
// 2. Lint project-rooted and outside-project absolute paths.
// 3. Assert exactly the upstream-selected diagnostic for each.
func TestUnicornFilenameCaseDirectoryHandling(t *testing.T) {
  assertUnicornFilenameCaseMessage(
    t,
    "src/FooBar/file.js",
    "",
    "Directory name `FooBar` is not in kebab case. Rename it to `foo-bar`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/_FOO-BAR/file.js",
    "",
    "Directory name `_FOO-BAR` is not in kebab case. Rename it to `_foo-bar`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/$UserId/fooBar.js",
    "",
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  // The directory diagnostic wins over the filename diagnostic, and only one
  // finding is reported per file.
  assertUnicornFilenameCaseMessage(
    t,
    "src/FooBar/foo_bar.js",
    "",
    "Directory name `FooBar` is not in kebab case. Rename it to `foo-bar`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo-bar/foo_bar.js",
    "",
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/FooBar/index.js",
    "",
    "Directory name `FooBar` is not in kebab case. Rename it to `foo-bar`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/FooBar/foo_bar.js",
    `{"case":"kebabCase","checkDirectories":false}`,
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo-bar/foo_bar.js",
    `{"cases":{"camelCase":true,"pascalCase":true},"checkDirectories":false}`,
    "Filename is not in camel case or pascal case. Rename it to `fooBar.js` or `FooBar.js`.",
  )
  // A file outside the project directory is judged by basename only: the
  // PascalCase `Src` directory must not surface.
  assertUnicornFilenameCaseMessageAbsolute(
    t,
    "/outside/Src/fooBar.js",
    "",
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  // A valid basename outside the project stays silent even under invalid
  // directories.
  findings := runUnicornFilenameCaseAbsolute(t, "/outside/Src/foo-bar.js", "")
  if len(findings) != 0 {
    t.Fatalf("outside-project clean basename: want no findings, got %d (%+v)", len(findings), findings)
  }
}

// TestUnicornFilenameCaseDefaultIgnoredIndexBasenames verifies the exact
// `index.*` exemption set for every case family, plus negative twins outside
// the set.
//
// The exemption is a literal basename set (`index.js`, `index.mjs`,
// `index.cjs`, `index.ts`, `index.tsx`, `index.vue`), consulted after
// directory checks — so `index.jsx` under pascal case, an uppercase-extension
// `index.JS`, and an `index.js` under a bad directory all still report.
//
// 1. Lint each exempt basename under every case family.
// 2. Lint the adjacent non-exempt shapes.
// 3. Assert exemption exactly for the six literal names.
func TestUnicornFilenameCaseDefaultIgnoredIndexBasenames(t *testing.T) {
  ignored := []string{"index.js", "index.mjs", "index.cjs", "index.ts", "index.tsx", "index.vue"}
  chosenCases := []string{"camelCase", "camelCaseWithAcronyms", "snakeCase", "kebabCase", "pascalCase"}
  for _, basename := range ignored {
    for _, chosen := range chosenCases {
      assertUnicornFilenameCaseValid(t, basename, `{"case":"`+chosen+`"}`)
    }
  }
  assertUnicornFilenameCaseMessage(
    t,
    "index.jsx",
    `{"case":"pascalCase"}`,
    "Filename is not in pascal case. Rename it to `Index.jsx`.",
  )
  assertUnicornFilenameCaseValid(t, "Index.js", `{"case":"pascalCase"}`)
}

// TestUnicornFilenameCaseMultipleFileExtensionsOption verifies the
// `multipleFileExtensions: false` matrix: the whole dotted stem is checked as
// one name instead of stopping at the first dot.
//
// With the option off, `foo_bar.test_utils` converts as a single name — dots
// become ignored separators inside the checked stem — so camel case yields
// `fooBar.testUtils.js` while the default mode leaves `.test_utils` untouched.
//
// 1. Lint each upstream invalid pair with the option disabled.
// 2. Assert the exact whole-stem rename samples.
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

// TestUnicornFilenameCaseUnicodeSegments verifies non-ASCII characters pass
// through the checked name verbatim, exactly like upstream's ignored-character
// runs.
//
// Upstream's word splitter only treats `[A-Za-z0-9_-]` as checkable word
// characters; any other code point — accented letters included — is an
// ignored run that survives into rename samples unchanged. A name whose word
// runs are all valid therefore passes even with accents between them.
//
// 1. Lint an accented lowercase name (valid) and its capitalized twin
//    (invalid).
// 2. Assert the rename sample preserves the accented characters.
func TestUnicornFilenameCaseUnicodeSegments(t *testing.T) {
  assertUnicornFilenameCaseValid(t, "src/résumé.js", "")
  assertUnicornFilenameCaseMessage(
    t,
    "src/Résumé.js",
    "",
    "Filename is not in kebab case. Rename it to `résumé.js`.",
  )
  // A stem made only of ignored characters has no checkable words at all.
  assertUnicornFilenameCaseValid(t, "src/foo/[].js", "")
}

// TestUnicornFilenameCaseReportAnchorsAndNoFix verifies where the file-level
// diagnostic lands and that it never carries automatic edits.
//
// The host anchors on the file's first statement (the unicorn/no-empty-file
// precedent) so `path:line:col` output and the corpus `// expect:` convention
// point at real source, falling back to offset 0 for statement-less files.
// Renaming a file is not expressible as a text edit, so findings must carry
// neither fixes nor suggestions.
//
// 1. Lint a file whose first statement follows a comment block.
// 2. Lint a comment-only file.
// 3. Assert anchor offsets and the absence of Fix/Suggestions.
func TestUnicornFilenameCaseReportAnchorsAndNoFix(t *testing.T) {
  engine := NewEngine(RuleConfig{unicornFilenameCaseRuleName: SeverityError})
  engine.SetCurrentDirectory(unicornFilenameCaseTestRoot)
  source := "// leading comment\nexport const value = 1;\n"
  file := parseTSFile(t, unicornFilenameCaseTestRoot+"/src/foo_bar.ts", source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d", len(findings))
  }
  if want := strings.Index(source, "export"); findings[0].Pos != want {
    t.Fatalf("finding anchor: want offset %d (first statement), got %d", want, findings[0].Pos)
  }
  if len(findings[0].Fix) != 0 || len(findings[0].Suggestions) != 0 {
    t.Fatalf("filename findings must not carry edits, got %+v", findings[0])
  }

  commentOnly := parseTSFile(
    t,
    unicornFilenameCaseTestRoot+"/src/foo_baz.ts",
    "// only a comment\n",
  )
  findings = engine.Run([]*shimast.SourceFile{commentOnly}, nil)
  if len(findings) != 1 {
    t.Fatalf("comment-only file: want one finding, got %d", len(findings))
  }
  if findings[0].Pos != 0 {
    t.Fatalf("comment-only file: want offset 0, got %d", findings[0].Pos)
  }
}

// TestUnicornFilenameCaseRealProjectPaths verifies the rule against a real
// on-disk project layout with the host operating system's separators.
//
// Virtual `/project` paths cannot prove Windows drive-letter and backslash
// handling; this scenario materializes a temp project the same way command
// tests do, so `filepath.Rel` sees genuine OS-specific spellings on every
// platform CI runs.
//
// 1. Materialize `src/Foo_Bar.ts` under a temp root and lint it.
// 2. Materialize a clean `src/foo-bar.ts` twin.
// 3. Assert the diagnostic (and its absence) with project-relative segments.
func TestUnicornFilenameCaseRealProjectPaths(t *testing.T) {
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    unicornFilenameCaseRuleName,
    "Foo_Bar.ts",
    "export const value = 1;\n",
    nil,
  )
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
  }
  want := "Filename is not in kebab case. Rename it to `foo-bar.ts`."
  if findings[0].Message != want {
    t.Fatalf("want %q, got %q", want, findings[0].Message)
  }

  _, _, clean := runRuleFindingsSnapshotFile(
    t,
    unicornFilenameCaseRuleName,
    "foo-bar.ts",
    "export const value = 1;\n",
    nil,
  )
  if len(clean) != 0 {
    t.Fatalf("clean twin: want no findings, got %d (%+v)", len(clean), clean)
  }
}

// TestUnicornFilenameCaseOptionValidation verifies the ValidateOptions
// surface: accepted shapes bind, malformed shapes become configuration errors
// that disable the rule instead of panicking mid-walk.
//
// The upstream schema is an anyOf over a `case` shape and a `cases` shape with
// `additionalProperties: false`, a unique-items `ignore` array, and boolean
// flags; both keys together, unknown keys, unknown case names, non-boolean
// values, duplicate ignore patterns, and uncompilable patterns are all
// rejected up front.
//
// 1. Bind engines over accepted and rejected option payloads.
// 2. Assert ConfigError is nil exactly for the accepted ones.
func TestUnicornFilenameCaseOptionValidation(t *testing.T) {
  accepted := []string{
    `{}`,
    `{"case":"camelCase"}`,
    `{"case":"camelCaseWithAcronyms"}`,
    `{"case":"kebabCase"}`,
    `{"case":"snakeCase"}`,
    `{"case":"pascalCase"}`,
    `{"cases":{}}`,
    `{"cases":{"camelCase":true,"kebabCase":false}}`,
    `{"ignore":["^foo","bar$"]}`,
    `{"multipleFileExtensions":false,"checkDirectories":false}`,
  }
  for _, options := range accepted {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornFilenameCaseRuleName: SeverityError},
      Options: RuleOptionsMap{unicornFilenameCaseRuleName: json.RawMessage(options)},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("options %s: want acceptance, got %v", options, err)
    }
  }

  rejected := []string{
    `"kebabCase"`,
    `[]`,
    `null`,
    `{"case":"kebab-case"}`,
    `{"case":true}`,
    `{"case":"kebabCase","cases":{"camelCase":true}}`,
    `{"cases":{"kebab-case":true}}`,
    `{"cases":{"kebabCase":"yes"}}`,
    `{"cases":["kebabCase"]}`,
    `{"unknown":true}`,
    `{"ignore":"^foo"}`,
    `{"ignore":["^foo","^foo"]}`,
    `{"ignore":["["]}`,
    `{"multipleFileExtensions":"no"}`,
    `{"checkDirectories":1}`,
  }
  for _, options := range rejected {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornFilenameCaseRuleName: SeverityError},
      Options: RuleOptionsMap{unicornFilenameCaseRuleName: json.RawMessage(options)},
    })
    if err := engine.ConfigError(); err == nil {
      t.Fatalf("options %s: want a config error, got none", options)
    }
  }
}

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

// TestUnicornFilenameCaseSplitNameLineTerminatorEdge verifies the
// leading-underscore extraction's JavaScript regex parity on names containing
// line terminators.
//
// Upstream captures `/^(_+)(.*)$/` without the `s` or `m` flags, so a name
// with `\n`, `\r`, U+2028, or U+2029 after its underscores never matches
// and the underscores stay part of the checked words. Real filesystems rarely
// produce such names, but the helper must not silently diverge from the
// oracle on them.
//
// 1. Split conventional and line-terminator-bearing underscore names.
// 2. Assert leading extraction happens only for the conventional ones.
func TestUnicornFilenameCaseSplitNameLineTerminatorEdge(t *testing.T) {
  leading, words := unicornFilenameCaseSplitName("__fooBar")
  if leading != "__" || len(words) != 1 || words[0].word != "fooBar" {
    t.Fatalf("__fooBar: want leading __ + [fooBar], got %q %+v", leading, words)
  }
  for _, name := range []string{"_foo\nbar", "_foo\rbar", "_foo bar", "_foo bar"} {
    leading, words := unicornFilenameCaseSplitName(name)
    if leading != "" {
      t.Fatalf("%q: leading underscores must stay unextracted, got leading %q", name, leading)
    }
    if len(words) == 0 || !strings.HasPrefix(words[0].word, "_") {
      t.Fatalf("%q: first word must keep the underscore, got %+v", name, words)
    }
  }
}
