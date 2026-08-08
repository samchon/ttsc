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
  if problem := unreadableBaseProblem(base, artifactMarkdown); problem != "" {
    recordPopulationFailure(inventories, artifactMarkdown, base)
    return []string{problem}
  }
  err := filepath.WalkDir(base.Absolute, func(current string, entry fs.DirEntry, walkErr error) error {
    if walkErr != nil {
      relative, ok := relativeProjectPath(base.Absolute, current)
      relevant := ok &&
        (matchesConfiguredMarkdownFile(config, base, relative) ||
          couldContainConfiguredMarkdown(config, base, relative))
      if !relevant {
        if entry != nil && entry.IsDir() {
          return filepath.SkipDir
        }
        return nil
      }
      recordPopulationFailure(inventories, artifactMarkdown, base)
      problems = append(problems, "Evidence graph could not inspect '"+current+"': "+walkErr.Error()+". Fix filesystem access so configured Markdown sources can be indexed.")
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
      if selectedByMarkdownReference(config, base, relative, inventoryProblem.Symbol) {
        problems = append(problems, inventoryProblem.Message)
      }
    }
    return nil
  })
  if err != nil {
    recordPopulationFailure(inventories, artifactMarkdown, base)
    problems = append(problems, "Evidence graph could not walk Markdown root '"+populationRootLabel(base)+"': "+err.Error()+".")
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
      // H5, and an H2 whose title yields no anchor, are both such headings.
      // Carrying the previous unit forward instead would attribute the region to
      // whatever unit the walk happened to see last, which is a sibling rather
      // than an ancestor when the skipped heading is shallower: editing text
      // under an anchorless H2 would then expire a review of the H3 above it,
      // which does not contain that text.
      currentDigestHostID = fileUnitID
      for ancestorLevel := level - 1; ancestorLevel >= 1; ancestorLevel-- {
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
          parentID := fileUnitID
          for ancestorLevel := level - 1; ancestorLevel >= 1; ancestorLevel-- {
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
        HostID:          hostIDAtLine[line-1],
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
// independent of its subtree. A declaration cannot: `interface ISale` textually
// contains the members it declares, so a TypeScript unit's digest covers its descendants
// whether anything wants it to or not. `evidenceUnit.Digest` records the
// consequence; do not carry the Markdown intuition across.
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

func selectedByMarkdownReference(
  config graphConfig,
  base populationBase,
  path string,
  symbol string,
) bool {
  for _, claim := range config.Claims {
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
