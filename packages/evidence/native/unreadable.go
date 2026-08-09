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
    " Move it into a documentation block written directly above a declaration the claim selects."
}

// spanIsAttached reports whether a comment is one the parser handed to a node.
//
// Containment rather than equality, because a documentation block's reported
// span may open before the comment token does when the parser folds a preceding
// run into it. A comment inside an attached block is that block's text and is
// read with it.
func spanIsAttached(attached []commentSpan, span commentSpan) bool {
  for _, current := range attached {
    if current.Start > span.Start {
      break
    }
    if current.End >= span.End {
      return true
    }
  }
  return false
}

// readableCommentBody strips the syntax a comment opens with, so a line that
// carries a tag is recognized by the same reader every other comment goes
// through.
//
// The declaration parser already removes `/**`, `/*`, a leading `*`, and `///`,
// because those are the shapes a readable block takes. It does not remove `//`,
// and it must not learn to: a documentation block's line never opens that way,
// and teaching the shared parser to accept one would let a `//` line inside a
// block declare something the graph then reads from an unreadable position.
func readableCommentBody(comment string) string {
  lines := strings.Split(comment, "\n")
  for index, line := range lines {
    trimmed := strings.TrimSpace(line)
    if !strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "///") {
      continue
    }
    lines[index] = strings.TrimPrefix(trimmed, "//")
  }
  return strings.Join(lines, "\n")
}

// unreadableTypeScriptTags collects every unreadable tag the scanned TypeScript
// populations found, once per file.
//
// One file reached through two configured roots is two inventories of the same
// text, and one comment nobody can read is one defect. Deduplicating by the
// worded diagnostic keys on the position and the tag, which is what the author
// has to go and fix.
func unreadableTypeScriptTags(
  inventories map[string]*artifactInventory,
) []string {
  seen := map[string]bool{}
  reported := []string{}
  for _, inventory := range inventories {
    if inventory == nil {
      continue
    }
    for _, problem := range inventory.Unreadable {
      if seen[problem] {
        continue
      }
      seen[problem] = true
      reported = append(reported, problem)
    }
  }
  sort.Strings(reported)
  return reported
}
