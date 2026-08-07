package evidence

import (
  "sort"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// reviewRule requires a verification statement beside every citation.
//
// `evidence/graph` proves that a target resolves, that its host is eligible, and
// that every selected unit is acknowledged. All three are properties of the
// graph as it stands, so none of them records that anyone read the cited unit
// and compared it against the citing declaration. An author writes one prose
// reason answering why this declaration answers for that target, and is never
// asked what they actually checked. Those are different questions, and a
// fabricated citation clears the second one as easily as the first because the
// second one is never put.
//
// The rule puts it. Every `@evidence` and `@evidenceExclude` on a public
// identity must be answered by an `@evidenceReview` naming the same target, so a
// citation cannot be produced without a separately addressed statement written
// as its own act.
//
// What it does not do is judge whether that statement is sincere. The project's
// own rule forbids it: a rule guessing at prose teaches authors to write filler
// that passes. What expires a review when the cited content moves is the
// fingerprint `evidence/graph` validates under `requireReview`; this rule
// carries the token without interpreting it, so a project can adopt the
// discipline before it adopts the expiry.
type reviewRule struct{}

func (reviewRule) Name() string { return reviewRuleName }

func (reviewRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (reviewRule) NeedsTypeChecker() bool { return false }

func (reviewRule) VisitsDeclarationFiles() bool { return false }

// AcceptsTtscLintOptions refuses an options slot.
//
// The marker is mandatory rather than decorative: `rule.OptionsRule` documents
// that a contributor rule defaults to *accepting* options, so an unimplemented
// marker would let this rule take a configuration object it never validates.
// There is nothing to select here — a citation on any public identity owes a
// review — and per-directory scoping belongs in the outer `files` setting.
func (reviewRule) AcceptsTtscLintOptions() bool { return false }

func (reviewRule) Check(ctx *rule.Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  if node.Kind != shimast.KindSourceFile {
    return
  }
  for _, host := range documentedHosts(ctx.File) {
    judgeReviewedHost(ctx, host)
  }
}

func init() { rule.Register(reviewRule{}) }

// judgeReviewedHost pairs one identity's citations against its reviews.
//
// The unit judged is an identity rather than a declaration, which is the
// boundary `evidence/documented` already uses and the one the graph judges
// citations on: a merged identity is one host, so a citation may sit on any of
// its declarations and so may the review that answers it. Judging declarations
// instead would demand a review on the half that happens to carry the tag,
// which is placement the graph itself calls not worth a diagnostic.
func judgeReviewedHost(ctx *rule.Context, host documentedHost) {
  cited, reviewed := readHostTags(ctx.File, host)
  for _, target := range cited.order {
    if reviewed.byTarget[target] != nil {
      continue
    }
    ctx.Report(
      host.Node,
      "Unreviewed @"+string(cited.byTarget[target])+" for '"+displayTarget(target)+"' on "+host.describe()+
        ". The citation states why this declaration answers for that target, and nothing states what was verified. Add '@evidenceReview "+displayTarget(target)+" <what you checked>' to the same documentation block.",
    )
  }
  for _, target := range reviewed.order {
    review := reviewed.byTarget[target]
    // A review with no target is malformed and nothing else. Reporting it as
    // an orphan as well would name two repairs for one mistake, and the
    // orphan repair — "correct the target to match a citation" — is the
    // malformed one restated.
    if target == "" {
      ctx.Report(
        host.Node,
        "Malformed @evidenceReview on "+host.describe()+
          ": target and non-empty description are mandatory. Write '@evidenceReview <target> <what you checked>'.",
      )
      continue
    }
    if review.Description == "" {
      ctx.Report(
        host.Node,
        "Malformed @evidenceReview for '"+displayTarget(target)+"' on "+host.describe()+
          ": the target is written and the description is empty, so nothing states what was verified. Write '@evidenceReview "+displayTarget(target)+" <what you checked>'.",
      )
      continue
    }
    if _, found := cited.byTarget[target]; found {
      continue
    }
    ctx.Report(
      host.Node,
      "Orphan @evidenceReview for '"+displayTarget(target)+"' on "+host.describe()+
        ": this identity cites no such target, so the review answers nothing. Correct the target to match a citation on this declaration, add the '@evidence' it reviews, or remove the review.",
    )
  }
  for _, target := range reviewed.duplicated {
    ctx.Report(
      host.Node,
      "Duplicate @evidenceReview for '"+displayTarget(target)+"' on "+host.describe()+
        ": one citation is verified once. Keep the review that states what was checked and remove the other.",
    )
  }
}

// citedTargets is the citation set of one identity, in the order it was written.
//
// Order is the author's rather than a map's, because two findings on one host
// are read as a list and a list that reorders between runs cannot be diffed. The
// tag kind is kept so the repair names the tag the author actually wrote.
type citedTargets struct {
  order    []string
  byTarget map[string]tagKind
}

// reviewedTargets is the review set of one identity.
//
// Duplicates are collected rather than overwritten. One citation is verified
// once, and a second review of it is a finding: either the author reviewed the
// same thing twice, or two different verifications are competing and only one
// survives into whatever a later reader trusts.
type reviewedTargets struct {
  order      []string
  byTarget   map[string]*parsedReview
  duplicated []string
}

// readHostTags collects the citations and reviews of one identity.
//
// Every declaration of the identity is read, not only the first. A merged
// identity's citation may sit on any of them, so a review restricted to the
// founding declaration would report a missing review for a citation that is
// answered two lines away.
//
// Blocks are deduplicated by position because TypeScript cascades one leading
// block onto nested nodes: a variable statement and each of its declarations all
// report the same comment, and reading it three times would turn one review into
// two duplicates of itself.
func readHostTags(
  file *shimast.SourceFile,
  host documentedHost,
) (citedTargets, reviewedTargets) {
  cited := citedTargets{byTarget: map[string]tagKind{}}
  reviewed := reviewedTargets{byTarget: map[string]*parsedReview{}}
  content := file.Text()
  seen := map[int]bool{}
  nodes := append([]*shimast.Node{}, host.Nodes...)
  if len(nodes) == 0 {
    nodes = append(nodes, host.Node)
  }
  sort.SliceStable(nodes, func(left int, right int) bool {
    if nodes[left] == nil || nodes[right] == nil {
      return nodes[right] == nil
    }
    return nodes[left].Pos() < nodes[right].Pos()
  })
  for _, node := range nodes {
    if node == nil {
      continue
    }
    for _, doc := range node.JSDoc(file) {
      if doc == nil || doc.Pos() < 0 || doc.End() > len(content) {
        continue
      }
      if seen[doc.Pos()] {
        continue
      }
      seen[doc.Pos()] = true
      comment := content[doc.Pos():doc.End()]
      for _, declaration := range parseDeclarations(comment) {
        // A malformed citation is the graph's finding, and it names a repair
        // this rule cannot: without a target there is nothing for a review to
        // be addressed to. Demanding one here would report a second finding
        // whose repair the first one has to be performed before.
        if declaration.Target == "" {
          continue
        }
        if _, found := cited.byTarget[declaration.Target]; !found {
          cited.order = append(cited.order, declaration.Target)
          cited.byTarget[declaration.Target] = declaration.Tag
        }
      }
      for _, review := range parseReviews(comment) {
        if review.Target == "" {
          // A review with no target at all is reported against the identity
          // rather than against a target nobody wrote.
          recordTargetlessReview(&reviewed)
          continue
        }
        if _, found := reviewed.byTarget[review.Target]; found {
          reviewed.duplicated = appendUniqueString(reviewed.duplicated, review.Target)
          continue
        }
        stored := review
        reviewed.order = append(reviewed.order, review.Target)
        reviewed.byTarget[review.Target] = &stored
      }
    }
  }
  return cited, reviewed
}

// recordTargetlessReview records a review whose body held no target.
//
// It is filed under the empty target so the judging pass reports it through the
// same walk as every other review, instead of this collector growing a second
// reporting path that has to be kept in step with the first. Filing it once is
// deliberate: two empty review tags on one host are one mistake with one repair.
func recordTargetlessReview(reviewed *reviewedTargets) {
  if _, found := reviewed.byTarget[""]; found {
    return
  }
  reviewed.order = append(reviewed.order, "")
  reviewed.byTarget[""] = &parsedReview{}
}
