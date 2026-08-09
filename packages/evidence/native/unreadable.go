package evidence

import (
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// commentSpan is one comment's byte range in a source file.
type commentSpan struct {
  Start int
  End   int
}

// reportUnreadableTypeScriptTags records every tag written in a comment the
// parser attached to no declaration.
//
// The graph reads tags only from the blocks a node reports, which is what keeps
// a citation, the host it lands on, and the exclusion that must cut it out of a
// digest all naming the same position. A comment the parser attached to nothing
// is outside that agreement: no node reports it, so the tag in it reaches no
// host and is not excluded from anything either.
//
// Discarding it silently is the failure this rule exists to remove. The comment
// is real, the file keeps it, and an author reading the source sees a citation
// that does nothing while the coverage diagnostic that follows names the
// reference and suggests writing the citation they already wrote.
//
// The shapes are ordinary rather than exotic. TypeScript attaches no
// documentation to a binding element, so a block between the braces of a
// destructuring pattern reaches nothing; and a `//` comment is not documentation
// at all, which is one keystroke from a block that is.
func reportUnreadableTypeScriptTags(
  file *shimast.SourceFile,
  location string,
  attached []commentSpan,
  inventory *artifactInventory,
) {
  if file == nil || inventory == nil {
    return
  }
  sort.Slice(attached, func(left int, right int) bool {
    return attached[left].Start < attached[right].Start
  })
  content := file.Text()
  astutil.ForEachComment(file, func(_ shimast.Kind, start int, end int) {
    if start < 0 || end > len(content) || start >= end {
      return
    }
    if spanIsAttached(attached, commentSpan{Start: start, End: end}) {
      return
    }
    body := readableCommentBody(content[start:end])
    baseLine := lineAt(content, start)
    for _, parsed := range parseDeclarations(body) {
      inventory.Unreadable = append(inventory.Unreadable, unreadableTagProblem(
        "@"+string(parsed.Tag),
        location,
        baseLine+parsed.LineOffset,
      ))
    }
    for _, review := range parseReviews(body) {
      inventory.Unreadable = append(inventory.Unreadable, unreadableTagProblem(
        review.marker(),
        location,
        baseLine+review.LineOffset,
      ))
    }
  })
}

// unreadableTagProblem names the position and the move that fixes it, which is
// the whole value of reporting a tag nothing can read.
func unreadableTagProblem(tag string, location string, line int) string {
  return "Unreadable " + tag + " at " + location + ":" + decimal(line) +
    ": the parser attaches this comment to no declaration, so nothing reads the tag." +
    " Move it into a documentation block written directly above a selected declaration."
}

// spanIsAttached reports whether a comment is one the parser handed to a node.
//
// A documentation node's reported start is its full start, which is where the
// previous token ended, so its span swallows every blank line and every comment
// between that token and the block itself. Testing containment against it made
// the reporter answer differently depending on what followed the tag: a
// citation in a `//` comment was reported above an undocumented declaration and
// silent above a documented one, which is the shape an author is most likely to
// write and the only one that matters in a codebase that documents its exports.
//
// The comparison is therefore against where the block's own text begins.
// Equality on the end is enough to identify it, because the end of a comment is
// where the parser stopped reading it.
func spanIsAttached(attached []commentSpan, span commentSpan) bool {
  for _, current := range attached {
    if current.End == span.End && current.Start <= span.Start {
      return true
    }
  }
  return false
}

// readableCommentBody strips the syntax a comment opens with, so a line that
// carries a tag is recognized by the same reader every other comment goes
// through.
//
// The declaration parser removes `/**`, `/*`, and a leading `*`, because those
// are the shapes a readable block takes. It does not remove a run of slashes,
// and it must not learn to: a documentation block's line never opens that way,
// and teaching the shared parser to accept one would let a `//` line inside a
// block declare something the graph then reads from an unreadable position.
//
// Every run of two or more slashes comes off, so a tag buried behind a third or
// a fourth is answered like one behind two. They are unreadable for one reason
// and by one keystroke, and answering only some of them split one comment
// against itself: the review parser removes `///` and the declaration parser
// does not, so `/// @evidenceReview` was reported while the `/// @evidence`
// beside it stayed silent.
//
// A line whose text still opens like a documentation block once the slashes are
// off belongs to commented-out code. The tag in it is unreadable, and saying so
// would name a repair that is wrong for it: the author's move is to delete the
// block or restore what it documented, not to put the tag somewhere selected.
func readableCommentBody(comment string) string {
  lines := strings.Split(comment, "\n")
  for index, line := range lines {
    trimmed := strings.TrimSpace(line)
    if !strings.HasPrefix(trimmed, "//") {
      continue
    }
    stripped := strings.TrimSpace(strings.TrimLeft(trimmed, "/"))
    if strings.HasPrefix(stripped, "/*") || strings.HasPrefix(stripped, "*") {
      return ""
    }
    lines[index] = stripped
  }
  return strings.Join(lines, "\n")
}

// unreadableTypeScriptTags collects every unreadable tag the scanned TypeScript
// populations found.
//
// One file reached through two configured roots is two inventories of the same
// text, so the same comment is found twice. The graph's own reporter sorts and
// drops exact duplicates, which is what collapses them, and this only has to
// gather them in a defined order so that reporter's input does not depend on
// map iteration.
func unreadableTypeScriptTags(
  inventories map[string]*artifactInventory,
) []string {
  reported := []string{}
  for _, inventory := range inventories {
    if inventory == nil {
      continue
    }
    reported = append(reported, inventory.Unreadable...)
  }
  sort.Strings(reported)
  return reported
}
