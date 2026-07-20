package lspserver

import "testing"

// TestLSPCompletionScopeIgnoresJSDocBytesInLiterals pins the lexical table the
// JSDoc scope decision rests on.
//
// `/**` is three ordinary bytes. A string, a template, a regex class, and a line
// comment can all contain them, and a backward search for the nearest opener
// calls every one of those positions a doc comment — which is how
// `const example = "/** @par"` came to be offered JSDoc tag completions. Every
// impostor below is a position that search answered wrongly; every real block
// below is what stops a replacement from passing by refusing everything.
//
//  1. Put the cursor after JSDoc-shaped bytes in every token kind that can hold
//     them.
//  2. Assert the scanner's scope and the `cursorInJSDoc` answer derived from it.
//  3. Keep a real block adjacent to each impostor, so a scanner that simply
//     refused everything could not pass.
func TestLSPCompletionScopeIgnoresJSDocBytesInLiterals(t *testing.T) {
  cases := []struct {
    name string
    text string
    want lexicalScope
  }{
    {name: "real block", text: "/** @par", want: lexicalScopeJSDoc},
    {name: "multi line block", text: "/**\n * ok\n * @par", want: lexicalScopeJSDoc},
    // The buffer an editor sends on Windows, with prose the rule may cite.
    {name: "crlf block with non ascii prose", text: "/**\r\n * 가격 😀\r\n * @par", want: lexicalScopeJSDoc},
    {name: "closed block", text: "/** ok */ @par", want: lexicalScopeCode},
    {name: "empty block comment", text: "/**/ @par", want: lexicalScopeCode},
    {name: "plain block comment", text: "/* @par", want: lexicalScopeBlockComment},
    {name: "line comment", text: "// /** @par", want: lexicalScopeLineComment},
    // CR ends a line for TypeScript, so a CR-only buffer must not leave the
    // rest of the file inside one `//`.
    {name: "line comment ended by a lone cr", text: "// note\r/** @par", want: lexicalScopeJSDoc},
    {name: "line comment ended by crlf", text: "// note\r\n/** @par", want: lexicalScopeJSDoc},
    {name: "no delimiter", text: "const x = 1; @par", want: lexicalScopeCode},

    {name: "double quoted string", text: "const x = \"/** @par", want: lexicalScopeString},
    {name: "single quoted string", text: "const x = '/** @par", want: lexicalScopeString},
    {name: "template literal", text: "const x = `/** @par", want: lexicalScopeTemplate},
    // The interpolation returns to code, so the template text after it is still
    // template text.
    {name: "template after interpolation", text: "const x = `${ y } /** @par", want: lexicalScopeTemplate},
    {name: "string inside interpolation", text: "const x = `${ \"/** @par", want: lexicalScopeString},
    {name: "nested template inside interpolation", text: "const x = `${ `inner /** @par", want: lexicalScopeTemplate},
    // A comment inside an interpolation is a real comment: nesting must not be
    // answered by refusing everything under a backtick.
    {name: "block comment inside interpolation", text: "const x = `${ /** @par", want: lexicalScopeJSDoc},
    // An escaped quote does not end the string.
    {name: "escaped quote inside string", text: "const x = 'it\\'s /** @par", want: lexicalScopeString},
    // An escaped backslash does end it, so the block that follows is real.
    {name: "escaped backslash ends the string", text: "const x = \"a\\\\\" /** @par", want: lexicalScopeJSDoc},
    // A backslash before CRLF is one line continuation, so the string keeps
    // going and the line-end recovery must not fire on that `\n`.
    {name: "escaped crlf continues the string", text: "const s = \"a\\\r\nb /** @par", want: lexicalScopeString},
    {name: "block after a string holding the opener", text: "const x = \"/**\";\n/** @par", want: lexicalScopeJSDoc},
    // A `*/` inside a string closes nothing, so the block after it still opens.
    {name: "block after a string holding the terminator", text: "const x = \"*/\";\n/** @par", want: lexicalScopeJSDoc},
    // The mirror image: a quote inside a doc comment is prose, not a string.
    {name: "quote inside a block", text: "/** the user's @par", want: lexicalScopeJSDoc},
    // A live buffer is usually invalid mid-edit. Without line-end recovery one
    // stray quote would hide every doc comment below it.
    {name: "unterminated string recovers at the line end", text: "const bad = \"oops\nconst y = 1;\n/** @par", want: lexicalScopeJSDoc},

    {name: "regex class holding the opener", text: "const re = /[/**]/; @par", want: lexicalScopeCode},
    // Without regex skipping the quote in the class would open a string and
    // swallow the real block that follows on the same line.
    {name: "block after a regex holding a quote", text: "const re = /[\"]/; /** @par", want: lexicalScopeJSDoc},
    {name: "regex after a keyword", text: "function f() { return /[\"]/; } /** @par", want: lexicalScopeJSDoc},
    // The negative twin: `/` after a value divides, and reading it as a literal
    // would swallow the block that follows.
    {name: "division is not a regex", text: "const ratio = a / b; /** @par", want: lexicalScopeJSDoc},
    // A keyword is a legal property name, and a member access is a value.
    {name: "keyword as a property name divides", text: "const n = obj.in / 2; /** @par", want: lexicalScopeJSDoc},
    // What follows a completed literal divides, flags or not.
    {name: "division after a flagless regex", text: "const n = /re/ / 2; /** @par", want: lexicalScopeJSDoc},
  }

  for _, entry := range cases {
    offset := len(entry.text)
    if got := lexicalScopeAt(entry.text, offset); got != entry.want {
      t.Errorf("%s: lexicalScopeAt(%q, %d) = %s, want %s", entry.name, entry.text, offset, got, entry.want)
    }
    wantJSDoc := entry.want == lexicalScopeJSDoc
    if got := cursorInJSDoc(entry.text, offset); got != wantJSDoc {
      t.Errorf("%s: cursorInJSDoc(%q, %d) = %v, want %v", entry.name, entry.text, offset, got, wantJSDoc)
    }
  }

  // A cursor before the opener is outside the block the opener will start.
  if got := lexicalScopeAt("/** @par", 0); got != lexicalScopeCode {
    t.Errorf("a cursor before the opener is in %s, want code", got)
  }
  // A cursor inside a terminated regex literal is inside the literal, not in
  // the comment its bytes spell. Offset 15 is the second `*` of the character
  // class, the byte a backward search reads as an open doc comment.
  if got := lexicalScopeAt("const re = /[/**]/; @par", 15); got != lexicalScopeRegex {
    t.Errorf("a cursor inside a regex literal is in %s, want regex", got)
  }

  // Out-of-range offsets stay refusals rather than panics, because the position
  // comes from the editor and the buffer from the proxy's own splice.
  if cursorInJSDoc("/** @par", -1) || cursorInJSDoc("/** @par", 99) {
    t.Error("an out-of-range offset must be refused rather than answered")
  }
}
