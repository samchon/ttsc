package evidence

import (
  "strings"
  "unicode"
)

type parsedDeclaration struct {
  Tag        tagKind
  Target     string
  Reason     string
  LineOffset int
}

func parseDeclarations(comment string) []parsedDeclaration {
  return parseCommentDeclarations(comment, false)
}

// hiddenDeclarationTags are the documentation tags that withdraw a declaration
// from the public surface. They are equivalent here: each one is a statement
// that the declaration is not API, and the graph has no reason to grade the
// three against each other.
var hiddenDeclarationTags = []string{"@internal", "@hidden", "@ignore"}

// commentHidingTag returns the tag by which a documentation comment withdraws
// its declaration, or an empty string.
//
// The tag has to open its own line, the way every other tag in these comments
// is recognized. A prose line mentioning `@internal` is describing something,
// not declaring it, and treating a substring match as a declaration would let a
// sentence silently delete an obligation. Text after the tag is a comment for
// humans and is not read.
func commentHidingTag(comment string) string {
  body, _, _ := documentationCommentBody(comment)
  for _, region := range documentationRegions(body, true) {
    if region.fence {
      continue
    }
    line := region.text
    for _, tag := range hiddenDeclarationTags {
      if line != tag && !strings.HasPrefix(line, tag+" ") {
        continue
      }
      return tag
    }
  }
  return ""
}

// parseCommentDeclarations reads every declaration one comment body carries.
//
// tagBoundaries decides whether a line opening with some other `@tag` ends the
// declaration above it. A JSDoc block sets it by its own syntax, and a Prisma
// doc comment needs it set for the same reason without carrying that syntax:
// `///` comments routinely hold `@stance`, `@namespace`, and other tools' tags,
// and without a boundary the first of them is swallowed into the reason of the
// citation above it.
func parseCommentDeclarations(
  comment string,
  tagBoundaries bool,
) []parsedDeclaration {
  body, leadingLines, documented := documentationCommentBody(comment)
  return parseRegionDeclarations(
    documentationRegions(body, false),
    documented || tagBoundaries,
    leadingLines,
  )
}

// parseRegionDeclarations reads the citations and exclusions of documentation
// lines whose examples are already classified.
//
// It owns the annotation grammar independently of where the lines came from, so
// every host that can spell an annotation agrees on where one begins, what it
// says and where it ends. tagBoundaries has the meaning documented on
// parseCommentDeclarations.
func parseRegionDeclarations(
  regions []documentationRegionLine,
  tagBoundaries bool,
  leadingLines int,
) []parsedDeclaration {
  var pending *pendingAnnotation
  parsed := []parsedDeclaration{}
  flush := func() {
    if pending == nil {
      return
    }
    target, reason := pending.split()
    parsed = append(parsed, parsedDeclaration{
      Tag:        pending.opener.tag,
      Target:     target,
      Reason:     reason,
      LineOffset: leadingLines + pending.lineOffset,
    })
    pending = nil
  }
  for index, region := range regions {
    if region.fence {
      // An example never supplies prose. A line-form annotation ends at it; a
      // heading section resumes after it, because headings rather than examples
      // decide where a section ends.
      if !pending.section() {
        flush()
      }
      continue
    }
    if opener, opened := region.opener(); opened {
      flush()
      // A review closes the declaration above it in every host, and it does so
      // regardless of tagBoundaries. That flag answers whether *another tool's*
      // `@tag` is a boundary, which is a property of the host's comment grammar:
      // an HTML comment has no field syntax, so `@architecture approved this` is
      // ordinary prose belonging to the reason above it, and a test pins that.
      //
      // A review is not another tool's tag. It belongs to this grammar, so it is
      // always a boundary. Without this, an `@evidenceReview` written under an
      // `@evidence` inside one Markdown comment was swallowed into that citation's
      // reason: the review vanished and the reason grew a sentence its author
      // addressed to a different question.
      if !opener.review {
        pending = &pendingAnnotation{opener: opener, lineOffset: index}
      }
      continue
    }
    if pending.closedBy(region) {
      flush()
      continue
    }
    if tagBoundaries && region.opensTagBoundary() {
      flush()
      continue
    }
    if pending != nil {
      pending.lines = append(pending.lines, region.text)
    }
  }
  flush()
  return parsed
}

// annotationOpener is the start of one annotation as a documentation line
// spells it.
//
// The line form opens with the tag itself. The heading form is an H2, H3 or H4
// heading whose title opens with the tag, and it exists for explanations long
// enough to need paragraphs, lists and subheadings of their own.
type annotationOpener struct {
  // review reports a verification statement rather than an acknowledgement.
  review bool

  // tag is the acknowledgement kind, or for a review the kind it answers for.
  tag tagKind

  // body is what follows the tag on the opening line: the target, and any
  // reason or review remainder written beside it.
  body string

  // heading is the depth of a heading-form opener, or zero for the line form.
  heading int
}

// openAnnotation reads the annotation one documentation line opens, if any.
//
// A heading of another depth stays an ordinary heading, and no heading opens
// the line form because its first character is `#`. The five tags share one
// spelling in both forms, so the two forms cannot disagree about which tag a
// line carries: the title of a heading is read by the same matchers as a line.
func openAnnotation(text string, heading int, title string) (annotationOpener, bool) {
  if heading != 0 {
    if heading < 2 || heading > 4 {
      return annotationOpener{}, false
    }
    text = title
  }
  if tag, body, found := declarationLine(text); found {
    return annotationOpener{tag: tag, body: body, heading: heading}, true
  }
  if reviews, remainder, opened := reviewLine(text); opened {
    return annotationOpener{review: true, tag: reviews, body: remainder, heading: heading}, true
  }
  return annotationOpener{}, false
}

// opensAcknowledgement reports whether a documentation line opens a citation
// or an exclusion in either form, for a caller that reports a tag it cannot
// read and so needs only to know that one is there.
func opensAcknowledgement(text string, heading int, title string) bool {
  opener, opened := openAnnotation(text, heading, title)
  return opened && !opener.review
}

// pendingAnnotation accumulates one annotation until a boundary ends it.
type pendingAnnotation struct {
  opener annotationOpener

  // lines are the documentation lines after the opener that continue it.
  lines []string

  // lineOffset is the opener's line within the documentation body.
  lineOffset int
}

// section reports whether this is a heading-form annotation. A nil receiver is
// no annotation at all.
func (pending *pendingAnnotation) section() bool {
  return pending != nil && pending.opener.heading != 0
}

// closedBy reports whether a heading ends this annotation's explanation.
//
// Only a heading section has that structure. A heading of its own depth or
// shallower is the next part of the surrounding document; a deeper heading
// divides the explanation itself and stays inside it. A line-form annotation
// keeps the continuation it always had, which a heading does not end.
func (pending *pendingAnnotation) closedBy(region documentationRegionLine) bool {
  return pending.section() && region.heading != 0 && region.heading <= pending.opener.heading
}

// split returns the annotation's target and the text after it.
//
// A line-form target may be written on the line after its tag, so its lines
// are split as one body, as they always were. A heading section's target must
// be on the heading: the heading body is split alone, which keeps the
// explanation from ever becoming a target and keeps an unterminated link on the
// heading from borrowing a closing brace from the prose under it.
func (pending *pendingAnnotation) split() (string, string) {
  if !pending.section() {
    return splitDeclarationBody(strings.Join(append([]string{pending.opener.body}, pending.lines...), "\n"))
  }
  target, remainder := splitDeclarationBody(pending.opener.body)
  return target, strings.TrimSpace(strings.Join(append([]string{remainder}, pending.lines...), "\n"))
}

func declarationLine(line string) (tagKind, string, bool) {
  for _, candidate := range []struct {
    marker string
    tag    tagKind
  }{
    {marker: "@evidenceExclude", tag: tagExclude},
    {marker: "@evidence", tag: tagEvidence},
    {marker: "@link", tag: tagEvidence},
  } {
    if !strings.HasPrefix(line, candidate.marker) {
      continue
    }
    remainder := line[len(candidate.marker):]
    if remainder != "" && remainder[0] != ' ' && remainder[0] != '\t' {
      continue
    }
    body := strings.TrimSpace(remainder)
    if candidate.marker == "@link" {
      body = fileLinkPrefix + body
    }
    return candidate.tag, body, true
  }
  return "", "", false
}

// inlineLinkTags are the JSDoc inline link forms a TypeScript target may use.
//
// TypeScript resolves the name inside one of these and counts it as a use,
// which is the only reason a citation-only import survives `noUnusedLocals`.
// No other tag earns that, so no other tag may open a target.
var inlineLinkTags = []string{"{@linkcode", "{@linkplain", "{@link"}

func splitDeclarationBody(body string) (string, string) {
  body = strings.TrimSpace(body)
  if body == "" {
    return "", ""
  }
  if target, reason, found := splitFileLinkBody(body); found {
    return target, reason
  }
  if target, reason, found := splitInlineLinkBody(body); found {
    return target, reason
  }
  for index, char := range body {
    if unicode.IsSpace(char) {
      return body[:index], strings.TrimSpace(body[index:])
    }
  }
  return body, ""
}

// splitInlineLinkBody consumes a braced target through its closing brace.
//
// The brace supplies the boundary a whitespace-delimited token cannot, so the
// grammar stays self-discriminating: the parser decides which resolver applies
// from the token alone, with no reference context. That is what keeps the
// `POST /members` hazard from recurring in a new form.
func splitInlineLinkBody(body string) (string, string, bool) {
  marker := ""
  for _, candidate := range inlineLinkTags {
    if strings.HasPrefix(body, candidate) {
      marker = candidate
      break
    }
  }
  if marker == "" {
    return "", "", false
  }
  closing := strings.IndexByte(body, '}')
  if closing < 0 {
    // An unterminated link is a malformed declaration rather than a plain
    // token: reporting it as the target `{@link` would name a repair the
    // author cannot make.
    return "", "", false
  }
  inner := strings.TrimSpace(body[len(marker):closing])
  reason := strings.TrimSpace(body[closing+1:])
  if inner == "" || containsWhitespace(inner) {
    return "", "", false
  }
  return inlineLinkPrefix + inner, reason, true
}

// inlineLinkPrefix marks a parsed target as import-scope resolved.
//
// Carrying the discrimination in the value keeps every downstream consumer —
// resolution, diagnostics, duplicate detection — reading one field instead of
// re-parsing the comment to recover what the parser already knew.
const inlineLinkPrefix = "\x00link:"

func isInlineLinkTarget(target string) bool {
  return strings.HasPrefix(target, inlineLinkPrefix)
}

func inlineLinkTarget(target string) string {
  return strings.TrimPrefix(target, inlineLinkPrefix)
}

// displayTarget renders a target the way its author wrote it.
func displayTarget(target string) string {
  if isFileLinkTarget(target) {
    return strings.TrimPrefix(target, fileLinkPrefix)
  }
  if isInlineLinkTarget(target) {
    return "{@link " + inlineLinkTarget(target) + "}"
  }
  return target
}

func normalizeMarkdownTarget(target string) string {
  target = strings.ReplaceAll(target, "\\", "/")
  for strings.HasPrefix(target, "./") {
    target = strings.TrimPrefix(target, "./")
  }
  return target
}

// reviewMarkers open a verification statement, one per acknowledgement tag.
//
// There are two because the two acknowledgements answer opposite questions and
// so do their reviews. Verifying an `@evidence` means checking that this
// declaration does what the cited unit describes. Verifying an
// `@evidenceExclude` means checking that the unit genuinely does not apply here,
// which no amount of reading the code can establish and no coverage number can.
// One tag for both would leave a reader unable to tell which question was
// answered without finding the sibling tag first, and would let a review of the
// easier question discharge the harder one.
//
// Order is longest marker first, the way `declarationLine` orders its own, so a
// prefix never shadows a longer tag. The whitespace boundary keeps the four
// apart on its own — `@evidenceExcludeReview` reaching the `@evidenceExclude`
// arm is refused exactly as `@evidenceReview` reaching `@evidence` is — but the
// ordering means that guard is a second line of defense rather than the only one.
var reviewMarkers = []struct {
  marker string
  tag    tagKind
}{
  {marker: "@evidenceExcludeReview", tag: tagExclude},
  {marker: "@evidenceReview", tag: tagEvidence},
}

// reviewFingerprintLength is how many hex characters a fingerprint presents.
//
// Seven is a staleness detector's length, not a security boundary's. A
// collision costs one review that failed to expire, while the tag stays short
// enough that an author reads the target beside it instead of scrolling past a
// full digest.
const reviewFingerprintLength = 7

// parsedReview is one verification statement read out of a comment.
//
// It is deliberately not a `parsedDeclaration`, and the separation is the whole
// safety property rather than a matter of taste. Every acknowledgement map in
// `evaluateEvidenceGraph` consumes the declarations of a claim, so a review
// arriving as a third `tagKind` would discharge coverage, count as a semantic
// host under `uniqueEvidence`, count as a cited unit under
// `singleEvidencePerSymbol`, and conflict with an exclusion of the same scope.
// Each of those is a build turning green because a review was mistaken for
// evidence. A distinct type cannot reach any of them by construction; a shared
// type could only be kept out by remembering to, at every one of six sites.
type parsedReview struct {
  // Reviews names which acknowledgement this review answers for, so a review of
  // an exclusion can never discharge a citation's obligation or the reverse.
  Reviews     tagKind
  Target      string
  Fingerprint string
  Description string
  LineOffset  int
}

// marker spells the tag this review was written as, for a diagnostic that has to
// name the repair rather than describe it.
func (review parsedReview) marker() string {
  return reviewMarkerFor(review.Reviews)
}

// parseReviews reads every verification statement one comment carries.
//
// `declarationLine` needs no change to keep these out of the declaration
// stream, and that is worth stating because it looks like an omission. It
// matches `@evidence` only when the next character is whitespace, so
// `@evidenceReview` falls through its loop exactly as `@evidenceExclude`
// reaching the `@evidence` arm does. The marker namespace was already reserved.
//
// The scan is independent for the same reason `todoEntries` is: one tag, one
// pass, no shared state with the parser whose output must never contain it. Any
// other `@`-opening line closes the review above it, so a review sharing a
// block with `@param` or a following `@evidence` swallows neither.
func parseReviews(comment string) []parsedReview {
  comment, leadingLines, _ := documentationCommentBody(comment)
  return parseRegionReviews(documentationRegions(comment, true), leadingLines)
}

// parseRegionReviews reads the reviews of documentation lines whose examples
// are already classified, under the grammar parseRegionDeclarations applies to
// acknowledgements. A heading-form review may carry its fingerprint on the
// heading or open its description with it.
func parseRegionReviews(regions []documentationRegionLine, leadingLines int) []parsedReview {
  reviews := []parsedReview{}
  var pending *pendingAnnotation
  flush := func() {
    if pending == nil {
      return
    }
    target, remainder := pending.split()
    fingerprint, description := splitReviewFingerprint(remainder)
    reviews = append(reviews, parsedReview{
      Reviews:     pending.opener.tag,
      Target:      target,
      Fingerprint: fingerprint,
      Description: description,
      LineOffset:  leadingLines + pending.lineOffset,
    })
    pending = nil
  }
  for index, region := range regions {
    if region.fence {
      if !pending.section() {
        flush()
      }
      continue
    }
    if opener, opened := region.opener(); opened {
      flush()
      if opener.review {
        pending = &pendingAnnotation{opener: opener, lineOffset: index}
      }
      continue
    }
    if pending.closedBy(region) {
      flush()
      continue
    }
    if region.opensTagBoundary() {
      flush()
      continue
    }
    if pending != nil {
      pending.lines = append(pending.lines, region.text)
    }
  }
  flush()
  return reviews
}

// reviewLine reports whether a line opens a review, which acknowledgement it
// answers for, and with what remainder.
//
// The whitespace boundary keeps a longer tag out. `@evidenceReviewed` is some
// other tool's tag or a typo, and consuming it would attach a review to a
// citation the author never reviewed. The same boundary is what separates
// `@evidenceExcludeReview` from `@evidenceExclude` in `declarationLine`, so
// neither parser can claim the other's tag.
func reviewLine(line string) (tagKind, string, bool) {
  for _, candidate := range reviewMarkers {
    if !strings.HasPrefix(line, candidate.marker) {
      continue
    }
    remainder := line[len(candidate.marker):]
    if remainder != "" && remainder[0] != ' ' && remainder[0] != '\t' {
      continue
    }
    return candidate.tag, strings.TrimSpace(remainder), true
  }
  return "", "", false
}

// splitReviewFingerprint separates an optional fingerprint from the description.
//
// The `#` prefix is required rather than inferred, for the reason
// `splitInlineLinkBody` records about targets: the token stays
// self-discriminating through a boundary character instead of a guess. A bare
// fixed-width hex token would reintroduce that guess, and ordinary prose
// supplies the counter-examples — `cafe`, `deadbeef`, `beefed`.
//
// The exact length is checked as well as the prefix, because `#` alone is not
// enough. A requirement anchor such as `#req-search-policies` opens a
// description in exactly that shape, and eating it would strip the author's
// first words and then report a malformed fingerprint they did not write.
//
// No target begins with `#`: a Markdown target carries its anchor after a path,
// a Prisma target carries its `prisma:` prefix, a Swagger target its method,
// and a code target its brace. So this only ever reads the position after a
// target that has already been consumed.
func splitReviewFingerprint(remainder string) (string, string) {
  remainder = strings.TrimSpace(remainder)
  if !strings.HasPrefix(remainder, "#") {
    return "", remainder
  }
  candidate := remainder[1:]
  description := ""
  for index, char := range candidate {
    if unicode.IsSpace(char) {
      candidate, description = candidate[:index], strings.TrimSpace(candidate[index:])
      break
    }
  }
  if len(candidate) != reviewFingerprintLength || !isLowerHex(candidate) {
    // A rejected token stays in the description, because it is usually prose: a
    // requirement anchor such as `#req-search-policies` opens a sentence in
    // exactly this shape and the author's words must survive.
    //
    // Unless it is the whole body. `#A3F9C1D` alone is a fingerprint whose case
    // is wrong, not a description, and treating it as prose would let the
    // shortest wrong path an author can take pass silently: paste the expected
    // value, get the case wrong, stop, and ship a review that states nothing
    // while satisfying the non-empty test. Reported as malformed instead.
    if description == "" {
      return "", ""
    }
    return "", remainder
  }
  return candidate, description
}

func isLowerHex(value string) bool {
  for _, char := range value {
    if (char < '0' || char > '9') && (char < 'a' || char > 'f') {
      return false
    }
  }
  return value != ""
}

func containsWhitespace(value string) bool {
  for _, char := range value {
    if unicode.IsSpace(char) {
      return true
    }
  }
  return false
}

// commentFence recognizes example delimiters. Its callers decide whether a
// recognized example terminates annotation prose or belongs to a TODO's text.
type commentFence struct {
  marker rune
  length int
}

func (fence *commentFence) consume(line string) bool {
  marker, length, remainder, opened := markdownFence(line)
  if opened {
    if fence.marker == 0 {
      fence.marker, fence.length = marker, length
    } else if marker == fence.marker && length >= fence.length && strings.TrimSpace(remainder) == "" {
      fence.marker, fence.length = 0, 0
    }
    return true
  }
  return fence.marker != 0
}

func lineAt(content string, offset int) int {
  if offset < 0 {
    return 1
  }
  if offset > len(content) {
    offset = len(content)
  }
  return 1 + strings.Count(content[:offset], "\n")
}
