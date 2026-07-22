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

// regexContext retains the token boundary needed to classify the next slash.
// It is deliberately smaller than a parser: the scope scanner needs only to
// skip opaque regex text correctly, never to validate the surrounding program.
type regexContext struct {
  kind regexPredecessor
  last byte

  lastAdjacent bool
  word               string
  previousWord       string
  beforePreviousWord string
  wordMember   bool
  previousMember bool
  wordExpression bool
  previousExpression bool

  pendingFunction bool
  functionExpression bool
  functionBody bool
  functionBodyExpression bool
  pendingClass bool
  classExpression bool

  parens []regexParen
  braces []bool
}

type regexParen struct {
  control bool
  function bool
  expression bool
}

type regexPredecessor int

const (
  regexPredecessorStart regexPredecessor = iota
  regexPredecessorOperator
  regexPredecessorWord
  regexPredecessorValue
  regexPredecessorControlHeader
)

func (context *regexContext) allowedAfter() bool {
  switch context.kind {
  case regexPredecessorValue:
    return false
  case regexPredecessorWord:
    word, member := context.lastWord()
    return regexKeywordPrecedes(word, member)
  default:
    return true
  }
}
func (context *regexContext) writeValue(symbol byte) {
  context.finishWord()
  context.kind = regexPredecessorValue
  context.last = symbol
  context.lastAdjacent = true
}

func (context *regexContext) separator() {
  context.finishWord()
  context.lastAdjacent = false
}

func (context *regexContext) writeCode(symbol byte) {
  if isIdentifierByte(symbol) {
    if context.word == "" {
      context.wordExpression = context.expressionPosition()
      context.wordMember = context.last == '.'
    }
    context.word += string(symbol)
    context.kind = regexPredecessorWord
    context.last = symbol
    context.lastAdjacent = true
    return
  }
  context.finishWord()
  switch symbol {
  case '(':
    paren := regexParen{control: context.controlHeaderPrecedes()}
    if context.pendingFunction {
      paren.function = true
      paren.expression = context.functionExpression
      context.pendingFunction = false
    }
    context.parens = append(context.parens, paren)
    context.kind = regexPredecessorOperator
  case ')':
    paren := regexParen{}
    if depth := len(context.parens); depth > 0 {
      paren = context.parens[depth-1]
      context.parens = context.parens[:depth-1]
    }
    if paren.function {
      context.functionBody = true
      context.functionBodyExpression = paren.expression
    }
    if paren.control {
      context.kind = regexPredecessorControlHeader
    } else {
      context.kind = regexPredecessorValue
    }
  case '{':
    context.braces = append(context.braces, context.blockPrecedes())
    context.kind = regexPredecessorOperator
  case '}':
    block := false
    if depth := len(context.braces); depth > 0 {
      block = context.braces[depth-1]
      context.braces = context.braces[:depth-1]
    }
    if block {
      context.kind = regexPredecessorControlHeader
    } else {
      context.kind = regexPredecessorValue
    }
  case ']':
    context.kind = regexPredecessorValue
  case '+', '-':
    if context.lastAdjacent && context.last == symbol {
      context.kind = regexPredecessorValue
    } else {
      context.kind = regexPredecessorOperator
    }
  default:
    context.kind = regexPredecessorOperator
  }
  context.last = symbol
  context.lastAdjacent = true
}

func (context *regexContext) blockPrecedes() bool {
  if context.pendingClass {
    context.pendingClass = false
    return !context.classExpression
  }
  if context.functionBody {
    context.functionBody = false
    return !context.functionBodyExpression
  }
  if context.kind == regexPredecessorControlHeader {
    return true
  }
  if context.kind == regexPredecessorStart {
    return true
  }
  if context.kind == regexPredecessorWord {
    word, _ := context.lastWord()
    switch word {
    case "do", "else", "finally", "try":
      return true
    }
  }
  return context.last == ';' || context.last == '{' || context.last == '}'
}

func (context *regexContext) controlHeaderPrecedes() bool {
  word, member := context.lastWord()
  if member {
    return false
  }
  switch word {
  case "if", "while", "for", "with", "switch", "catch":
    return true
  case "await":
    return context.beforePreviousWord == "for"
  default:
    return false
  }
}

func (context *regexContext) expressionPosition() bool {
  switch context.kind {
  case regexPredecessorStart, regexPredecessorControlHeader:
    return false
  case regexPredecessorValue:
    return false
  case regexPredecessorWord:
    word, member := context.lastWord()
    if word == "async" {
      return context.previousExpression
    }
    return regexKeywordPrecedes(word, member)
  default:
    return context.last != ';' && context.last != '{' && context.last != '}'
  }
}

func (context *regexContext) finishWord() {
  if context.word == "" {
    return
  }
  if context.word == "function" {
    context.pendingFunction = true
    context.functionExpression = context.wordExpression
  } else if context.word == "class" {
    context.pendingClass = true
    context.classExpression = context.wordExpression
  }
  context.beforePreviousWord = context.previousWord
  context.previousWord = context.word
  context.previousMember = context.wordMember
  context.previousExpression = context.wordExpression
  context.word = ""
  context.wordMember = false
}

func (context *regexContext) lastWord() (string, bool) {
  if context.word != "" {
    return context.word, context.wordMember
  }
  return context.previousWord, context.previousMember
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
  // regex tracks delimiter and value boundaries so a slash after a control
  // header or division operator is not confused with one after a value.
  regex := regexContext{}

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
          regex.separator()
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
          regex.separator()
          scope = lexicalScopeLineComment
          index += 2
        default:
          // A comment opener already won above, so this `/` can only be
          // division or a regex literal. Skipping the literal keeps a class
          // such as `/["'/*]/` from opening a string or a comment that the
          // source never wrote.
          end := -1
          if regex.allowedAfter() {
            end = regexLiteralEnd(text, index)
          }
          if end == -1 {
            // Division, or no terminator before the line ended.
            regex.writeCode(symbol)
            index++
            break
          }
          if offset < end {
            return lexicalScopeRegex
          }
          regex.writeValue(symbol)
          index = end
        }
      case '"', '\'':
        scope = lexicalScopeString
        quote = symbol
        regex.writeValue(symbol)
        index++
      case '`':
        scope = lexicalScopeTemplate
        regex.writeValue(symbol)
        index++
      case '{':
        braces++
        regex.writeCode(symbol)
        index++
      case '}':
        if braces > 0 {
          braces--
        } else if depth := len(templateBraces); depth > 0 {
          braces = templateBraces[depth-1]
          templateBraces = templateBraces[:depth-1]
          scope = lexicalScopeTemplate
        }
        regex.writeCode(symbol)
        index++
      default:
        // Every whitespace byte is below `' '`, and so is every control byte
        // that could not precede a regex either.
        if symbol > ' ' {
          regex.writeCode(symbol)
        } else {
          regex.separator()
        }
        index++
      }
    case lexicalScopeLineComment:
      // CR ends a line for TypeScript too, so a CR-only buffer cannot leave the
      // rest of the file inside one `//`.
      if symbol == '\n' || symbol == '\r' {
        scope = lexicalScopeCode
        regex.separator()
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
        regex.writeValue(symbol)
        index++
      case symbol == '\n' || symbol == '\r':
        scope = lexicalScopeCode
        regex.separator()
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
        regex.writeValue(symbol)
        index++
      case symbol == '$' && index+1 < len(text) && text[index+1] == '{':
        templateBraces = append(templateBraces, braces)
        braces = 0
        scope = lexicalScopeCode
        regex.writeCode('{')
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

func regexKeywordPrecedes(word string, member bool) bool {
  if member {
    // `in`, `of`, `new`, and the rest are legal property names, and a member
    // access is a value: `obj.in / 2` divides.
    return false
  }
  switch word {
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
