package linthost

import (
  "strings"
  "testing"
)

// TestConfigLoaderSourcesEscapeEveryLiteralPercent verifies both generated
// config-loader scripts survive their Go format strings as valid source.
//
// The JS and TypeScript loaders are emitted from fmt.Sprintf format strings and
// they carry Node's own percent-encoded separator guard, so every literal
// percent sign inside them has to be doubled. An undoubled one is consumed as a
// format verb and the emitted script still parses: the guard simply becomes a
// regex that can never match, which no execution test can observe. A raw
// newline written into a string literal fails the other way, leaving source
// that does not parse at all, and the generator is likewise the only place that
// is visible. Both are checked here.
//
//  1. Generate the CommonJS and TypeScript loader sources.
//  2. Assert neither carries a Go formatting-error artifact.
//  3. Assert both still carry the encoded-separator guard verbatim.
//  4. Assert no line leaves a string literal open.
func TestConfigLoaderSourcesEscapeEveryLiteralPercent(t *testing.T) {
  for _, generated := range []struct {
    name   string
    source string
  }{
    {name: "script", source: scriptConfigLoaderSource()},
    {
      name: "typescript",
      source: typeScriptConfigLoaderSource(
        `"file:///lint.config.ts"`,
        `"/tmp/ttsc-lint/result.json"`,
        `"/tmp/ttsc-lint"`,
      ),
    },
  } {
    if index := strings.Index(generated.source, "%!"); index != -1 {
      end := index + 64
      if end > len(generated.source) {
        end = len(generated.source)
      }
      t.Fatalf(
        "%s loader source carries a Go formatting artifact: %q",
        generated.name,
        generated.source[index:end],
      )
    }
    if !strings.Contains(generated.source, `/%2f|%5c/i.test(target)`) {
      t.Fatalf(
        "%s loader source lost Node's encoded separator guard",
        generated.name,
      )
    }
    if line, ok := unbalancedQuoteLine(generated.source); ok {
      t.Fatalf(
        "%s loader source leaves a string literal open: %q",
        generated.name,
        line,
      )
    }
  }
}

// unbalancedQuoteLine returns the first line whose double quotes do not pair,
// which is what a raw newline inside a string literal produces.
//
// Counting per line is enough because neither loader contains a multi-line
// string: every literal opens and closes on one line, and the only escapes in
// front of a quote are backslashes, which are skipped with their successor.
func unbalancedQuoteLine(source string) (string, bool) {
  for _, line := range strings.Split(source, "\n") {
    quotes := 0
    for index := 0; index < len(line); index++ {
      if line[index] == '\\' {
        index++
        continue
      }
      if line[index] == '"' {
        quotes++
      }
    }
    if quotes%2 != 0 {
      return line, true
    }
  }
  return "", false
}
