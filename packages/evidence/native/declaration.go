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
  comment = strings.TrimSpace(comment)
  comment = strings.TrimPrefix(comment, "/**")
  comment = strings.TrimPrefix(comment, "/*")
  comment = strings.TrimSuffix(comment, "*/")
  for _, rawLine := range strings.Split(comment, "\n") {
    line := strings.TrimSpace(rawLine)
    line = strings.TrimSpace(strings.TrimPrefix(line, "*"))
    line = strings.TrimSpace(strings.TrimPrefix(line, "///"))
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
  trimmed := strings.TrimLeftFunc(comment, unicode.IsSpace)
  leadingLines := strings.Count(comment[:len(comment)-len(trimmed)], "\n")
  comment = trimmed
  jsdoc := strings.HasPrefix(comment, "/**") || tagBoundaries
  comment = strings.TrimPrefix(comment, "/**")
  comment = strings.TrimPrefix(comment, "/*")
  comment = strings.TrimSuffix(comment, "*/")
  lines := strings.Split(comment, "\n")
  type pendingDeclaration struct {
    tag        tagKind
    body       []string
    lineOffset int
  }
  var pending *pendingDeclaration
  parsed := []parsedDeclaration{}
  flush := func() {
    if pending == nil {
      return
    }
    target, reason := splitDeclarationBody(strings.Join(pending.body, "\n"))
    parsed = append(parsed, parsedDeclaration{
      Tag:        pending.tag,
      Target:     target,
      Reason:     reason,
      LineOffset: leadingLines + pending.lineOffset,
    })
    pending = nil
  }
  for index, rawLine := range lines {
    line := strings.TrimSpace(rawLine)
    line = strings.TrimSpace(strings.TrimPrefix(line, "*"))
    tag, body, found := declarationLine(line)
    if found {
      flush()
      pending = &pendingDeclaration{
        tag:        tag,
        body:       []string{body},
        lineOffset: index,
      }
      continue
    }
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
    if _, opened := reviewLine(line); opened {
      flush()
      continue
    }
    if jsdoc && strings.HasPrefix(line, "@") {
      flush()
      continue
    }
    if pending != nil {
      pending.body = append(pending.body, line)
    }
  }
  flush()
  return parsed
}

func declarationLine(line string) (tagKind, string, bool) {
  for _, candidate := range []struct {
    marker string
    tag    tagKind
  }{
    {marker: "@evidenceExclude", tag: tagExclude},
    {marker: "@evidence", tag: tagEvidence},
  } {
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

// reviewMarker opens a verification statement about one citation.
const reviewMarker = "@evidenceReview"

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
  Target      string
  Fingerprint string
  Description string
  LineOffset  int
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
  trimmed := strings.TrimLeftFunc(comment, unicode.IsSpace)
  leadingLines := strings.Count(comment[:len(comment)-len(trimmed)], "\n")
  comment = trimmed
  comment = strings.TrimPrefix(comment, "/**")
  comment = strings.TrimPrefix(comment, "/*")
  comment = strings.TrimSuffix(comment, "*/")
  reviews := []parsedReview{}
  var pending *parsedReview
  var body []string
  flush := func() {
    if pending == nil {
      return
    }
    target, remainder := splitDeclarationBody(strings.Join(body, "\n"))
    fingerprint, description := splitReviewFingerprint(remainder)
    pending.Target = target
    pending.Fingerprint = fingerprint
    pending.Description = description
    reviews = append(reviews, *pending)
    pending = nil
    body = nil
  }
  for index, rawLine := range strings.Split(comment, "\n") {
    line := strings.TrimSpace(rawLine)
    line = strings.TrimSpace(strings.TrimPrefix(line, "*"))
    line = strings.TrimSpace(strings.TrimPrefix(line, "///"))
    if remainder, opened := reviewLine(line); opened {
      flush()
      pending = &parsedReview{LineOffset: leadingLines + index}
      body = []string{remainder}
      continue
    }
    if strings.HasPrefix(line, "@") {
      flush()
      continue
    }
    if pending != nil {
      body = append(body, line)
    }
  }
  flush()
  return reviews
}

// reviewLine reports whether a line opens a review, and with what remainder.
//
// The whitespace boundary keeps a longer tag out. `@evidenceReviewed` is some
// other tool's tag or a typo, and consuming it would attach a review to a
// citation the author never reviewed.
func reviewLine(line string) (string, bool) {
  if !strings.HasPrefix(line, reviewMarker) {
    return "", false
  }
  remainder := line[len(reviewMarker):]
  if remainder != "" && remainder[0] != ' ' && remainder[0] != '\t' {
    return "", false
  }
  return strings.TrimSpace(remainder), true
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

func lineAt(content string, offset int) int {
  if offset < 0 {
    return 1
  }
  if offset > len(content) {
    offset = len(content)
  }
  return 1 + strings.Count(content[:offset], "\n")
}
