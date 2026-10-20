package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// TestCommentScanHandlesMalformedParserRecovery verifies incomplete source is
// enumerated without panic or comment-like literal leakage.
//
// Editors lint parser-recovery trees continuously. Unterminated templates and
// JSX elements still expose real expression comments, but their raw template
// and JSX text remain parser-classified token spans even when closing syntax is
// absent.
//
//  1. Parse an unterminated template with one real substitution comment.
//  2. Parse an unclosed JSX element with text and expression comment twins.
//  3. Assert only the real leading and expression comments are enumerated.
//
// @evidence contracts/testing.md#behavioral-verification forEachCommentToken enumerates only the literal leading and expression comments in an unterminated template and an unclosed JSX element, preserving each comment's kind and exact source range once in order.
// @evidence contracts/testing.md#independent-expectations The authored real-comment strings define expected ranges through literal positions in the input source, independently of scanner output. Comment-shaped raw template and JSX text are grammar content rather than trivia even during parser recovery.
// @evidence contracts/testing.md#distinguishing-cases Incomplete TS template substitution containing a regex contrasts with incomplete TSX element text; both keep real leading/expression comments while excluding fake literal twins and the template tail. Complete-source controls belong to the adjacent source-mode test.
// @evidence contracts/testing.md#execution-ownership Each literal source is parsed in its real TS or TSX mode and passed to the production comment enumerator in the Go process; assertExactCommentTokens compares the complete ordered token sequence. No files, native build, consumer installation or product process is required.
func TestCommentScanHandlesMalformedParserRecovery(t *testing.T) {
  cases := []struct {
    name     string
    fileName shimtspath.RootedFilePath
    kind     shimcore.ScriptKind
    source   string
    comments []string
  }{
    {
      name:     "template",
      fileName: "/virtual/broken.ts",
      kind:     shimcore.ScriptKindTS,
      source:   "/* leading-real */\nconst broken = `// fake-template ${/[{]/.test(\"{\") /* expression-real */}\n// fake-tail",
      comments: []string{"/* leading-real */", "/* expression-real */"},
    },
    {
      name:     "jsx",
      fileName: "/virtual/broken.tsx",
      kind:     shimcore.ScriptKindTSX,
      source:   "/* leading-real */\nconst view = <div>/* fake-jsx */{/* expression-real */}",
      comments: []string{"/* leading-real */", "/* expression-real */"},
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      file := shimparser.ParseSourceFile(shimast.SourceFileParseOptions{FileName: test.fileName}, test.source, test.kind)
      if file == nil {
        t.Fatal("parser returned nil source file")
      }
      assertExactCommentTokens(t, file, test.source, test.comments)
    })
  }
}
