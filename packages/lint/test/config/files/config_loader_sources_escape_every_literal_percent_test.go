package linthost

import (
  "strings"
  "testing"
)

// TestConfigLoaderSourcesEscapeEveryLiteralPercent verifies both generated
// config-loader scripts leave their Go format strings intact.
//
// The JS and TypeScript loaders are emitted from fmt.Sprintf format strings and
// they carry Node's own percent-encoded separator guard, so every literal
// percent sign inside them has to be doubled. An undoubled one is consumed as a
// format verb, and the emitted script still parses: the guard simply becomes a
// regex that can never match, which no execution test can observe. Checking the
// generators is the only place the whole class is visible.
//
//  1. Generate the CommonJS and TypeScript loader sources.
//  2. Assert neither carries a Go formatting-error artifact.
//  3. Assert both still carry the encoded-separator guard verbatim.
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
  }
}
