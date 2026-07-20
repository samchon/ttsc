package lspserver

// lexicalScope names the kind of token a byte offset sits in.
//
// It is what a scanner can decide without a parse: comments, string and
// template literals, and regular expression literals all carry text that is not
// code, and every one of them can hold bytes that look like a comment
// delimiter.
type lexicalScope int

const (
  lexicalScopeCode lexicalScope = iota
  lexicalScopeLineComment
  lexicalScopeBlockComment
  lexicalScopeJSDoc
  lexicalScopeString
  lexicalScopeTemplate
  lexicalScopeRegex
)

func (scope lexicalScope) String() string {
  switch scope {
  case lexicalScopeLineComment:
    return "line comment"
  case lexicalScopeBlockComment:
    return "block comment"
  case lexicalScopeJSDoc:
    return "jsdoc"
  case lexicalScopeString:
    return "string"
  case lexicalScopeTemplate:
    return "template"
  case lexicalScopeRegex:
    return "regex"
  default:
    return "code"
  }
}

// cursorInJSDoc reports whether an offset sits inside a `/** */` block.
//
// Line comments are not considered: `// @evidence` is not a doc comment and a
// tag there means nothing to the rule that published the hint.
func cursorInJSDoc(text string, offset int) bool {
  if offset < 0 || offset > len(text) {
    return false
  }
  return lexicalScopeAt(text, offset) == lexicalScopeJSDoc
}

// lexicalScopeAt reports the scope of the byte at offset, scanning forward from
// the start of the document.
//
// A backward search for the nearest `/**` cannot answer the question, because
// the same three bytes appear in `const example = "/** @par"` — and answering
// "jsdoc" there offers a JSDoc rule's tags in the middle of a string literal.
// Comment state is not a property of the bytes before the cursor; it is a
// property of the token stream that produced them, so the scan starts where the
// token stream does.
//
// It stays a scanner rather than a parse. The proxy holds text, not a tree, and
// asking tsgo would put a round trip on the keystroke path — the exact cost this
// design exists to avoid. Forward scanning costs one pass over the prefix, the
// same complexity the backward search it replaced already had: a few
// milliseconds per megabyte, so well under a millisecond for an ordinary source
// file (see BenchmarkCursorInJSDoc). That is small enough beside the upstream
// completion round trip the same request makes, so the scan is recomputed per
// request instead of a span cache having to be invalidated per didChange.
//
// Recovery matters as much as recognition here, because the buffer is live and
// therefore usually not valid TypeScript. An unterminated string ends at the
// line break, exactly as the TypeScript scanner recovers, so a stray apostrophe
// mid-edit cannot swallow every JSDoc block below it.
//
// One boundary stays with the scanner: JSX element text is read as code, so
// `/**` typed between JSX tags still opens a comment here. Separating JSX text
// from a comparison operator needs the grammar, which is the parse this pass
// exists to avoid, and the position is far rarer than the literals above.
func lexicalScopeAt(text string, offset int) lexicalScope {
  if offset > len(text) {
    offset = len(text)
  }
  scope := lexicalScopeCode
  quote := byte(0)
  // braces counts the `{` depth of the current code region, and templateBraces
  // remembers the enclosing depth per open `${`, so the `}` that ends an
  // interpolation is told apart from the `}` that ends an object literal in it.
  braces := 0
  var templateBraces []int
  // last is the most recent significant code byte. It is the only context the
  // `/` ambiguity needs: division after a value, a regex literal otherwise.
  last := byte(0)

  index := 0
  for index < offset {
    symbol := text[index]
    switch scope {
    case lexicalScopeCode:
      // A switch on the byte itself, so the overwhelmingly common case — a byte
      // that starts no literal and no comment — costs one jump rather than a
      // walk through every delimiter test.
      switch symbol {
      case '/':
        next := byte(0)
        if index+1 < len(text) {
          next = text[index+1]
        }
        switch {
        case next == '*':
          // `/**/` is an empty block comment, not a JSDoc block; TypeScript
          // reads the third `*` as part of the terminator.
          if index+2 < len(text) && text[index+2] == '*' &&
            (index+3 >= len(text) || text[index+3] != '/') {
            scope = lexicalScopeJSDoc
          } else {
            scope = lexicalScopeBlockComment
          }
          index += 2
        case next == '/':
          scope = lexicalScopeLineComment
          index += 2
        default:
          // A comment opener already won above, so this `/` can only be
          // division or a regex literal. Skipping the literal keeps a class
          // such as `/["'/*]/` from opening a string or a comment that the
          // source never wrote.
          end := -1
          if regexAllowedAfter(text[:index], last) {
            end = regexLiteralEnd(text, index)
          }
          if end == -1 {
            // Division, or no terminator before the line ended.
            last = symbol
            index++
            break
          }
          if offset < end {
            return lexicalScopeRegex
          }
          last = symbol
          index = end
        }
      case '"', '\'':
        scope = lexicalScopeString
        quote = symbol
        last = symbol
        index++
      case '`':
        scope = lexicalScopeTemplate
        last = symbol
        index++
      case '{':
        braces++
        last = symbol
        index++
      case '}':
        if braces > 0 {
          braces--
        } else if depth := len(templateBraces); depth > 0 {
          braces = templateBraces[depth-1]
          templateBraces = templateBraces[:depth-1]
          scope = lexicalScopeTemplate
        }
        last = symbol
        index++
      default:
        // Every whitespace byte is below `' '`, and so is every control byte
        // that could not precede a regex either.
        if symbol > ' ' {
          last = symbol
        }
        index++
      }
    case lexicalScopeLineComment:
      // CR ends a line for TypeScript too, so a CR-only buffer cannot leave the
      // rest of the file inside one `//`.
      if symbol == '\n' || symbol == '\r' {
        scope = lexicalScopeCode
      }
      index++
    case lexicalScopeBlockComment, lexicalScopeJSDoc:
      if symbol == '*' && index+1 < len(text) && text[index+1] == '/' {
        scope = lexicalScopeCode
        index += 2
        break
      }
      index++
    case lexicalScopeString:
      switch {
      case symbol == '\\':
        index += escapeWidth(text, index)
      case symbol == quote:
        scope = lexicalScopeCode
        index++
      case symbol == '\n' || symbol == '\r':
        scope = lexicalScopeCode
        index++
      default:
        index++
      }
    case lexicalScopeTemplate:
      switch {
      case symbol == '\\':
        index += escapeWidth(text, index)
      case symbol == '`':
        scope = lexicalScopeCode
        last = symbol
        index++
      case symbol == '$' && index+1 < len(text) && text[index+1] == '{':
        templateBraces = append(templateBraces, braces)
        braces = 0
        scope = lexicalScopeCode
        last = '{'
        index += 2
      default:
        index++
      }
    }
  }
  return scope
}

// escapeWidth returns how many bytes a backslash escape consumes, counting a
// CRLF line continuation as one unit so the `\n` cannot be mistaken for the
// unterminated-literal recovery point.
func escapeWidth(text string, index int) int {
  if index+2 < len(text) && text[index+1] == '\r' && text[index+2] == '\n' {
    return 3
  }
  return 2
}

// regexAllowedAfter reports whether a `/` at this position can open a regular
// expression literal rather than divide.
//
// The distinction needs the previous token, which is exactly what `last`
// carries. A value — identifier, number, string, or a closing bracket — can be
// divided, so `/` after one is an operator; everything else is an expression
// position where only a literal fits. The keyword check exists because
// `return /re/` ends in an identifier byte yet is an expression position.
func regexAllowedAfter(head string, last byte) bool {
  switch {
  case last == 0:
    return true
  case isIdentifierByte(last):
    return regexKeywordPrecedes(head)
  case last == ')' || last == ']' || last == '}':
    return false
  case last == '"' || last == '\'' || last == '`':
    return false
  case last == '/':
    // The byte a completed regex literal leaves behind. A literal is a value,
    // so what follows it divides.
    return false
  default:
    return true
  }
}

func regexKeywordPrecedes(head string) bool {
  end := len(head)
  for end > 0 && isSpaceByte(head[end-1]) {
    end--
  }
  start := end
  for start > 0 && isIdentifierByte(head[start-1]) {
    start--
  }
  if start > 0 && head[start-1] == '.' {
    // `in`, `of`, `new`, and the rest are legal property names, and a member
    // access is a value: `obj.in / 2` divides.
    return false
  }
  switch head[start:end] {
  case "await", "case", "delete", "do", "else", "in", "instanceof", "new",
    "of", "return", "throw", "typeof", "void", "yield":
    return true
  default:
    return false
  }
}

// regexLiteralEnd returns the offset just past a regular expression literal
// that starts at index, or -1 when the text is not one.
//
// A regex literal cannot span a line, so an unterminated scan means the `/` was
// division after all and the caller resumes there. The `[...]` class is tracked
// because an unescaped `/` inside one does not terminate the literal.
func regexLiteralEnd(text string, index int) int {
  inClass := false
  for cursor := index + 1; cursor < len(text); cursor++ {
    switch text[cursor] {
    case '\\':
      cursor++
    case '\n', '\r':
      return -1
    case '[':
      inClass = true
    case ']':
      inClass = false
    case '/':
      if !inClass {
        // Flags are identifier bytes; code scope reads them harmlessly.
        return cursor + 1
      }
    }
  }
  return -1
}

func isIdentifierByte(symbol byte) bool {
  switch {
  case symbol >= 'a' && symbol <= 'z':
    return true
  case symbol >= 'A' && symbol <= 'Z':
    return true
  case symbol >= '0' && symbol <= '9':
    return true
  case symbol == '_' || symbol == '$':
    return true
  default:
    // Every byte of a non-ASCII rune belongs to an identifier or to literal
    // text; either way it is not an operator that could precede a regex.
    return symbol >= 0x80
  }
}

func isSpaceByte(symbol byte) bool {
  return symbol == ' ' || symbol == '\t' || symbol == '\r' || symbol == '\n' ||
    symbol == '\v' || symbol == '\f'
}
