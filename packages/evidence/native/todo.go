package evidence

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// todoRule reports every JSDoc '@todo' tag in a checked file.
//
// A stub enters the world carrying a '@todo' that names what its realization
// still owes, and no other rule ever calls that debt: the graph judges
// citations, `evidence/documented` judges presence, and a block whose only
// content is a '@todo' satisfies both. A remaining tag is therefore an
// unrealized contract shipping as done, so the rule turns each one into a
// finding — the realize ledger, read straight out of the build.
//
// There is no selection to configure. A debt on a local helper is as unrealized
// as one on an export, so every declaration's block is read, and the rule takes
// no options; per-directory scoping belongs in the outer `files` setting of
// `lint.config.ts`, and the host refuses a configured options object on the
// rule's behalf.
type todoRule struct{}

func (todoRule) Name() string { return todoRuleName }

func (todoRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (todoRule) NeedsTypeChecker() bool { return false }

func (todoRule) VisitsDeclarationFiles() bool { return false }

func (todoRule) AcceptsTtscLintOptions() bool { return false }

func (todoRule) Check(ctx *rule.Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  if node.Kind != shimast.KindSourceFile {
    return
  }
  content := ctx.File.Text()
  // One physical block is one ledger entry. TypeScript cascades a leading
  // block onto nested nodes — a variable statement and each of its
  // declarations all answer for one comment — so blocks are deduplicated by
  // position. The walk visits parents before children, which anchors each
  // finding on the outermost declaration the block precedes: the node whose
  // leading trivia the block actually is, and the one `Report` underlines
  // correctly because it skips that trivia.
  seen := map[int]bool{}
  walkTypeScriptNode(node, func(current *shimast.Node) {
    for _, doc := range current.JSDoc(ctx.File) {
      if doc == nil || doc.Pos() < 0 || doc.End() > len(content) {
        continue
      }
      if seen[doc.Pos()] {
        continue
      }
      seen[doc.Pos()] = true
      for _, entry := range todoEntries(content[doc.Pos():doc.End()]) {
        ctx.Report(current, todoMessage(entry))
      }
    }
  })
}

func init() { rule.Register(todoRule{}) }

func todoMessage(entry string) string {
  found := "Unrealized '@todo'"
  if entry != "" {
    found += ": '" + entry + "'"
  }
  return found +
    ". A '@todo' tag names work this declaration still owes, so the contract it promises is not realized yet. Realize the declaration and remove the tag."
}

// todoEntries lists the text of every '@todo' tag one JSDoc block carries.
//
// The scan mirrors the declaration parser's shape: strip the block decoration,
// walk lines, and let any other '@'-opening line close the entry above it, so a
// '@todo' shares a block with '@param' or '@evidence' without swallowing them.
// The tag name matches case-insensitively, because '@TODO' is the same promise
// shouted.
//
// A fenced example is not read for tags, as it is not by the declaration parser:
// a '@todo' shown inside one is documentation of the tag rather than a debt. A
// fence inside an entry's text stays part of it, so the example is not cut out
// of the debt it follows.
func todoEntries(comment string) []string {
  comment = strings.TrimSpace(comment)
  comment = strings.TrimPrefix(comment, "/**")
  comment = strings.TrimPrefix(comment, "/*")
  comment = strings.TrimSuffix(comment, "*/")
  entries := []string{}
  var pending []string
  flush := func() {
    if pending == nil {
      return
    }
    entries = append(entries, strings.TrimSpace(strings.Join(pending, " ")))
    pending = nil
  }
  fence := commentFence{}
  for _, rawLine := range strings.Split(comment, "\n") {
    line := strings.TrimSpace(rawLine)
    line = strings.TrimSpace(strings.TrimPrefix(line, "*"))
    if fence.consume(line) {
      if pending != nil && line != "" {
        pending = append(pending, line)
      }
      continue
    }
    if remainder, opened := todoLine(line); opened {
      flush()
      pending = []string{remainder}
      continue
    }
    if strings.HasPrefix(line, "@") {
      flush()
      continue
    }
    if pending != nil && line != "" {
      pending = append(pending, line)
    }
  }
  flush()
  return entries
}

// todoLine reports whether a line opens a '@todo' tag, and with what remainder.
//
// The boundary check keeps a longer tag out: '@todos' is some other tool's tag,
// not a shouting variant of this one, and matching it would report a debt the
// author never recorded.
func todoLine(line string) (string, bool) {
  const marker = "@todo"
  if len(line) < len(marker) || !strings.EqualFold(line[:len(marker)], marker) {
    return "", false
  }
  remainder := line[len(marker):]
  if remainder != "" && remainder[0] != ' ' && remainder[0] != '\t' {
    return "", false
  }
  return strings.TrimSpace(remainder), true
}
