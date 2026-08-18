package graph

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// DocTag is one documentation tag TypeScript itself does not recognize, written
// on a workspace declaration and captured verbatim.
//
// A convention attaches a declaration to something outside the type system — a
// specification section, an API operation, a reference document — and writes
// that attachment as a tag. `@evidence docs/pricing.md#sale`, `@reference
// https://…`, and a consumer's own `@spec` are the same fact in three
// spellings, and none of them is expressible as an edge because the thing on
// the other end is not a TypeScript declaration.
//
// The population is defined by the compiler rather than by us: these are the
// tags the parser had no meaning for, so it kept them as
// KindJSDocUnknownTag. A known tag — `@param`, `@returns`, `@deprecated` — has
// its own AST shape and its own meaning and is not this. Naming particular tags
// here would make the compiler host know one convention, and would have left
// out the 767 `@reference` tags this repository's own sources carry.
//
// Nothing is interpreted. Target is not split out of Text, because which part
// of a tag's text names a thing is a convention's rule and this pass enforces
// none; a consumer that ranks on a leading token does so in the layer that
// declares its selection heuristic. This is the contract Decorator already
// keeps for `@Controller`/`@Get`.
type DocTag struct {
  // Target is the id of the graph node the tag was written on.
  Target string
  // Name is the tag name without its `@` (`evidence`, `evidenceExclude`,
  // `reference`).
  Name string
  // Text is everything after the tag name, with the comment's leading asterisks
  // and per-line indentation removed and its lines joined by single spaces.
  // Empty when the tag carries no text.
  Text string
  File string
  Pos  int
  End  int
}

// collectDocTags records a DocTag for every unrecognized documentation tag on
// declaration, attributed to the graph node identified by targetID.
//
// It runs from putDeclaredNode rather than from a pass of its own, so every
// declaration form the build records — a function, a class, an interface member,
// a variable binding, a closure, a namespace member — carries its tags without
// each form having to remember to ask. A merged identity therefore accumulates
// the tags of every declaration that names it: an overload run documented on its
// signature and implemented below keeps the signature's tags, which putting this
// inside the node-creation branch would have dropped.
//
// Positions deduplicate, because the same declaration node can be presented to
// putDeclaredNode more than once and a tag is a property of where it is written.
func collectDocTags(g *Graph, targetID, path string, declaration *shimast.Node) {
  if g == nil || declaration == nil || targetID == "" {
    return
  }
  file := shimast.GetSourceFileOfNode(declaration)
  if file == nil {
    return
  }
  docs := documentationOf(declaration, file)
  if len(docs) > 0 {
    g.recordDocHost(targetID, declaration)
  }
  for _, doc := range docs {
    if doc == nil || doc.Kind != shimast.KindJSDoc {
      continue
    }
    comment := doc.AsJSDoc()
    if comment == nil || comment.Tags == nil {
      continue
    }
    for _, tag := range comment.Tags.Nodes {
      fact := docTagFact(tag)
      if fact == nil {
        continue
      }
      fact.Target = targetID
      fact.File = path
      if g.docTagPositions == nil {
        g.docTagPositions = map[docTagKey]struct{}{}
      }
      key := docTagKey{target: targetID, pos: fact.Pos, end: fact.End}
      if _, seen := g.docTagPositions[key]; seen {
        continue
      }
      g.docTagPositions[key] = struct{}{}
      g.DocTags = append(g.DocTags, fact)
    }
  }
}

// documentationOf returns the documentation blocks that describe declaration.
//
// A variable's block is the one place the node the graph records and the node
// the parser attached the documentation to are different. TypeScript attaches
// one leading block to the variable *statement*, while the graph records a node
// per binding, so asking the binding directly finds nothing and every citation
// written on a `const` was lost. The statement is reached through its
// declaration list, and both hops are checked rather than assumed.
//
// One statement can declare several bindings (`export const a = 1, b = 2`), and
// then its block genuinely documents all of them: the text is above the
// statement, and nothing in the source says it belongs to the first binding
// only. Each binding's node therefore carries it, which is the same answer the
// evidence host model reaches from the other direction.
//
// The walk stops there. A binding element inside a destructuring pattern is
// given no documentation by the parser, so climbing further would invent an
// association the source does not make.
func documentationOf(declaration *shimast.Node, file *shimast.SourceFile) []*shimast.Node {
  if docs := declaration.JSDoc(file); len(docs) > 0 {
    return docs
  }
  if declaration.Kind != shimast.KindVariableDeclaration {
    return nil
  }
  list := declaration.Parent
  if list == nil || list.Kind != shimast.KindVariableDeclarationList {
    return nil
  }
  statement := list.Parent
  if statement == nil || statement.Kind != shimast.KindVariableStatement {
    return nil
  }
  return statement.JSDoc(file)
}

// docTagKey identifies one written tag on one target, so a declaration visited
// twice contributes its tags once.
type docTagKey struct {
  target string
  pos    int
  end    int
}

// docTagFact reads one tag node into a DocTag, or nil when the tag is one
// TypeScript recognizes or carries no usable name.
func docTagFact(tag *shimast.Node) *DocTag {
  if tag == nil || tag.Kind != shimast.KindJSDocUnknownTag {
    return nil
  }
  unknown := tag.AsJSDocUnknownTag()
  if unknown == nil || unknown.TagName == nil {
    return nil
  }
  name := unknown.TagName.Text()
  if name == "" {
    return nil
  }
  return &DocTag{
    Name: name,
    Text: docTagText(unknown.Comment),
    Pos:  tag.Pos(),
    End:  tag.End(),
  }
}

// docTagText renders a tag's comment list as one line.
//
// A tag's text is a list of comment nodes: plain text runs, and link nodes for
// `{@link Foo}` and its two variants. The link nodes are rendered back to the
// braced form they were written in, because a consumer matching a citation
// target has to see the target as the author wrote it — and because the same
// link is separately available as a resolved edge, so dropping the text here
// would leave the two halves unable to be read together.
//
// Lines join with single spaces. A documentation comment carries its own
// leading asterisks and indentation on every line after the first, and neither
// is content; joining on a space is also what makes a reason written across
// three lines one string rather than three.
func docTagText(comment *shimast.NodeList) string {
  if comment == nil {
    return ""
  }
  var out strings.Builder
  for _, node := range comment.Nodes {
    if node == nil {
      continue
    }
    switch node.Kind {
    case shimast.KindJSDocLink:
      writeDocTagLink(&out, "{@link ", node)
    case shimast.KindJSDocLinkCode:
      writeDocTagLink(&out, "{@linkcode ", node)
    case shimast.KindJSDocLinkPlain:
      writeDocTagLink(&out, "{@linkplain ", node)
    default:
      out.WriteString(shimast.NodeText(node))
    }
  }
  return joinDocTagLines(out.String())
}

// writeDocTagLink renders one link node back to its written form. The name and
// the trailing text are separate fields on the node, so `{@link A.B rest}` is
// reassembled rather than read off one string.
func writeDocTagLink(out *strings.Builder, opener string, node *shimast.Node) {
  name := ""
  switch node.Kind {
  case shimast.KindJSDocLink:
    if link := node.AsJSDocLink(); link != nil && link.Name() != nil {
      name = shimast.NodeText(link.Name())
    }
  case shimast.KindJSDocLinkCode:
    if link := node.AsJSDocLinkCode(); link != nil && link.Name() != nil {
      name = shimast.NodeText(link.Name())
    }
  case shimast.KindJSDocLinkPlain:
    if link := node.AsJSDocLinkPlain(); link != nil && link.Name() != nil {
      name = shimast.NodeText(link.Name())
    }
  }
  out.WriteString(opener)
  out.WriteString(name)
  text := shimast.NodeText(node)
  if text != "" {
    if name != "" {
      out.WriteString(" ")
    }
    out.WriteString(text)
  }
  out.WriteString("}")
}

// joinDocTagLines collapses a tag's physical lines into one and normalizes the
// whitespace runs a documentation comment adds around them.
//
// strings.Fields splits on every Unicode space, which covers the four
// ECMAScript line terminators - LF, CR, U+2028, U+2029 - so a CRLF checkout and
// an LF one produce the same string, and a reason written across three comment
// lines becomes one.
func joinDocTagLines(text string) string {
  return strings.Join(strings.Fields(text), " ")
}

// collectDocRefs records an edge from each declaration to the symbols its own
// documentation names through an inline link.
//
// The checker resolves such a name and counts it as a use — a `noUnusedLocals`
// project keeps an import that exists only to support a link — so this is a
// compiler fact, not a text match, and it was the one class of resolved
// reference the graph held no edge for. The link node carries an EntityName,
// which is the node class typeRefEdge already resolves, so the resolution and
// the external-boundary and self-reference rules are the existing ones.
//
// Links are read from the whole documentation comment rather than from tags
// alone: a link under `@evidence`, under `@see`, and in ordinary prose are one
// relation, and privileging a tag would put one convention's name inside the
// compiler host.
func (g *Graph) collectDocRefs(checker *shimchecker.Checker, file *shimast.SourceFile) {
  for _, host := range g.docHosts {
    if host.file != file.FileName() {
      continue
    }
    for _, doc := range documentationOf(host.declaration, file) {
      g.docRefsWithin(checker, host.target, doc)
    }
  }
}

// recordDocHost remembers that a declaration carries documentation, so the edge
// pass resolves its links from exactly the declarations the build pass
// attributed documentation to.
//
// The two passes cannot share a walk — one runs before the checker exists and
// the other needs it — so they would otherwise share only a convention, and a
// convention is what drifted. The container walk the edge pass would naturally
// reuse never visits a class, an interface, or a namespace as a node of its
// own: it descends straight into their members. So a link written on a class's
// own documentation resolved to nothing while the tag beside it was indexed,
// and the two halves a reader is meant to compose disagreed exactly where a
// type is documented. Recording the host here means the edge pass covers every
// declaration form the node pass records, including forms nobody has written
// yet.
//
// It also fixes the attribution: the container walk hands a property member's
// subtree to the property *and* to its class, which is deliberate for the
// dependency edges but would make a class's documentation appear to name a
// symbol only its member's documentation mentions.
func (g *Graph) recordDocHost(target string, declaration *shimast.Node) {
  file := shimast.GetSourceFileOfNode(declaration)
  if file == nil {
    return
  }
  key := docTagKey{target: target, pos: declaration.Pos(), end: declaration.End()}
  if g.docHostPositions == nil {
    g.docHostPositions = map[docTagKey]struct{}{}
  }
  if _, seen := g.docHostPositions[key]; seen {
    return
  }
  g.docHostPositions[key] = struct{}{}
  g.docHosts = append(g.docHosts, docHost{
    target:      target,
    file:        file.FileName(),
    declaration: declaration,
  })
}

// docHost is one declaration that carries documentation, paired with the graph
// node the build pass attributed it to.
type docHost struct {
  target      string
  file        string
  declaration *shimast.Node
}

// docRefsWithin resolves every inline link inside one documentation comment.
//
// The walk descends through each tag with ForEachChild rather than reading a
// tag's comment field, because that field lives on a per-kind struct: a
// type-asserted read crashes on the first `@param` it meets, and a switch over
// the kinds that carry one would cover the thirty tag shapes TypeScript models
// only until it missed one. Every tag node visits its own comment list, so one
// recursion reaches a link under `@evidence`, under `@see`, and under whatever
// tag a consumer invents, which is the rule this edge is defined by.
//
// The JSDoc node itself reports no children, so its prose comment is walked
// explicitly beside the tags; that is the same reason the existing edge passes
// never reached a link.
func (g *Graph) docRefsWithin(checker *shimchecker.Checker, from string, doc *shimast.Node) {
  comment := doc.AsJSDoc()
  if comment == nil {
    return
  }
  g.docRefsInComment(checker, from, comment.Comment)
  if comment.Tags == nil {
    return
  }
  for _, tag := range comment.Tags.Nodes {
    g.docRefsInSubtree(checker, from, tag)
  }
}

// docRefsInSubtree resolves the links anywhere under one documentation node.
func (g *Graph) docRefsInSubtree(checker *shimchecker.Checker, from string, node *shimast.Node) {
  if node == nil {
    return
  }
  if name := docLinkName(node); name != nil {
    g.docRefEdge(checker, from, name)
    // A link's own subtree is the name just resolved; descending would resolve
    // it a second time under a different node.
    return
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    g.docRefsInSubtree(checker, from, child)
    return false
  })
}

// docRefsInComment resolves the link nodes in one comment list.
func (g *Graph) docRefsInComment(checker *shimchecker.Checker, from string, comment *shimast.NodeList) {
  if comment == nil {
    return
  }
  for _, node := range comment.Nodes {
    g.docRefsInSubtree(checker, from, node)
  }
}

// docLinkName returns the entity name a link node points at, or nil for a
// comment node that is not a link or a link that names nothing — `{@link}` with
// only text is a formatting choice, not a reference.
func docLinkName(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindJSDocLink:
    if link := node.AsJSDocLink(); link != nil {
      return link.Name()
    }
  case shimast.KindJSDocLinkCode:
    if link := node.AsJSDocLinkCode(); link != nil {
      return link.Name()
    }
  case shimast.KindJSDocLinkPlain:
    if link := node.AsJSDocLinkPlain(); link != nil {
      return link.Name()
    }
  }
  return nil
}

// docRefEdge resolves one link name to its declaration and records the edge,
// skipping an unresolved name and a self-reference exactly as typeRefEdge does.
func (g *Graph) docRefEdge(checker *shimchecker.Checker, from string, name *shimast.Node) {
  target := g.resolve(checker, name)
  if target == nil || target.Symbol == nil {
    return
  }
  to := g.ensureTargetNode(target)
  if to == "" || to == from {
    return
  }
  g.addEdgeAt(from, to, EdgeDocRef, "", name.Pos(), name.End())
}
