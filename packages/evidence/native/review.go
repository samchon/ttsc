package evidence

import (
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
  for _, key := range cited.order {
    if reviewed.byKey[key] != nil {
      continue
    }
    unreviewed := cited.byKey[key]
    // The repair names the matching review tag, not a generic one. An exclusion
    // reviewed with `@evidenceReview` stays unreviewed, so telling its author to
    // write that tag would send them into the one mistake this split exists to
    // prevent.
    ctx.Report(
      host.Node,
      "Unreviewed @"+string(unreviewed.tag)+" for '"+displayTarget(unreviewed.target)+"' on "+host.describe()+
        ". "+acknowledgementQuestion(unreviewed.tag)+" Nothing states what was verified. Add '"+
        reviewMarkerFor(unreviewed.tag)+" "+displayTarget(unreviewed.target)+" <what you checked>' to the same documentation block.",
    )
  }
  for _, key := range reviewed.order {
    review := reviewed.byKey[key]
    // A review with no target is malformed and nothing else. Reporting it as
    // an orphan as well would name two repairs for one mistake, and the
    // orphan repair — "correct the target to match a citation" — is the
    // malformed one restated.
    if review.Target == "" {
      ctx.Report(
        host.Node,
        "Malformed "+review.marker()+" on "+host.describe()+
          ": target and non-empty description are mandatory. Write '"+review.marker()+" <target> <what you checked>'.",
      )
      continue
    }
    if review.Description == "" {
      ctx.Report(
        host.Node,
        "Malformed "+review.marker()+" for '"+displayTarget(review.Target)+"' on "+host.describe()+
          ": the target is written and the description is empty, so nothing states what was verified. Write '"+
          review.marker()+" "+displayTarget(review.Target)+" <what you checked>'.",
      )
      continue
    }
    if _, found := cited.byKey[key]; found {
      continue
    }
    // A review whose target is acknowledged by the *other* tag is the mistake
    // worth naming precisely, because the author did the work and filed it under
    // the wrong question. Saying only "this identity cites no such target" would
    // send them looking for a typo that is not there.
    if other, found := cited.byKey[reviewKey(otherTag(review.Reviews), review.Target)]; found {
      ctx.Report(
        host.Node,
        "Mismatched "+review.marker()+" for '"+displayTarget(review.Target)+"' on "+host.describe()+
          ": that target is acknowledged by @"+string(other.tag)+", which "+reviewMarkerFor(other.tag)+
          " answers for, and the two ask different questions. Rewrite this review as '"+reviewMarkerFor(other.tag)+
          " "+displayTarget(review.Target)+" <what you checked>', or add the @"+string(review.Reviews)+
          " it answers for, or remove it. Rewriting is wrong if that review is already written.",
      )
      continue
    }
    ctx.Report(
      host.Node,
      "Orphan "+review.marker()+" for '"+displayTarget(review.Target)+"' on "+host.describe()+
        ": this identity carries no @"+string(review.Reviews)+" for that target, so the review answers nothing. Correct the target, add the acknowledgement it reviews, or remove the review.",
    )
  }
  for _, duplicate := range reviewed.duplicated {
    ctx.Report(
      host.Node,
      "Duplicate "+reviewMarkerFor(duplicate.tag)+" for '"+displayTarget(duplicate.target)+"' on "+host.describe()+
        ": one acknowledgement is verified once. Keep the review that states what was checked and remove the other.",
    )
  }
}

// acknowledgementQuestion is what a review of this tag has to answer.
//
// The two are not the same question and the diagnostic says which one is open. A
// citation is verified by checking that this declaration does what the cited unit
// describes. An exclusion is verified by checking that the unit genuinely does not
// apply here, which no reading of this declaration can establish on its own.
func acknowledgementQuestion(tag tagKind) string {
  if tag == tagExclude {
    return "The exclusion states that this claim does not cover that target."
  }
  return "The citation states why this declaration answers for that target."
}

// reviewMarkerFor names the review tag that answers for one acknowledgement.
func reviewMarkerFor(tag tagKind) string {
  if tag == tagExclude {
    return "@evidenceExcludeReview"
  }
  return "@evidenceReview"
}

// otherTag is the acknowledgement a review was not written for.
func otherTag(tag tagKind) tagKind {
  if tag == tagExclude {
    return tagEvidence
  }
  return tagExclude
}

// reviewKey pairs an acknowledgement kind with a target.
//
// Both halves are the identity. One target may be cited by one claim and excluded
// by another from the same host, and those are two decisions owing two different
// verifications; keying on the target alone would let either review answer both.
// NUL separates them because a target may contain any printable character.
func reviewKey(tag tagKind, target string) string {
  return string(tag) + "\x00" + target
}

// acknowledgement is one tag-and-target pair a host wrote.
type acknowledgement struct {
  tag    tagKind
  target string
}

// citedTargets is the acknowledgement set of one identity, in written order.
//
// Order is the author's rather than a map's, because two findings on one host
// are read as a list and a list that reorders between runs cannot be diffed.
//
// The key pairs the tag with the target rather than being the target alone. One
// target may be cited by one claim and excluded by another from the same host, and
// those are two decisions owing two different verifications.
type citedTargets struct {
  order []string
  byKey map[string]acknowledgement
}

// reviewedTargets is the review set of one identity, keyed the same way.
//
// Duplicates are collected rather than overwritten. One acknowledgement is
// verified once, and a second review of it is a finding: either the author
// reviewed the same thing twice, or two different verifications are competing and
// only one survives into whatever a later reader trusts.
type reviewedTargets struct {
  order      []string
  byKey      map[string]*parsedReview
  duplicated []acknowledgement
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
  cited := citedTargets{byKey: map[string]acknowledgement{}}
  reviewed := reviewedTargets{byKey: map[string]*parsedReview{}}
  content := file.Text()
  seen := map[int]bool{}
  // Already in source order. `orderIdentityDeclarations` sorts every identity's
  // declarations by position and dereferences `Pos()` to do it, so a nil node
  // would have panicked there long before this rule saw the host. Re-sorting here
  // asserted the opposite: its comparator called a nil pair both less than and
  // not less than each other, which is not an ordering, and the guard it existed
  // for could never fire.
  nodes := host.Nodes
  if len(nodes) == 0 {
    nodes = []*shimast.Node{host.Node}
  }
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
        key := reviewKey(declaration.Tag, declaration.Target)
        if _, found := cited.byKey[key]; !found {
          cited.order = append(cited.order, key)
          cited.byKey[key] = acknowledgement{
            tag:    declaration.Tag,
            target: declaration.Target,
          }
        }
      }
      // Reset per block, because that is the scope a duplicate lives in.
      seenReviewBlocks := map[string]bool{}
      for _, review := range parseReviews(comment) {
        if review.Target == "" {
          // A review with no target at all is reported against the identity
          // rather than against a target nobody wrote.
          recordTargetlessReview(&reviewed, review.Reviews)
          continue
        }
        key := reviewKey(review.Reviews, review.Target)
        // A duplicate is two reviews in one block, not one review on each
        // declaration of an identity. An overload set and an `interface` beside
        // its `namespace` are normally written by copying the block, so each
        // half carries the same citation and the same review; counting across
        // blocks reported that idiom as a duplicate while every citation was in
        // fact reviewed exactly once. Citations are already deduplicated across
        // blocks the same way, and the asymmetry was the whole defect.
        if seenReviewBlocks[key] {
          reviewed.duplicated = appendUniqueAcknowledgement(
            reviewed.duplicated,
            acknowledgement{tag: review.Reviews, target: review.Target},
          )
          continue
        }
        seenReviewBlocks[key] = true
        if _, found := reviewed.byKey[key]; found {
          continue
        }
        stored := review
        reviewed.order = append(reviewed.order, key)
        reviewed.byKey[key] = &stored
      }
    }
  }
  return cited, reviewed
}

// recordTargetlessReview records a review whose body held no target.
//
// It is filed under the empty target so the judging pass reports it through the
// same walk as every other review, instead of this collector growing a second
// reporting path that has to be kept in step with the first. Filing it once per
// kind is deliberate: two empty tags of one kind are one mistake with one repair,
// while an empty citation review and an empty exclusion review are two mistakes
// whose repairs name different tags.
func recordTargetlessReview(reviewed *reviewedTargets, reviews tagKind) {
  key := reviewKey(reviews, "")
  if _, found := reviewed.byKey[key]; found {
    return
  }
  reviewed.order = append(reviewed.order, key)
  reviewed.byKey[key] = &parsedReview{Reviews: reviews}
}

// appendUniqueAcknowledgement keeps one entry per tag-and-target pair.
func appendUniqueAcknowledgement(
  values []acknowledgement,
  candidate acknowledgement,
) []acknowledgement {
  for _, value := range values {
    if value == candidate {
      return values
    }
  }
  return append(values, candidate)
}
