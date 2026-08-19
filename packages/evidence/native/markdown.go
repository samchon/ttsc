package evidence

import (
  "io/fs"
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "unicode"
)

var markdownCommentPattern = regexp.MustCompile(`(?s)<!--(.*?)-->`)
var explicitAnchorPattern = regexp.MustCompile(`\s*\{#([A-Za-z0-9][A-Za-z0-9._:-]*)\}\s*$`)

// loadMarkdownInventories reads every configured Markdown population, once per
// distinct base.
//
// One walk per base rather than one walk for the project, because a population
// that declares a root sits outside the tree the project walk covers — and a
// walk that started high enough to cover both would descend through everything
// between them. Two populations sharing a base share one walk, so the cost
// tracks the roots an author declared rather than the populations they wrote.
func loadMarkdownInventories(
  root string,
  config graphConfig,
) (map[string]*artifactInventory, []string) {
  inventories := map[string]*artifactInventory{}
  problems := []string{}
  for _, base := range configuredBases(config, artifactMarkdown) {
    problems = append(
      problems,
      loadMarkdownBase(base, config, inventories)...,
    )
  }
  return inventories, problems
}

func loadMarkdownBase(
  base populationBase,
  config graphConfig,
  inventories map[string]*artifactInventory,
) []string {
  problems := []string{}
  if problem := baseDirectoryProblem(base, artifactMarkdown); problem != "" {
    recordPopulationFailure(inventories, artifactMarkdown, base)
    return []string{problem}
  }
  err := filepath.WalkDir(base.Absolute, func(current string, entry fs.DirEntry, walkErr error) error {
    if walkErr != nil {
      // The walk root belongs to its population by construction, so a failure
      // to list it is a failure of the population and is never decided by what
      // the globs happen to select. The relevance test below answers for an
      // entry inside the base and returns false for the base itself, whose
      // base-relative path is "." and which no pattern is written to match, so
      // the one failure that empties the whole population was the one failure
      // this walker discarded. The success branch already exempts the base for
      // the same reason; this is that exemption on the error side.
      //
      // Returning the error ends the walk and carries the failure to the
      // handler below, which is where a population-level finding belongs and
      // where the population is recorded failed rather than healthy and empty.
      if current == base.Absolute {
        return walkErr
      }
      problem, relevant := unreadableEntryProblem(
        base,
        "Markdown",
        current,
        walkErr,
        func(relative string) bool {
          return matchesConfiguredMarkdownFile(config, base, relative) ||
            couldContainConfiguredMarkdown(config, base, relative)
        },
      )
      if relevant {
        recordPopulationFailure(inventories, artifactMarkdown, base)
        problems = append(problems, problem)
      }
      if entry != nil && entry.IsDir() {
        return filepath.SkipDir
      }
      return nil
    }
    if entry.IsDir() {
      if current != base.Absolute {
        relative, ok := relativeProjectPath(base.Absolute, current)
        if !ok || !couldContainConfiguredMarkdown(config, base, relative) {
          return filepath.SkipDir
        }
      }
      return nil
    }
    relative, ok := relativeProjectPath(base.Absolute, current)
    if !ok {
      return nil
    }
    if !matchesConfiguredMarkdownFile(config, base, relative) {
      return nil
    }
    address := base.addressOf(relative)
    content, readErr := os.ReadFile(current)
    if readErr != nil {
      inventories[address.Key] = &artifactInventory{
        Path:       address.Display,
        Type:       artifactMarkdown,
        LoadFailed: true,
      }
      problems = append(problems, "Evidence graph could not read Markdown file '"+address.Display+"': "+readErr.Error()+". Fix filesystem access or exclude the file from configured globs.")
      return nil
    }
    inventory, _ := scanMarkdownInventory(address, string(content))
    inventories[address.Key] = inventory
    for _, inventoryProblem := range inventory.Problems {
      if selectedByMarkdownPopulation(config, base, relative, inventoryProblem.Symbol) {
        problems = append(problems, inventoryProblem.Message)
      }
    }
    // An unreadable tag is not a health question and not a symbol question
    // either: the file loaded, its units are complete, and the tag reaches no
    // host whichever symbol a reference selects. The walk already refuses a
    // path no configured glob takes, so reaching here is enough to report.
    problems = append(problems, inventory.Unreadable...)
    return nil
  })
  if err != nil {
    recordPopulationFailure(inventories, artifactMarkdown, base)
    problems = append(problems, unlistableBaseProblem(base, "Markdown", err))
  }
  return problems
}

func scanMarkdownInventory(
  address artifactAddress,
  content string,
) (*artifactInventory, []string) {
  // The target is the path inside the population's base, while the location is
  // the path a reader opens. They are the same string for a project-rooted
  // population and deliberately differ for a rooted one: a citation that keeps
  // working when the document set is adopted by a sibling package cannot carry
  // that package's distance from the documents.
  path := address.Relative
  inventory := &artifactInventory{
    Path: address.Display,
    Type: artifactMarkdown,
  }
  problems := []string{}
  targetablePath := !containsWhitespace(path)
  fileUnitID := ""
  if targetablePath {
    fileUnitID = "markdown:" + address.Key + ":file"
    inventory.Units = append(inventory.Units, &evidenceUnit{
      ID:       fileUnitID,
      Target:   path,
      Type:     artifactMarkdown,
      Symbol:   "file",
      Path:     address.Display,
      Line:     1,
      Readable: "Markdown file",
    })
  } else {
    problem := "Markdown file '" + address.Display + "' cannot form an evidence target because its path contains whitespace. Rename the file so '@evidence <target> <reason>' can represent its path as one target token."
    problems = append(problems, problem)
    inventory.Problems = append(inventory.Problems, inventoryProblem{
      Symbol:  "*",
      Message: problem,
    })
  }

  lines := strings.Split(content, "\n")
  hostAtLine := make([]string, len(lines))
  hostIDAtLine := make([]string, len(lines))
  fencedAtLine := make([]bool, len(lines))
  // commentAtLine marks the lines a citation or a review can live on, so the
  // content digest can leave them out. A fenced block is not marked: an
  // `<!-- -->` inside one hosts no tag, and its text is content of the section.
  commentAtLine := make([]bool, len(lines))
  // The nearest heading *unit* enclosing each line, which is not the same as its
  // host: a heading may open a region without materializing a unit. Kept apart
  // from hostIDAtLine because that value decides where a declaration sits, and
  // widening it would move citations rather than only digests.
  digestHostIDAtLine := make([]string, len(lines))
  currentDigestHostID := fileUnitID
  currentHost := "file"
  currentHostID := fileUnitID
  fenceMarker := rune(0)
  fenceLength := 0
  inHTMLComment := false
  headingUnitIDs := [5]string{}
  for index, rawLine := range lines {
    line := strings.TrimSuffix(rawLine, "\r")
    trimmed := strings.TrimLeft(line, " \t")
    if marker, length, remainder, ok := markdownFence(line); ok {
      fencedAtLine[index] = true
      hostIDAtLine[index] = currentHostID
      // Fenced content is content. It hosts no tag, so it is never excluded as a
      // tag position, and leaving it unattributed would drop every code block out
      // of its section's digest: rewriting the example in a cited section would
      // then expire nothing.
      digestHostIDAtLine[index] = currentDigestHostID
      if fenceMarker == 0 {
        fenceMarker = marker
        fenceLength = length
      } else if marker == fenceMarker &&
        length >= fenceLength &&
        strings.TrimSpace(remainder) == "" {
        fenceMarker = 0
        fenceLength = 0
      }
      hostAtLine[index] = currentHost
      continue
    }
    if fenceMarker != 0 {
      fencedAtLine[index] = true
      hostAtLine[index] = currentHost
      hostIDAtLine[index] = currentHostID
      digestHostIDAtLine[index] = currentDigestHostID
      continue
    }
    if inHTMLComment {
      if strings.Contains(trimmed, "-->") {
        inHTMLComment = false
      }
      hostAtLine[index] = currentHost
      hostIDAtLine[index] = currentHostID
      digestHostIDAtLine[index] = currentDigestHostID
      commentAtLine[index] = true
      continue
    }
    if strings.HasPrefix(trimmed, "<!--") {
      remainder := strings.TrimPrefix(trimmed, "<!--")
      if !strings.Contains(remainder, "-->") {
        inHTMLComment = true
      }
      hostAtLine[index] = currentHost
      hostIDAtLine[index] = currentHostID
      digestHostIDAtLine[index] = currentDigestHostID
      commentAtLine[index] = true
      continue
    }
    level, title, ok := markdownHeading(line)
    if ok {
      currentHost = "h" + decimal(level)
      currentHostID = "markdown:" + address.Key + ":" + currentHost + ":" + decimal(index+1)
      if level <= 4 {
        for descendantLevel := level; descendantLevel <= 4; descendantLevel++ {
          headingUnitIDs[descendantLevel] = ""
        }
      }
      // A heading that materializes no unit still opens a region, and that
      // region's content belongs to the nearest heading unit enclosing it. An
      // H5 or deeper, and an H2 whose title yields no anchor, are both such
      // headings.
      // Carrying the previous unit forward instead would attribute the region to
      // whatever unit the walk happened to see last, which is a sibling rather
      // than an ancestor when the skipped heading is shallower: editing text
      // under an anchorless H2 would then expire a review of the H3 above it,
      // which does not contain that text.
      currentDigestHostID = fileUnitID
      // Start at the deepest level the array holds rather than at this
      // heading's own. Only H1 through H4 ever write a slot, so a deeper
      // heading's first candidate ancestor is H4, and reading from its own
      // level indexed past the end: an H6 walked from 5 into a five-slot array
      // and took the whole rule down before it materialized anything. An H5
      // survived that only because it starts at the last valid slot.
      //
      // Clamp rather than widen the array. Widening would also seal it, since
      // `markdownHeading` refuses a level past 6, so this is a choice about
      // what the type says rather than about safety: the array is indexed by
      // heading level and sized to hold every materializable one, so its length
      // is the model. A wider array would carry slots nothing writes and stop
      // saying so. It is not indexed by ordinal, so slot zero is unused.
      for ancestorLevel := min(level-1, len(headingUnitIDs)-1); ancestorLevel >= 1; ancestorLevel-- {
        if headingUnitIDs[ancestorLevel] != "" {
          currentDigestHostID = headingUnitIDs[ancestorLevel]
          break
        }
      }
      if level <= 4 && targetablePath {
        title, anchor := markdownHeadingIdentity(title)
        if anchor == "" {
          problems = append(
            problems,
            "Markdown evidence unit at "+address.Display+":"+decimal(index+1)+" has no resolvable anchor. Add a non-empty heading title or an explicit '{#anchor}' suffix.",
          )
          inventory.Problems = append(inventory.Problems, inventoryProblem{
            Symbol:  currentHost,
            Message: problems[len(problems)-1],
          })
        } else {
          // Clamped like the digest walk above, though the `level <= 4` around
          // this block already bounds it. Both walks read the same array, so
          // both state the same bound rather than one of them depending on a
          // condition someone could move.
          parentID := fileUnitID
          for ancestorLevel := min(level-1, len(headingUnitIDs)-1); ancestorLevel >= 1; ancestorLevel-- {
            if headingUnitIDs[ancestorLevel] != "" {
              parentID = headingUnitIDs[ancestorLevel]
              break
            }
          }
          unit := &evidenceUnit{
            ID:       "markdown:" + address.Key + ":" + currentHost + ":" + decimal(index+1),
            ParentID: parentID,
            Target:   path + "#" + anchor,
            Type:     artifactMarkdown,
            Symbol:   currentHost,
            Path:     address.Display,
            Line:     index + 1,
            Readable: "Markdown " + strings.ToUpper(currentHost) + " '" + title + "'",
          }
          inventory.Units = append(inventory.Units, unit)
          headingUnitIDs[level] = unit.ID
          currentDigestHostID = unit.ID
        }
      }
    }
    hostAtLine[index] = currentHost
    hostIDAtLine[index] = currentHostID
    digestHostIDAtLine[index] = currentDigestHostID
  }

  reportUnreadableMarkdownTags(inventory, address.Display, lines, fencedAtLine, commentAtLine)

  sequence := 0
  for _, match := range markdownCommentPattern.FindAllStringSubmatchIndex(content, -1) {
    if len(match) < 4 {
      continue
    }
    commentStart := match[0]
    line := lineAt(content, commentStart)
    if line <= 0 || line > len(lines) || fencedAtLine[line-1] {
      continue
    }
    comment := content[match[2]:match[3]]
    for _, parsed := range parseDeclarations(comment) {
      sequence++
      inventory.Declarations = append(inventory.Declarations, &evidenceDeclaration{
        ID:              "markdown:" + address.Key + ":" + decimal(line+parsed.LineOffset) + ":" + decimal(sequence),
        HostID:          hostIDAtLine[line-1],
        SemanticHostIDs: []string{hostIDAtLine[line-1]},
        Type:            artifactMarkdown,
        Tag:             parsed.Tag,
        Target:          parsed.Target,
        Reason:          parsed.Reason,
        Hosts:           symbolSet{hostAtLine[line-1]: true},
        Path:            address.Display,
        Line:            line + parsed.LineOffset,
        Sequence:        sequence,
      })
    }
    for _, review := range parseReviews(comment) {
      inventory.Reviews = append(inventory.Reviews, &evidenceReview{
        SemanticHostIDs: []string{hostIDAtLine[line-1]},
        Reviews:         review.Reviews,
        Type:            artifactMarkdown,
        Target:          review.Target,
        Fingerprint:     review.Fingerprint,
        Description:     review.Description,
        Path:            address.Display,
        Line:            line + review.LineOffset,
      })
    }
  }
  assignMarkdownDigests(inventory, lines, digestHostIDAtLine, commentAtLine)
  return inventory, problems
}

// assignMarkdownDigests gives every unit the text it alone owns.
//
// A heading owns its own line and the body under it up to the next heading, and a
// deeper heading starts a unit of its own, so the partition is exactly what
// `digestHostIDAtLine` records while walking. Composing a subtree belongs to
// `scopeIndex`, which is why nothing is folded in here: an H2 whose own body never
// changed keeps its own digest even when an H3 beneath it did.
//
// This is where Markdown and TypeScript genuinely differ. A document can be
// partitioned into disjoint regions, so a Markdown unit's digest really is
// independent of its subtree. A declaration cannot: `interface ISale`
// textually contains the members it declares, so a TypeScript unit's digest
// covers its descendants whether anything wants it to or not.
// `evidenceUnit.Digest` records the consequence; do not carry the Markdown
// intuition across.
//
// HTML comment lines are dropped because that is where a Markdown citation and
// its review live. Leaving them in would make writing the review change the
// digest the review's own fingerprint is checked against.
func assignMarkdownDigests(
  inventory *artifactInventory,
  lines []string,
  digestHostIDAtLine []string,
  commentAtLine []bool,
) {
  owned := map[string][]string{}
  for index := range lines {
    id := digestHostIDAtLine[index]
    if index < len(commentAtLine) && commentAtLine[index] {
      continue
    }
    if id == "" {
      continue
    }
    // A comment opening after prose on the same line is still a tag position:
    // the declaration scan runs over the whole document, so it finds a citation
    // or a review there. Only the comment span comes out, never the line, or the
    // prose beside it would vanish from the digest and a real content change
    // would stop expiring anything.
    content := markdownCommentPattern.ReplaceAllString(
      strings.TrimSuffix(lines[index], "\r"),
      "",
    )
    owned[id] = append(owned[id], content)
  }
  for _, unit := range inventory.Units {
    unit.Digest = contentDigest(strings.Join(owned[unit.ID], "\n"))
  }
}

// matchesConfiguredMarkdownFile reports whether a population rooted at this base
// selects the file.
//
// The base is compared before the globs, because a walk covers one base at a
// time and another base's patterns say nothing about a path inside this one.
// Without that comparison a project-rooted `docs/**` would sweep in the
// `docs` directory of every declared root.
func matchesConfiguredMarkdownFile(
  config graphConfig,
  base populationBase,
  path string,
) bool {
  for _, claim := range config.Claims {
    if claim.Type == artifactMarkdown &&
      claim.Base.Absolute == base.Absolute &&
      claim.Files.matches(path) {
      return true
    }
    for _, reference := range claim.References {
      if reference.Type == artifactMarkdown &&
        reference.Base.Absolute == base.Absolute &&
        reference.Files.matches(path) {
        return true
      }
    }
  }
  return false
}

func couldContainConfiguredMarkdown(
  config graphConfig,
  base populationBase,
  directory string,
) bool {
  for _, claim := range config.Claims {
    if claim.Type == artifactMarkdown &&
      claim.Base.Absolute == base.Absolute &&
      claim.Files.couldMatchDescendant(directory) {
      return true
    }
    for _, reference := range claim.References {
      if reference.Type == artifactMarkdown &&
        reference.Base.Absolute == base.Absolute &&
        reference.Files.couldMatchDescendant(directory) {
        return true
      }
    }
  }
  return false
}

// selectedByMarkdownPopulation reports whether any configured population reads
// this file for the symbol a scan problem was filed under.
//
// Claims are asked as well as references. A scan problem says the file
// materialized less than it looks like it should, and that is a hole on either
// side: a reference loses evidence units, while a claim loses the hosts that owe
// acknowledgements. The claim side was the silent one. A whitespace-named claim
// file forms no target, so it contributes no host, drops out of the obligation,
// and said nothing at all; the same file pointed at by a reference reported the
// path immediately.
//
// The claim is matched on its own symbol set for the reason a reference is: a
// problem about a kind this population does not read is not its problem. The
// wildcard symbol still reaches both, which is what carries the unaddressable
// path, since that one is about the file rather than about any heading kind.
func selectedByMarkdownPopulation(
  config graphConfig,
  base populationBase,
  path string,
  symbol string,
) bool {
  for _, claim := range config.Claims {
    if claim.Type == artifactMarkdown &&
      claim.Base.Absolute == base.Absolute &&
      claim.Files.matches(path) &&
      (symbol == "*" || claim.Symbols.contains(symbol)) {
      return true
    }
    for _, reference := range claim.References {
      if reference.Type == artifactMarkdown &&
        reference.Base.Absolute == base.Absolute &&
        reference.Files.matches(path) &&
        (symbol == "*" || reference.Symbols.contains(symbol)) {
        return true
      }
    }
  }
  return false
}

func markdownFence(line string) (rune, int, string, bool) {
  indent := 0
  for indent < len(line) && line[indent] == ' ' {
    indent++
  }
  if indent > 3 {
    return 0, 0, "", false
  }
  runes := []rune(line[indent:])
  if len(runes) < 3 || (runes[0] != '`' && runes[0] != '~') {
    return 0, 0, "", false
  }
  count := 1
  for count < len(runes) && runes[count] == runes[0] {
    count++
  }
  if count < 3 {
    return 0, 0, "", false
  }
  remainder := string(runes[count:])
  if runes[0] == '`' && strings.Contains(remainder, "`") {
    return 0, 0, "", false
  }
  return runes[0], count, remainder, true
}

func markdownHeading(line string) (int, string, bool) {
  space := 0
  for space < len(line) && line[space] == ' ' && space < 4 {
    space++
  }
  if space > 3 || space >= len(line) || line[space] != '#' {
    return 0, "", false
  }
  level := 0
  for space+level < len(line) && line[space+level] == '#' {
    level++
  }
  if level == 0 || level > 6 {
    return 0, "", false
  }
  next := space + level
  if next < len(line) && line[next] != ' ' && line[next] != '\t' {
    return 0, "", false
  }
  title := strings.TrimSpace(line[next:])
  trimmedHashes := strings.TrimRight(title, "#")
  if trimmedHashes != title && (trimmedHashes == "" || strings.HasSuffix(trimmedHashes, " ") || strings.HasSuffix(trimmedHashes, "\t")) {
    title = strings.TrimSpace(trimmedHashes)
  }
  return level, title, true
}

func markdownHeadingIdentity(title string) (string, string) {
  if match := explicitAnchorPattern.FindStringSubmatch(title); len(match) == 2 {
    cleanTitle := strings.TrimSpace(explicitAnchorPattern.ReplaceAllString(title, ""))
    return cleanTitle, match[1]
  }
  return title, markdownSlug(title)
}

func markdownSlug(title string) string {
  var builder strings.Builder
  lastHyphen := false
  for _, char := range strings.ToLower(title) {
    switch {
    case unicode.IsLetter(char), unicode.IsNumber(char), char == '_':
      builder.WriteRune(char)
      lastHyphen = false
    case char == '-' || unicode.IsSpace(char):
      if builder.Len() > 0 && !lastHyphen {
        builder.WriteRune('-')
        lastHyphen = true
      }
    }
  }
  return strings.Trim(builder.String(), "-")
}

// reportUnreadableMarkdownTags records every tag written where this artifact
// kind cannot read one.
//
// A Markdown declaration is read from an HTML comment, so the tag renders
// invisibly and the author sees the same source either way. Written as prose it
// reaches no host and used to be discarded without a word, leaving the coverage
// diagnostic that follows to name the reference and suggest writing the
// citation the author had already written. TypeScript answers this shape and
// the Prisma bridge answers its own; this is the kind that was left silent.
//
// A fenced block is an example rather than a citation and stays silent, which
// is not a concession: this product's own documentation shows tags inside
// fences, and reporting them would fail its build. An indented code block is
// the same case in another spelling, so four leading spaces are read as code
// rather than as prose.
//
// The tag has to open its line, which is the discrimination every reader in
// this package performs, so a sentence mentioning one describes it rather than
// declaring it.
func reportUnreadableMarkdownTags(
  inventory *artifactInventory,
  location string,
  lines []string,
  fencedAtLine []bool,
  commentAtLine []bool,
) {
  if inventory == nil {
    return
  }
  rendered := false
  for index, rawLine := range lines {
    line := strings.TrimSuffix(rawLine, "\r")
    if opens, closes := renderedCodeEdges(line); opens || closes {
      rendered = opens
      continue
    }
    if rendered {
      continue
    }
    if index < len(fencedAtLine) && fencedAtLine[index] {
      continue
    }
    if index < len(commentAtLine) && commentAtLine[index] {
      continue
    }
    if strings.HasPrefix(line, "    ") || strings.HasPrefix(line, "  ") {
      continue
    }
    trimmed := markdownLineContent(line)
    if tag, _, found := declarationLine(trimmed); found {
      inventory.Unreadable = append(
        inventory.Unreadable,
        unreadableMarkdownProblem("@"+string(tag), location, index+1),
      )
      continue
    }
    if reviews, _, opened := reviewLine(trimmed); opened {
      inventory.Unreadable = append(
        inventory.Unreadable,
        unreadableMarkdownProblem(reviewMarkerFor(reviews), location, index+1),
      )
    }
  }
}

// markdownLineContent drops the markers that carry a line rather than say
// anything.
//
// A citation written as a bullet or inside a quote is the same mistake as one
// written bare, and an author reaching for a list is if anything more likely
// than one writing a lone paragraph. Reading the line without its marker is
// what lets the report name them, while the tag still has to be the first
// content on the line, so a sentence mentioning one goes on describing it.
func markdownLineContent(line string) string {
  content := strings.TrimSpace(line)
  for {
    stripped := strings.TrimSpace(strings.TrimPrefix(content, ">"))
    if stripped != content {
      content = stripped
      continue
    }
    if marker := markdownListMarker(content); marker != 0 {
      content = strings.TrimSpace(content[marker:])
      continue
    }
    return content
  }
}

// markdownListMarker reports the length of a leading list marker, or zero.
func markdownListMarker(content string) int {
  for _, bullet := range []string{"- ", "* ", "+ "} {
    if strings.HasPrefix(content, bullet) {
      return len(bullet)
    }
  }
  digits := 0
  for digits < len(content) && content[digits] >= '0' && content[digits] <= '9' {
    digits++
  }
  if digits == 0 || digits+1 >= len(content) {
    return 0
  }
  if punctuation := content[digits]; punctuation != '.' && punctuation != ')' {
    return 0
  }
  if content[digits+1] != ' ' {
    return 0
  }
  return digits + 2
}

// renderedCodeEdges reports whether a line opens or closes a block that renders
// as code without being a fence.
//
// A documentation site shows examples through more than one syntax. An MDX page
// passes a template literal to a component, and an HTML page uses `<pre>`; both
// render as code, so both are examples in the sense a fence is, and the repair
// this diagnostic names would delete the example from the rendered page rather
// than fix anything. Only the two edges are recognized, because a page that
// opens one and never closes it is a page whose own build fails first.
func renderedCodeEdges(line string) (bool, bool) {
  lowered := strings.ToLower(line)
  switch {
  case strings.Contains(lowered, "<pre"):
    return !strings.Contains(lowered, "</pre>"), strings.Contains(lowered, "</pre>")
  case strings.Contains(lowered, "</pre>"):
    return false, true
  case strings.Contains(line, "={`"):
    return !strings.Contains(line, "`}"), strings.Contains(line, "`}")
  case strings.Contains(line, "`}"):
    return false, true
  }
  return false, false
}

// unreadableMarkdownProblem names the position and the move that fixes it.
func unreadableMarkdownProblem(tag string, location string, line int) string {
  return "Unreadable " + tag + " at " + location + ":" + decimal(line) +
    ": a Markdown declaration is read from an HTML comment, and this line is prose, so nothing reads the tag." +
    " Wrap it as '<!-- " + tag + " <target> " + unreadableMarkdownField(tag) + " -->'."
}

// unreadableMarkdownField names what follows a target for this tag.
//
// A review carries a description of what was checked rather than a reason, and
// every other review diagnostic in this package says so. One template for both
// families would tell an author to write the wrong field.
func unreadableMarkdownField(tag string) string {
  if strings.HasSuffix(tag, "Review") {
    return "<what you checked>"
  }
  return "<reason>"
}
