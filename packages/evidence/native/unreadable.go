package evidence

import (
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// attachedCommentEnds indexes, by end offset, where each attached documentation
// block's own text begins.
//
// The end is what identifies a comment: the parser stops reading one exactly
// where the scanner does. A block's reported start is not, because it is a full
// start, and a full start reaches back to the previous token and swallows every
// blank line and every comment between. Testing containment against that made
// the reporter answer differently depending on what followed a tag, so a
// citation in a `//` comment was reported above an undocumented declaration and
// silent above a documented one, which is the shape an author is most likely to
// write in a codebase that documents its exports.
type attachedCommentEnds map[int]int

// holds reports whether a comment is one the parser handed to a node.
func (ends attachedCommentEnds) holds(start int, end int) bool {
  attachedStart, taken := ends[end]
  return taken && attachedStart <= start
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
// destructuring pattern is read by nobody; a `//` comment is not documentation
// at all, which is one keystroke from a block that is; and a documented
// declaration an author commented out keeps a citation that now proves nothing.
func reportUnreadableTypeScriptTags(
  file *shimast.SourceFile,
  location string,
  attached attachedCommentEnds,
  inventory *artifactInventory,
) {
  if file == nil || inventory == nil {
    return
  }
  content := file.Text()
  astutil.ForEachComment(file, func(_ shimast.Kind, start int, end int) {
    if start < 0 || end > len(content) || start >= end {
      return
    }
    if attached.holds(start, end) {
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

// unreadableTagProblem names the position and the moves that fix it, which is
// the whole value of reporting a tag nothing can read.
//
// Two moves rather than one, because the tag reaches nothing for two different
// reasons. A citation an author meant to keep belongs in a documentation block
// on a declaration; one left behind in code that is commented out belongs
// nowhere, and naming only the first would send that author to move a tag they
// should be deleting.
func unreadableTagProblem(tag string, location string, line int) string {
  return "Unreadable " + tag + " at " + location + ":" + decimal(line) +
    ": the parser attaches this comment to no declaration, so nothing reads the tag." +
    " Move it into a documentation block written directly above the declaration it answers for," +
    " or delete it with the code it was written against."
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
func readableCommentBody(comment string) string {
  lines := strings.Split(comment, "\n")
  for index, line := range lines {
    trimmed := strings.TrimSpace(line)
    if !strings.HasPrefix(trimmed, "//") {
      continue
    }
    lines[index] = strings.TrimSpace(strings.TrimLeft(trimmed, "/"))
  }
  return strings.Join(lines, "\n")
}

// unreadableTypeScriptTags collects every unreadable tag the scanned TypeScript
// populations found.
//
// One file reached through two configured roots is two inventories of the same
// text, so the same comment is found twice. The graph's own reporter sorts and
// drops exact duplicates, which is what collapses them; this only has to gather
// them in a defined order so its input does not depend on map iteration.
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
