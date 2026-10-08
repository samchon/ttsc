package evidence

import (
  "io/fs"
  "path/filepath"
  "regexp"
  "sort"
  "strings"
  "unicode"

  "github.com/yuin/goldmark/v2/ast"
  "github.com/yuin/goldmark/v2/parser"
  "github.com/yuin/goldmark/v2/text"
  "github.com/yuin/goldmark/v2/util"
)

var explicitAnchorPattern = regexp.MustCompile(`\s*\{#([A-Za-z0-9][A-Za-z0-9._:-]*)\}\s*$`)

// markdownLexicalLine keeps syntax visibility separate from original content.
// Heading preserves inline source on its opening line and masks continuations;
// Prose retains a non-whitespace sentinel for inline examples so a tag after
// one cannot become line-leading metadata. Neither view changes source offsets.
type markdownLexicalLine struct {
  Heading string
  Prose string
}

// markdownRegion records a half-open range in the original UTF-8 source.
type markdownRegion struct {
  Start int
  End int
  Block bool
}

// markdownHybridParser adds the existing HTML/MDX example carriers to a
// CommonMark parse. It consumes the original reader instead of projecting or
// deleting bytes, so paragraph and container boundaries remain authoritative.
type markdownHybridParser struct {
  Source string
  Protected []markdownRegion
  Owners []markdownRegion
  Ends map[ast.Node]int
}

// markdownHybridBlock is deliberately not an ast.Paragraph. Goldmark gives
// paragraphs its own continuation policy; this node owns example continuations
// while retaining original source segments for the standard inline parser.
var markdownHybridBlockKind = ast.NewNodeKind("EvidenceMarkdownExample")

type markdownHybridBlock struct { ast.BaseBlock }

func (block *markdownHybridBlock) Kind() ast.NodeKind { return markdownHybridBlockKind }
func (block *markdownHybridBlock) Dump(_ []byte) *ast.NodeDump { return ast.NewNodeDump(block, nil) }

// Free block parsers run after every registered trigger parser regardless of
// priority. Register every byte so an existing owner can precede fence/list/
// quote openers, and a new carrier can precede the ordinary HTML block parser.
var markdownHybridTriggers = func() []byte {
  triggers := make([]byte, 256)
  for index := range triggers { triggers[index] = byte(index) }
  return triggers
}()

func (scan *markdownHybridParser) Trigger() []byte { return markdownHybridTriggers }

func (scan *markdownHybridParser) ownerAt(position int) (markdownRegion, bool) {
  index := sort.Search(len(scan.Owners), func(index int) bool {
    return scan.Owners[index].End > position
  })
  if index < len(scan.Owners) && scan.Owners[index].Start <= position {
    return scan.Owners[index], true
  }
  return markdownRegion{}, false
}

func (scan *markdownHybridParser) protectedAt(position int) (markdownRegion, bool) {
  index := sort.Search(len(scan.Protected), func(index int) bool {
    return scan.Protected[index].End > position
  })
  if index < len(scan.Protected) && scan.Protected[index].Start <= position {
    region := scan.Protected[index]
    if _, owned := scan.ownerAt(region.Start); !owned {
      return region, true
    }
  }
  return markdownRegion{}, false
}

// findOwners records only lexical carriers outside earlier code and comments.
// A standard-parser code region beginning inside an already acquired hybrid
// carrier has no authority: the hybrid carrier owns those delimiter bytes.
func (scan *markdownHybridParser) findOwners(start int, end int) int {
  ownerEnd := start
  for cursor := start; cursor < end; {
    if owner, found := scan.ownerAt(cursor); found {
      ownerEnd = max(ownerEnd, owner.End)
      cursor = owner.End
      continue
    }
    if region, found := scan.protectedAt(cursor); found {
      cursor = region.End
      continue
    }
    if scan.Source[cursor] == '\\' && cursor+1 < len(scan.Source) {
      cursor += 2
      continue
    }
    next := markdownOpaqueEnd(scan.Source, cursor)
    if next > cursor {
      scan.Owners = append(scan.Owners, markdownRegion{Start: cursor, End: next})
      ownerEnd = max(ownerEnd, next)
      cursor = next
      continue
    }
    cursor++
  }
  return ownerEnd
}

func (scan *markdownHybridParser) Open(_ ast.Node, reader text.Reader, _ parser.Context) (ast.Node, parser.State) {
  _, segment := reader.PeekLine()
  end := scan.findOwners(segment.Start, segment.Stop)
  if end <= segment.Stop {
    return nil, parser.NoChildren
  }
  node := &markdownHybridBlock{}
  node.Init(node)
  node.AppendSource(segment)
  scan.Ends[node] = end
  reader.AdvanceToEOL()
  return node, parser.NoChildren
}

func (scan *markdownHybridParser) Continue(node ast.Node, reader text.Reader, _ parser.Context) parser.State {
  line, segment := reader.PeekLine()
  if util.IsBlank(line) || segment.Start >= scan.Ends[node] {
    return parser.Close
  }
  scan.Ends[node] = max(scan.Ends[node], scan.findOwners(segment.Start, segment.Stop))
  node.(ast.BlockNode).AppendSource(segment)
  reader.AdvanceToEOL()
  return parser.Continue | parser.NoChildren
}

func (scan *markdownHybridParser) Close(node ast.Node, _ text.Reader, _ parser.Context) {
  delete(scan.Ends, node)
}

func (scan *markdownHybridParser) CanInterruptParagraph() bool { return true }
func (scan *markdownHybridParser) CanAcceptIndentedLine() bool { return false }

// markdownHybridCarry reacquires a known owner after a paragraph/container
// boundary, before the bytes inside it can open an unrelated Markdown block.
// It never acquires new owners and therefore cannot steal ordinary code blocks.
type markdownHybridCarry struct { Scan *markdownHybridParser }

func (carry *markdownHybridCarry) Trigger() []byte { return markdownHybridTriggers }
func (carry *markdownHybridCarry) Open(_ ast.Node, reader text.Reader, _ parser.Context) (ast.Node, parser.State) {
  line, segment := reader.PeekLine()
  owner, found := carry.Scan.ownerAt(segment.Start)
  if !found || owner.Start >= segment.Start || util.IsBlank(line) {
    return nil, parser.NoChildren
  }
  node := &markdownHybridBlock{}
  node.Init(node)
  node.AppendSource(segment)
  carry.Scan.Ends[node] = max(owner.End, carry.Scan.findOwners(segment.Start, segment.Stop))
  reader.AdvanceToEOL()
  return node, parser.NoChildren
}
func (carry *markdownHybridCarry) Continue(node ast.Node, reader text.Reader, context parser.Context) parser.State { return carry.Scan.Continue(node, reader, context) }
func (carry *markdownHybridCarry) Close(node ast.Node, reader text.Reader, context parser.Context) { carry.Scan.Close(node, reader, context) }
func (carry *markdownHybridCarry) CanInterruptParagraph() bool { return true }
func (carry *markdownHybridCarry) CanAcceptIndentedLine() bool { return true }

type markdownHybridInline struct { Scan *markdownHybridParser }

func (inline *markdownHybridInline) Trigger() []byte { return []byte{' ', '<', '=', '`'} }

func (inline *markdownHybridInline) Parse(parent ast.Node, reader text.Reader, _ parser.Context) ast.Node {
  _, segment := reader.Position()
  owner, found := inline.Scan.ownerAt(segment.Start)
  if !found {
    return nil
  }
  source := parent.(ast.BlockNode).Source()
  end := min(owner.End, source[len(source)-1].Stop)
  start := segment.Start
  for {
    line, segment := reader.PeekLine()
    if line == nil {
      break
    }
    if end <= segment.Stop {
      reader.Advance(end-segment.Start)
      break
    }
    reader.AdvanceLine()
  }
  return ast.NewRawHTML(text.NewMultiLineValueFromIndex(text.NewIndex(start, end), text.IdentityDecoder))
}

// markdownParserRegions reads code positions from the maintained CommonMark
// parser. Containers and multiline spans use its original source positions.
func markdownParserRegions(source string, document ast.Node, comments bool) []markdownRegion {
  regions := []markdownRegion{}
  ast.Walk(document, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
    if !entering { return ast.WalkContinue, nil }
    switch value := node.(type) {
    case *ast.CodeBlock:
      start, end := value.Pos(), value.Pos()
      for _, segment := range value.Value.Segments() { end = segment.Stop }
      start = strings.LastIndexByte(source[:start], '\n')+1
      regions = append(regions, markdownRegion{Start:start, End:end, Block:true})
    case *ast.CodeSpan:
      indices := value.Value.Indices()
      if len(indices) != 0 {
        start, end := value.Pos(), indices[len(indices)-1].Stop
        for end < len(source) && source[end] == '`' { end++ }
        regions = append(regions, markdownRegion{Start:start, End:end})
      }
    case *ast.HTMLBlock:
      if comments && value.HTMLBlockKind == ast.HTMLBlockKind2 {
        end := markdownCommentEnd(source, value.Pos())
        regions = append(regions, markdownRegion{Start:value.Pos(), End:end})
      }
    case *ast.RawHTML:
      if comments && strings.HasPrefix(source[value.Pos():], "<!--") {
        indices := value.Value.Indices()
        if len(indices) != 0 { regions = append(regions, markdownRegion{Start:value.Pos(), End:indices[len(indices)-1].Stop}) }
      }
    }
    return ast.WalkContinue, nil
  })
  sort.Slice(regions, func(left, right int) bool { return regions[left].Start < regions[right].Start })
  return regions
}

// scanMarkdownRegions gives every annotation consumer the same original-byte
// classification. Two parser passes preserve CommonMark ownership before adding
// the existing permissive MDX carriers through public parser extension APIs.
// No rendered text or normalized projection participates in source offsets.
func scanMarkdownRegions(content string, lines []string) ([]markdownLexicalLine, [][2]int) {
  baseline := parser.New().Parse([]byte(content))
  scan := &markdownHybridParser{Source:content, Protected:markdownParserRegions(content, baseline, true), Ends:map[ast.Node]int{}}
  // All block entries share one receiver's ownership state. A known owner
  // resumes before new blocks; headings acquire carriers before ATX parsing,
  // and ordinary carriers acquire ownership after code and quote openers.
  document := parser.New(parser.WithBlockParsers(
    util.Prioritized[parser.BlockParser](&markdownHybridCarry{Scan:scan}, 0),
    util.Prioritized[parser.BlockParser](&markdownHybridHeading{Scan:scan}, 590),
    util.Prioritized[parser.BlockParser](scan, 850),
  ), parser.WithInlineParsers(util.Prioritized[parser.InlineParser](&markdownHybridInline{Scan:scan}, 50))).Parse([]byte(content))
  regions := markdownParserRegions(content, document, false)
  code := make([]byte, len(content))
  for _, region := range regions {
    kind := byte(1)
    if region.Block { kind = 2 }
    for cursor := region.Start; cursor < region.End; cursor++ { code[cursor] = kind }
  }
  lexical := make([]markdownLexicalLine, len(lines))
  spans := [][2]int{}
  commentStart := -1
  opaqueStart, opaqueEnd := 0, 0
  offset := 0
  for index, rawLine := range lines {
    line := strings.TrimSuffix(rawLine, "\r")
    heading, prose := []byte(line), []byte(line)
    mask := func(start, end int, structural bool) {
      for cursor := start; cursor < end; cursor++ {
        prose[cursor] = ' '
        if structural { heading[cursor] = ' ' }
      }
    }
    for cursor := 0; cursor < len(line); {
      if commentStart >= 0 {
        end, closed := len(line), false
        if offset+cursor == commentStart+4 && strings.HasPrefix(line[cursor:], ">") {
          end, closed = cursor+1, true
        } else if offset+cursor == commentStart+4 && strings.HasPrefix(line[cursor:], "->") {
          end, closed = cursor+2, true
        } else if closing := strings.Index(line[cursor:], "-->"); closing >= 0 {
          end, closed = cursor+closing+3, true
        }
        mask(cursor,end,true)
        if commentStart < offset { heading[cursor] = 'x' }
        cursor = end
        if closed {
          spans = append(spans,[2]int{commentStart,offset+end})
          commentStart = -1
        }
        continue
      }
      if opaqueEnd > offset+cursor {
        end := min(len(line),opaqueEnd-offset)
        continuation := opaqueStart < offset
        mask(cursor,end,continuation)
        if continuation { heading[cursor] = 'x' }
        prose[cursor] = 'x'
        cursor = end
        continue
      }
      if kind := code[offset+cursor]; kind != 0 {
        end := cursor+1
        for end < len(line) && code[offset+end] == kind { end++ }
        mask(cursor,end,kind==2)
        prose[cursor] = 'x'
        cursor = end
        continue
      }
      if line[cursor] == '\\' && cursor+1 < len(line) && strings.ContainsRune("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",rune(line[cursor+1])) {
        mask(cursor,cursor+2,false)
        prose[cursor] = 'x'
        cursor += 2
        continue
      }
      if strings.HasPrefix(line[cursor:], "<!--") {
        commentStart = offset+cursor
        mask(cursor,cursor+4,true)
        cursor += 4
        continue
      }
      if end := markdownOpaqueEnd(content,offset+cursor); end > offset+cursor {
        opaqueStart, opaqueEnd = offset+cursor, end
        continue
      }
      cursor++
    }
    lexical[index] = markdownLexicalLine{Heading:string(heading),Prose:string(prose)}
    offset += len(rawLine)+1
  }
  return lexical, spans
}

type markdownHybridHeading struct {
  Scan *markdownHybridParser
}

func (heading *markdownHybridHeading) Trigger() []byte { return []byte{'#'} }
func (heading *markdownHybridHeading) Open(parent ast.Node, reader text.Reader, context parser.Context) (ast.Node,parser.State) {
  line, segment := reader.PeekLine()
  if _, _, found := markdownHeading(string(line)); !found {
    return nil, parser.NoChildren
  }
  node, state := heading.Scan.Open(parent, reader, context)
  if node != nil {
    // An ATX heading owns exactly one source line. Its rendered carrier may
    // continue, but backticks in the heading cannot pair with the next block.
    heading.Scan.Ends[node] = segment.Stop
  }
  return node, state
}
func (heading *markdownHybridHeading) Continue(node ast.Node, reader text.Reader, context parser.Context) parser.State { return heading.Scan.Continue(node,reader,context) }
func (heading *markdownHybridHeading) Close(node ast.Node, reader text.Reader, context parser.Context) { heading.Scan.Close(node,reader,context) }
func (heading *markdownHybridHeading) CanInterruptParagraph() bool { return true }
func (heading *markdownHybridHeading) CanAcceptIndentedLine() bool { return false }

// markdownOpaqueEnd consumes supported HTML syntax and template attributes with
// quote-aware original-byte boundaries. An unclosed rendered owner retains its
// suffix, matching the existing permissive Markdown/MDX documentation contract.
func markdownOpaqueEnd(content string, start int) int {
  if strings.HasPrefix(content[start:], "={`") {
    return markdownTemplateEnd(content,start+3)
  }
  if content[start] != '<' || start+1 >= len(content) { return start }
  cursor := start+1
  closing := content[cursor]=='/'
  if closing { cursor++ }
  name := cursor
  for cursor < len(content) && (content[cursor]>='a'&&content[cursor]<='z'||content[cursor]>='A'&&content[cursor]<='Z'||cursor>name&&(content[cursor]>='0'&&content[cursor]<='9'||content[cursor]=='-'||content[cursor]==':')) { cursor++ }
  if cursor == name { return start }
  if cursor < len(content) && !strings.ContainsRune(" \t\r\n/>", rune(content[cursor])) { return start }
  pre := !closing && strings.EqualFold(content[name:cursor],"pre")
  quote := byte(0)
  for cursor < len(content) {
    char := content[cursor]
    if quote != 0 {
      if char == quote { quote = 0 }
      cursor++
    } else if char=='\'' || char=='"' {
      quote = char
      cursor++
    } else if strings.HasPrefix(content[cursor:],"={`") {
      cursor = markdownTemplateEnd(content,cursor+3)
    } else if char=='>' {
      cursor++
      if pre {
        for probe:=cursor; probe+6<=len(content); probe++ {
          if strings.EqualFold(content[probe:probe+6],"</pre>") { return probe+6 }
        }
        return len(content)
      }
      return cursor
    } else if char=='<' {
      return start
    } else { cursor++ }
  }
  if pre { return len(content) }
  return start
}

// markdownCommentEnd clips a protected comment to its actual closing byte;
// CommonMark HTML blocks may retain unrelated text from the closing line.
func markdownCommentEnd(content string, start int) int {
  body := start+4
  if strings.HasPrefix(content[body:], ">") { return body+1 }
  if strings.HasPrefix(content[body:], "->") { return body+2 }
  if close := strings.Index(content[body:], "-->"); close >= 0 { return body+close+3 }
  return len(content)
}

func markdownTemplateEnd(content string, from int) int {
  for cursor:=from; cursor<len(content); cursor++ {
    if content[cursor]=='\\' && cursor+1<len(content) { cursor++
    } else if strings.HasPrefix(content[cursor:],"`}") { return cursor+2 }
  }
  return len(content)
}

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
) (map[string]*artifactInventory, graphDiagnostics) {
  inventories := map[string]*artifactInventory{}
  problems := graphDiagnostics{}
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
) graphDiagnostics {
  problems := graphDiagnostics{}
  severity := populationSeverity(config, artifactMarkdown, base, "", "*", false)
  if problem := baseDirectoryProblem(base, artifactMarkdown); problem != "" {
    recordPopulationFailure(inventories, artifactMarkdown, base)
    return problems.add(severity, problem)
  }
  from, resolved := resolvedBaseDirectory(base)
  if !resolved {
    recordPopulationFailure(inventories, artifactMarkdown, base)
    return problems.add(severity, unresolvedBaseProblem(base, artifactMarkdown))
  }
  err := base.inputs.WalkDir(from, func(current string, entry fs.DirEntry, walkErr error) error {
    if walkErr != nil {
      // The walk root belongs to its population by construction, so a failure
      // to list it is a failure of the population and is never decided by what
      // the globs happen to select. The relevance test below answers for an
      // entry inside the base, and it answers for the base itself only by
      // accident: its base-relative path is ".", which `couldMatchDescendant`
      // calls true under a pattern opening with `**` and false under one
      // opening with a segment. So the one failure that empties the whole
      // population was reported or discarded by the shape of the globs. The
      // success branch already exempts the base; this is that exemption on the
      // error side.
      //
      // Returning the error ends the walk and carries the failure to the
      // handler below, which is where a population-level finding belongs and
      // where the population is recorded failed rather than healthy and empty.
      if current == from {
        return walkErr
      }
      problem, relevant := unreadableEntryProblem(
        base,
        from,
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
        relative, _ := relativeProjectPath(from, current)
        problems = problems.add(populationSeverity(config, artifactMarkdown, base, relative, "*", true), problem)
      }
      // `WalkDir` passes a nil entry only for its root, which the guard above
      // answers, so this error belongs to a directory whose listing failed and
      // the walk continues with its siblings.
      return filepath.SkipDir
    }
    if entry.IsDir() {
      if current != from {
        relative, ok := relativeProjectPath(from, current)
        if !ok || !couldContainConfiguredMarkdown(config, base, relative) {
          return filepath.SkipDir
        }
      }
      return nil
    }
    relative, ok := relativeProjectPath(from, current)
    if !ok {
      return nil
    }
    if !matchesConfiguredMarkdownFile(config, base, relative) {
      return nil
    }
    severity := populationSeverity(config, artifactMarkdown, base, relative, "*", false)
    address := base.addressOf(relative)
    content, readErr := base.inputs.ReadFile(current)
    if readErr != nil {
      inventories[address.Key] = &artifactInventory{
        Path:       address.Display,
        Type:       artifactMarkdown,
        LoadFailed: true,
      }
      problems = problems.add(
        severity,
        "Evidence graph could not read Markdown file '"+address.Display+"': "+causeText(readErr)+". Fix filesystem access or exclude the file from configured globs.",
      )
      return nil
    }
    inventory, _ := scanMarkdownInventory(address, string(content))
    inventories[address.Key] = inventory
    for _, inventoryProblem := range inventory.Problems {
      if selectedByMarkdownPopulation(config, base, relative, inventoryProblem.Symbol) {
        problems = problems.add(populationSeverity(config, artifactMarkdown, base, relative, inventoryProblem.Symbol, false), inventoryProblem.Message)
      }
    }
    // An unreadable tag is not a health question and not a symbol question
    // either: the file loaded, its units are complete, and the tag reaches no
    // host whichever symbol a reference selects. The walk already refuses a
    // path no configured glob takes, so reaching here is enough to report.
    problems = problems.add(severity, inventory.Unreadable...)
    return nil
  })
  if err != nil {
    recordPopulationFailure(inventories, artifactMarkdown, base)
    problems = problems.add(severity, unlistableBaseProblem(base, "Markdown", err))
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

  // A byte order mark is encoding, not content. A document that opens with one
  // renders its first heading, but the mark would sit in front of the `#` and
  // hide that heading from the scan, so its unit and every obligation it owes
  // would vanish without a word.
  content = strings.TrimPrefix(content, "\xef\xbb\xbf")
  lines := strings.Split(content, "\n")
  hostAtLine := make([]string, len(lines))
  hostIDAtLine := make([]string, len(lines))
  // The nearest heading *unit* enclosing each line, which is not the same as its
  // host: a heading may open a region without materializing a unit. Kept apart
  // from hostIDAtLine because that value decides where a declaration sits, and
  // widening it would move citations rather than only digests.
  digestHostIDAtLine := make([]string, len(lines))
  currentDigestHostID := fileUnitID
  currentHost := "file"
  currentHostID := fileUnitID
  lexical, commentSpans := scanMarkdownRegions(content, lines)
  headingUnitIDs := [5]string{}
  for index := range lines {
    visible := lexical[index].Heading
    level, title, ok := markdownHeading(visible)
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

  reportUnreadableMarkdownTags(inventory, address.Display, lexical)

  sequence := 0
  for _, match := range commentSpans {
    commentStart := match[0]
    line := lineAt(content, commentStart)
    if line <= 0 || line > len(lines) {
      continue
    }
    // `<!-->` and `<!--->` are complete comments with no body, so their closing
    // marker overlaps their opening one and there is nothing to parse.
    bodyStart, bodyEnd := match[0]+4, match[1]-3
    if bodyEnd < bodyStart {
      continue
    }
    comment := content[bodyStart:bodyEnd]
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
  assignMarkdownDigests(inventory, content, lines, digestHostIDAtLine, commentSpans)
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
// The text cut out of every digest is exactly what the declaration scan reads
// as a tag position: each closed HTML comment outside code and rendered
// examples. The shared lexical scan records exact original-byte spans, so a
// span may open after prose, close before prose, or run
// across lines, and it may not be a whole line. Cutting spans rather than lines
// keeps the prose beside a comment in the digest, so a content change there
// still expires a review, while writing the review changes nothing it is
// checked against. A `<!--` that never closes matches no span, is read as no
// tag, and so stays content.
//
// A line left holding nothing but comment spans is dropped, and so is the one
// blank line after it when a blank line stood before it. A comment written as a
// paragraph of its own is set off by blank lines on both sides, and keeping
// both would let adding or removing the comment add or remove a blank line of
// the unit it sits in, which is the tag position changing the digest after all.
func assignMarkdownDigests(
  inventory *artifactInventory,
  content string,
  lines []string,
  digestHostIDAtLine []string,
  spans [][2]int,
) {
  owned := map[string][]string{}
  next := 0
  lineStart := 0
  // Whether the last line kept was blank, and whether the blank line that
  // follows a dropped comment paragraph is the second of its pair.
  keptBlank := false
  dropBlank := false
  for index, rawLine := range lines {
    lineEnd := lineStart + len(rawLine)
    id := digestHostIDAtLine[index]
    for next < len(spans) && spans[next][1] <= lineStart {
      next++
    }
    remainder := strings.Builder{}
    cursor := lineStart
    cut := false
    for k := next; k < len(spans) && spans[k][0] < lineEnd; k++ {
      cut = true
      if spans[k][0] > cursor {
        remainder.WriteString(content[cursor:spans[k][0]])
      }
      cursor = max(cursor, min(spans[k][1], lineEnd))
    }
    if cursor < lineEnd {
      remainder.WriteString(content[cursor:lineEnd])
    }
    lineStart = lineEnd + 1
    text := strings.TrimSuffix(remainder.String(), "\r")
    if id == "" {
      continue
    }
    blank := strings.TrimSpace(text) == ""
    // A line holding nothing but comment spans is a tag position, not content.
    if cut && blank {
      dropBlank = keptBlank
      continue
    }
    if blank && dropBlank {
      dropBlank = false
      continue
    }
    dropBlank = false
    keptBlank = blank
    owned[id] = append(owned[id], text)
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
// the same case in another spelling. The maintained CommonMark parser decides
// indentation relative to the enclosing list and quote containers. Inline code,
// escaped delimiters and the supported HTML/MDX example carriers stay silent
// under the same lexical classification used by headings and metadata.
//
// The tag has to open its line, which is the discrimination every reader in
// this package performs, so a sentence mentioning one describes it rather than
// declaring it.
func reportUnreadableMarkdownTags(
  inventory *artifactInventory,
  location string,
  lexical []markdownLexicalLine,
) {
  if inventory == nil {
    return
  }
  for index, line := range lexical {
    trimmed := markdownLineContent(line.Prose)
    if tag, _, found := declarationLine(trimmed); found {
      inventory.Unreadable = append(inventory.Unreadable, unreadableMarkdownProblem("@"+string(tag), location, index+1))
      continue
    }
    if reviews, _, opened := reviewLine(trimmed); opened {
      inventory.Unreadable = append(inventory.Unreadable, unreadableMarkdownProblem(reviewMarkerFor(reviews), location, index+1))
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
