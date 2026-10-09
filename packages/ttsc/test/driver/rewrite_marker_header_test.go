package driver_test

import (
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteMarkerHeader Verifies marker placement preserves interpreter
// and directive headers while marker-shaped application data remains inert.
//
// Exact independent byte expectations distinguish header state from comments
// or literals elsewhere. Historical markers before directives or after the
// first strict directive stay idempotent alongside the complete new prologue.
//
// 1. Insert markers into plain, directive, BOM and shebang inputs.
// 2. Require exact expected bytes and unchanged output on repeat.
// 3. Contrast string, template, line, larger block and body comment decoys.
//
// @evidence contracts/testing.md#behavioral-verification insertSentinel produces exact literal header placements and returns every actual marked output unchanged on repeat; authored historical headers remain byte-identical.
// @evidence contracts/testing.md#independent-expectations Literal expected output preserves original BOM, shebang, directives and application text while adding one standalone marker at the header boundary. Historical header inputs are deliberate documented marker shapes.
// @evidence contracts/testing.md#distinguishing-cases Empty/plain, single/double strict directives, multiple and same-line directives, CRLF, BOM, shebang with/without final newline and inert string/template/line/larger-block/body comments cover header boundaries; legacy placements before all directives and after strict cover compatibility.
// @evidence contracts/testing.md#execution-ownership This direct Go unit invokes the real marker owner through its existing linkname; it installs no consumer or native producer and is discovered as TestDriverRewriteMarkerHeader.
func TestDriverRewriteMarkerHeader(t *testing.T) {
  marker := driver.RewriteSentinel + "\n"
  insert := func(text string) string {
    file := shimparser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/marker.js"}, text, shimcore.ScriptKindJS)
    return insertSentinel(text, file)
  }
  for _, test := range []struct { name, input, expected string }{
    {"empty", "", marker},
    {"plain", "value();\n", marker+"value();\n"},
    {"strict", "\"use strict\";\nvalue();", "\"use strict\";\n"+marker+"value();"},
    {"single-strict-crlf", "'use strict';\r\nvalue();", "'use strict';\r\n"+marker+"value();"},
    {"directives", "\"use strict\";\n\"custom\";\nvalue();", "\"use strict\";\n\"custom\";\n"+marker+"value();"},
    {"same-line-directives", "\"use strict\";\"custom\";value();", "\"use strict\";\"custom\";\n"+marker+"value();"},
    {"bom", "\uFEFFvalue();", "\uFEFF"+marker+"value();"},
    {"shebang", "#!/usr/bin/env node\nvalue();", "#!/usr/bin/env node\n"+marker+"value();"},
    {"shebang-eof", "#!/usr/bin/env node", "#!/usr/bin/env node\n"+marker},
    {"directive-data", "\"/* @ttsc-rewritten */\";\nvalue();", "\"/* @ttsc-rewritten */\";\n"+marker+"value();"},
    {"string", "const marker = \"/* @ttsc-rewritten */\";", marker+"const marker = \"/* @ttsc-rewritten */\";"},
    {"template", "const marker = `/* @ttsc-rewritten */`;", marker+"const marker = `/* @ttsc-rewritten */`;"},
    {"line-comment", "// /* @ttsc-rewritten */\nvalue();", marker+"// /* @ttsc-rewritten */\nvalue();"},
    {"larger-comment", "/* prefix /* @ttsc-rewritten */\nvalue();", marker+"/* prefix /* @ttsc-rewritten */\nvalue();"},
    {"body-comment", "value();\n/* @ttsc-rewritten */\nother();", marker+"value();\n/* @ttsc-rewritten */\nother();"},
  } {
    t.Run(test.name, func(t *testing.T) {
      got := insert(test.input)
      if got != test.expected {
        t.Fatalf("marker output = %q, want %q", got, test.expected)
      }
      if repeated := insert(got); repeated != got {
        t.Fatalf("repeat changed marker output: %q", repeated)
      }
    })
  }
  for _, legacy := range []string{
    marker+"\"use strict\";\n\"custom\";\nvalue();",
    "\"use strict\";\n"+marker+"\"custom\";\nvalue();",
  } {
    if got := insert(legacy); got != legacy {
      t.Fatalf("historical marker changed: %q", got)
    }
  }
}
