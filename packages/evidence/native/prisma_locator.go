package evidence

import (
  "strings"
  "unicode"
)

// prismaLocation is where one declared name is written.
type prismaLocation struct {
  Path string
  Line int
}

// prismaCommentForm distinguishes the three comment syntaxes Prisma's grammar
// accepts: line comments carry no citation, and only triple-slash documentation
// can become an unattached file-level exclusion carrier.
type prismaCommentForm string

const (
  prismaDocComment   prismaCommentForm = "doc"
  prismaLineComment  prismaCommentForm = "line"
  prismaBlockComment prismaCommentForm = "block"
)

// prismaCommentRun is one comment run and the declaration it attaches to.
//
// A run is either the contiguous documentation block above one declaration or a
// single comment line that can never document one: a `//` line, or a comment
// that shares its line with code. Body preserves a documentation run's own line
// spacing — a line the run skipped is empty rather than absent — so a tag's
// offset inside the body is still its offset in the file. Key is the
// declaration the run documents, empty when it documents nothing unless
// FileLevel identifies a top-level triple-slash exclusion carrier. Trailing
// marks the single-line run whose comment shares its line with code.
type prismaCommentRun struct {
  Form      prismaCommentForm
  Path      string
  Line      int
  Body      string
  Key       string
  FileLevel bool
  Trailing  bool
}

// prismaFileScan is everything one schema file yields to the native side.
type prismaFileScan struct {
  Locations map[string]prismaLocation
  Comments  []prismaCommentRun
}

// prismaByteOrderMark is the UTF-8 encoding of U+FEFF, spelled as bytes so the
// constant is visible in an editor that hides the character.
const prismaByteOrderMark = "\xef\xbb\xbf"

// prismaLineBreaks rewrites every line terminator Prisma's grammar accepts to
// `\n`, taking `\r\n` as one terminator rather than two.
var prismaLineBreaks = strings.NewReplacer("\r\n", "\n", "\r", "\n")

// prismaBlockKeywords are the top-level block openers Prisma's grammar accepts.
//
// All six are recognized even though only `model` and `view` own a unit, because
// recognizing a block is how the scan knows when it is *not* inside one.
// Dropping `datasource` and `generator` would leave their settings looking like
// members of whatever block was declared before them.
var prismaBlockKeywords = map[string]bool{
  "model":      true,
  "view":       true,
  "type":       true,
  "enum":       true,
  "datasource": true,
  "generator":  true,
}

// prismaMemberBlocks are the blocks whose names and members the scan locates.
//
// Locating a block is not owning a unit for it. A `type` block is a composite
// type, which is outside the unit model: the parser reports it apart from the
// models the units are built from, so its locations are recorded and never
// looked up, and a citation written in one is reported as documenting something
// that is not a model, column, or relation.
var prismaMemberBlocks = map[string]bool{
  "model": true,
  "view":  true,
  "type":  true,
}

// locatePrismaDeclarations finds the line each declared name is written on and
// the comment runs that document them.
//
// This is a locator, not a parser. The names it answers for come from Prisma's
// own parser, which returns no positions at all, so the only questions asked
// here are *where* a name is written and *what comment precedes it* — never
// what exists. A name it fails to find loses a precise line and nothing else,
// which is what makes a native scan safe on a grammar this rule does not own.
//
// Two clauses of that grammar do the structural work
// (`prisma/prisma-engines`, `psl/schema-ast/src/parser/datamodel.pest`):
// `field_declaration` terminates at `NEWLINE`, and a block opener is likewise
// its own line. Measured against the real parser, a field whose attribute
// arguments span two lines and a single-line `model X { ... }` are both hard
// errors — so "one declaration, one line" is Prisma's rule, inherited rather
// than approximated.
//
// The first spelling of a name wins. A duplicate name across the set is a
// schema Prisma itself rejects, so this scan never has to arbitrate one.
func locatePrismaDeclarations(
  root string,
  sources []string,
  readers ...evidenceInputReader,
) (map[string]prismaLocation, []prismaCommentRun) {
  inputs := inputReader(readers)
  locations := map[string]prismaLocation{}
  comments := []prismaCommentRun{}
  for _, source := range sources {
    content, err := inputs.ReadFile(resolveProjectPath(root, source))
    if err != nil {
      continue
    }
    scan := scanPrismaFile(source, string(content), locations)
    comments = append(comments, scan.Comments...)
  }
  return locations, comments
}

// scanPrismaFile walks one file once, recording where names are written and
// which comment run documents each of them.
//
// Attachment reproduces what Prisma itself does with a comment, measured rather
// than inferred, because the two answers differ in a way no reading of the
// grammar suggests:
//
//   - A run attaches to the next declaration, and an intervening `//` line does
//     not break it — two `///` lines around one `//` document the same
//     declaration together.
//   - At top level a blank line detaches the run entirely; inside a block it
//     does not. `/// doc` then a blank line then `model Sale` documents
//     nothing, while the same shape above a field still documents that field.
//   - A run followed by a block attribute or by the block's closing brace
//     documents nothing.
//
// A comment that shares its line with code never joins a run. Prisma reads a
// trailing `///` or `/* */` as documentation of the field on its own line, and
// never of the declaration below it, and this graph reads a citation only from
// the lines above a declaration, so such a comment is reported instead.
//
// A run that documents nothing keeps an empty Key rather than being dropped,
// because a citation written there is a citation that will never be honoured —
// and this rule reports that rather than letting it pass for a tag that works.
//
// The scan reads the text the parser was handed, not the bytes on disk: the
// bridge decodes a file as UTF-8, which drops a leading byte order mark, and
// Prisma's grammar ends a line at `\n`, `\r\n`, or a lone `\r`. A scan that kept
// the mark would fail to recognise a first-line block opener or to attach a
// first-line comment, and one that split on `\n` alone would see a lone-`\r`
// file as a single line.
func scanPrismaFile(
  source string,
  content string,
  locations map[string]prismaLocation,
) prismaFileScan {
  content = prismaLineBreaks.Replace(strings.TrimPrefix(content, prismaByteOrderMark))
  scan := prismaFileScan{Locations: locations}
  record := func(key string, line int) {
    if key == "" {
      return
    }
    if _, exists := locations[key]; exists {
      return
    }
    locations[key] = prismaLocation{Path: source, Line: line}
  }

  lines := strings.Split(content, "\n")
  depth := 0
  block := ""
  // addressable separates "this comment documents nothing" from "this comment
  // documents something this graph cannot cite". An enum, a datasource, and a
  // generator all take a doc comment and none of them owns a unit, so a
  // citation there needs the second diagnostic — the first would tell its
  // author to move a comment that is already exactly where they meant it.
  addressable := false
  commented := false
  pending := []prismaPendingComment{}
  flush := func(key string) {
    scan.Comments = append(scan.Comments, prismaCommentRuns(source, pending, key)...)
    pending = nil
  }
  for index, raw := range lines {
    code, comment, form, stillCommented := prismaPartsOf(raw, commented)
    commented = stillCommented
    trimmed := strings.TrimSpace(code)
    if comment != "" || form != "" {
      pending = append(pending, prismaPendingComment{
        Form:     form,
        Line:     index + 1,
        Text:     comment,
        Trailing: trimmed != "",
        TopLevel: depth == 0,
      })
    }
    if trimmed == "" {
      // A blank line ends a top-level run. Inside a block it does not,
      // which is measured behaviour rather than a simplification.
      if comment == "" && form == "" && depth == 0 {
        flush("")
      }
      continue
    }
    opens := strings.Count(code, "{")
    closes := strings.Count(code, "}")
    switch {
    case depth == 0 && opens != 0:
      keyword, name, ok := prismaBlockHead(trimmed)
      block, addressable = "", false
      if !ok {
        flush("")
        break
      }
      block = name
      addressable = prismaMemberBlocks[keyword]
      if addressable {
        record(name, index+1)
      }
      flush(name)
    case depth == 1 && block != "":
      name, ok := prismaMemberName(trimmed)
      if !ok {
        // A block attribute or the closing brace. Prisma documents
        // neither, so a run stopping here documents nothing.
        flush("")
        break
      }
      if addressable {
        record(block+"."+name, index+1)
      }
      flush(block + "." + name)
    default:
      flush("")
    }
    depth += opens - closes
    if depth <= 0 {
      depth = 0
      block = ""
      addressable = false
    }
  }
  flush("")
  return scan
}

type prismaPendingComment struct {
  Form prismaCommentForm
  Line int
  Text string
  // Trailing marks a comment that shared its line with code. Such a comment
  // belongs to the line it sits on, never to the declaration below it, so it
  // cannot join the documentation run above that declaration.
  Trailing bool
  // TopLevel marks a comment written outside every Prisma block. A detached
  // documentation run there may carry claim-local exclusions for the file
  // without becoming part of Prisma's generated schema documentation.
  TopLevel bool
}

// prismaCommentRuns turns the pending comment lines above one declaration into
// runs.
//
// Every `///` and `/* */` line that does not share its line with code is joined
// into the one documentation run, and that run alone can carry a citation. Every
// other line, a `//` comment or a comment trailing code, becomes a run of its
// own, and exists solely to be reported. Keeping the documentation run's body
// line-aligned is what lets a tag inside it be reported at the line it was
// written on: a line the run skipped becomes an empty line rather than
// disappearing.
func prismaCommentRuns(
  source string,
  pending []prismaPendingComment,
  key string,
) []prismaCommentRun {
  if len(pending) == 0 {
    return nil
  }
  runs := []prismaCommentRun{}
  documenting := []prismaPendingComment{}
  for _, comment := range pending {
    // `///` and `/* */` are both documentation to Prisma — measured, both
    // reach the parser's `documentation` and both are emitted into the
    // generated client and into prisma-markdown's ERD. Only `//` is
    // discarded, so only `//` cannot carry a citation.
    if comment.Form != prismaLineComment && !comment.Trailing {
      documenting = append(documenting, comment)
      continue
    }
    runs = append(runs, prismaCommentRun{
      Form:     comment.Form,
      Path:     source,
      Line:     comment.Line,
      Body:     comment.Text,
      Key:      "",
      Trailing: comment.Trailing,
    })
  }
  if len(documenting) != 0 {
    first := documenting[0].Line
    body := make([]string, documenting[len(documenting)-1].Line-first+1)
    fileLevel := key == ""
    for _, comment := range documenting {
      body[comment.Line-first] = comment.Text
      fileLevel =
        fileLevel &&
          comment.TopLevel &&
          comment.Form == prismaDocComment
    }
    runs = append(runs, prismaCommentRun{
      Form:      prismaDocComment,
      Path:      source,
      Line:      first,
      Body:      strings.Join(body, "\n"),
      Key:       key,
      FileLevel: fileLevel,
    })
  }
  return runs
}

// prismaPartsOf splits one line into the code it declares and the comment it
// carries.
//
// String contents are dropped from the code rather than kept, because a brace
// inside one must not open or close a block — `@default("}")` is a legal field
// that a naive brace count reads as the end of its model. The comment text is
// returned rather than discarded, because a `//` comment cannot carry a citation
// and this rule reports one written there instead of ignoring it.
func prismaPartsOf(
  line string,
  commented bool,
) (string, string, prismaCommentForm, bool) {
  var code strings.Builder
  var comment strings.Builder
  form := prismaCommentForm("")
  if commented {
    form = prismaBlockComment
  }
  runes := []rune(line)
  quoted := false
  for index := 0; index < len(runes); index++ {
    char := runes[index]
    if commented {
      if char == '*' && index+1 < len(runes) && runes[index+1] == '/' {
        commented = false
        index++
        continue
      }
      comment.WriteRune(char)
      continue
    }
    if quoted {
      if char == '\\' {
        index++
        continue
      }
      if char == '"' {
        quoted = false
      }
      continue
    }
    if char == '"' {
      quoted = true
      continue
    }
    if char == '/' && index+1 < len(runes) && runes[index+1] == '/' {
      // A third slash makes it a doc comment; a fourth is content, which
      // is what Prisma's `(!"///") ~ "//"` lookahead decides.
      rest := index + 2
      if rest < len(runes) && runes[rest] == '/' {
        if form == "" {
          form = prismaDocComment
        }
        rest++
      } else if form == "" {
        form = prismaLineComment
      }
      // One ordinary padding space follows the documentation prefix; further
      // indentation belongs to the body and decides whether a fence is literal.
      comment.WriteString(strings.TrimPrefix(string(runes[rest:]), " "))
      break
    }
    if char == '/' && index+1 < len(runes) && runes[index+1] == '*' {
      commented = true
      if form == "" {
        form = prismaBlockComment
      }
      index++
      continue
    }
    code.WriteRune(char)
  }
  return code.String(), strings.TrimRight(comment.String(), " \t\r"), form, commented
}

// prismaBlockHead reads `model <Name>` from a block opener.
func prismaBlockHead(trimmed string) (string, string, bool) {
  fields := strings.Fields(trimmed)
  if len(fields) < 2 {
    return "", "", false
  }
  if !prismaBlockKeywords[fields[0]] {
    return "", "", false
  }
  name := strings.TrimSuffix(fields[1], "{")
  if !isPrismaIdentifier(name) {
    return "", "", false
  }
  return fields[0], name, true
}

// prismaMemberName reads the field name a member line opens with.
//
// A line opening with `@` is a block attribute such as `@@index([a, b])` rather
// than a field, and a line opening with `}` closes the block. Neither declares
// a member, and both would otherwise be read as one named `@@index` or `}`.
func prismaMemberName(trimmed string) (string, bool) {
  if strings.HasPrefix(trimmed, "@") || strings.HasPrefix(trimmed, "}") {
    return "", false
  }
  fields := strings.Fields(trimmed)
  if len(fields) == 0 {
    return "", false
  }
  if !isPrismaIdentifier(fields[0]) {
    return "", false
  }
  return fields[0], true
}

// isPrismaIdentifier mirrors the grammar's `identifier` rule: unicode
// alphanumeric, then unicode alphanumeric or `_` or `-`. No dot can appear in
// one, which is what lets a member address join on a dot without ambiguity.
func isPrismaIdentifier(value string) bool {
  if value == "" {
    return false
  }
  for index, char := range value {
    switch {
    case unicode.IsLetter(char), unicode.IsDigit(char):
      continue
    case index != 0 && (char == '_' || char == '-'):
      continue
    default:
      return false
    }
  }
  return true
}
