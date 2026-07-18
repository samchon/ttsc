package graph

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// collectLiterals records the value set of every type alias and enum in file
// whose declared type resolves to literals, so a consumer asking what values a
// type admits is answered from the checker rather than from the declaration's
// source text.
//
// It runs on the checker for the reason markExports does: the syntactic reading
// is not the real answer. A union's members are only spelled out at the
// declaration when nothing indirects — `type Indirect = Kind | 'f'` names one
// literal and reaches five more through an alias, and only the checker has
// resolved that. It has also already flattened nested unions, dropped
// duplicates, and reduced subtypes, so the constituents it hands back are the
// type's members exactly once each.
//
// Enums come here too, and they need it more. An enum's members are not nodes
// of their own — the build pass records member nodes for classes and interfaces
// only — so its node is the only place anything about them can ride. It carries
// two facts, and they are not the same fact: the value set the enum admits,
// deduped because a type is a set, and the members it declares, which is the
// list a caller writes from and which nothing folds.
func (g *Graph) collectLiterals(checker *shimchecker.Checker, file *shimast.SourceFile) {
  if file.Statements == nil {
    return
  }
  g.collectLiteralsIn(checker, file.FileName(), file.Statements.Nodes)
}

// collectLiteralsIn walks a statement list — a file's top level, or a namespace
// body it recurses into — and records the value set of each type alias and enum
// it holds. It mirrors collectStatements' descent so a `namespace X { type K =
// … }` is resolved on the node the build pass keyed by its qualified name.
func (g *Graph) collectLiteralsIn(checker *shimchecker.Checker, path string, statements []*shimast.Node) {
  for _, statement := range statements {
    switch statement.Kind {
    case shimast.KindTypeAliasDeclaration:
      g.putLiterals(checker, path, statement, NodeTypeAlias)
    case shimast.KindEnumDeclaration:
      g.putLiterals(checker, path, statement, NodeEnum)
    case shimast.KindModuleDeclaration:
      g.collectLiteralsIn(checker, path, moduleStatements(statement))
    }
  }
}

// putLiterals resolves the declared type of statement's symbol and records its
// value set on the node the build pass recorded for it. A declaration the graph
// does not hold a node for, or whose type has no complete literal answer, is
// left alone rather than given a partial one.
func (g *Graph) putLiterals(checker *shimchecker.Checker, path string, statement *shimast.Node, kind NodeKind) {
  symbol := statement.Symbol()
  if symbol == nil || symbol.Name == "" {
    return
  }
  node, ok := g.Nodes[nodeID(path, qualifiedName(symbol), kind)]
  if !ok {
    return
  }
  declared := shimchecker.Checker_getDeclaredTypeOfSymbol(checker, symbol)
  if declared == nil {
    return
  }
  if values, ok := literalValues(declared); ok {
    node.Literals = values
  }
  if kind == NodeEnum {
    node.EnumMembers = enumMembers(checker, statement)
  }
}

// enumMembers pairs each member an enum declares with the value it carries.
//
// The names are the half a caller writes. `literals` answers which values the
// enum admits, the question a serializer asks, but the code says `Colors.Red`
// and never `"red"` — so an enum whose node the graph already held still sent a
// caller to the file to learn what to type (#738).
//
// The list comes from the declaration, not from the declared type's
// constituents, and that is not a detail. A type is a set, so the checker folds
// two members carrying one value into one constituent: `enum Dup { A = 'x', B =
// 'x' }` resolves to a single type, and reading names off it reports `A` and
// loses `B` — the same silent under-report as #732, out of the same instinct to
// take a declaration fact from a type. The value set really is one value, which
// is why `literals` is right to say `"x"` once; the member list is two members,
// and only the declaration says so.
//
// Each member's value still comes from the checker, per member, so an implicit
// `First` reports 0 with nothing reading the source. A member the checker
// cannot fold to a constant keeps its name and drops its value, because the
// name is the part this is for.
func enumMembers(checker *shimchecker.Checker, statement *shimast.Node) []EnumMember {
  declaration := statement.AsEnumDeclaration()
  if declaration == nil || declaration.Members == nil {
    return nil
  }
  out := make([]EnumMember, 0, len(declaration.Members.Nodes))
  for _, node := range declaration.Members.Nodes {
    symbol := node.Symbol()
    if symbol == nil || symbol.Name == "" {
      continue
    }
    member := EnumMember{Name: symbol.Name}
    if t := shimchecker.Checker_getTypeOfSymbol(checker, symbol); t != nil {
      if value, ok := literalValue(t); ok {
        member.Value = value
      }
    }
    out = append(out, member)
  }
  if len(out) == 0 {
    return nil
  }
  return out
}

// literalValues renders every constituent of t in TypeScript source form,
// reporting false unless all of them are enumerable.
//
// All-or-nothing is the contract. `type T = Kind | number` admits five literals
// and every other number besides; answering with the five would describe a type
// that does not exist, and the caller cannot tell that answer from a complete
// one. So a type whose members cannot all be named yields no list, and its
// signature carries the shape instead.
func literalValues(t *shimchecker.Type) ([]string, bool) {
  // Types() panics on anything that is not a union, an intersection, or a
  // template literal, so the flag test is what makes the union branch safe. A
  // single-literal alias (`type One = 'a'`) is not a union and is its own only
  // constituent.
  constituents := []*shimchecker.Type{t}
  if t.Flags()&shimchecker.TypeFlagsUnion != 0 {
    constituents = t.Types()
  }
  values := make([]string, 0, len(constituents))
  for _, constituent := range constituents {
    value, ok := literalValue(constituent)
    if !ok {
      return nil, false
    }
    values = append(values, value)
  }
  if len(values) == 0 {
    return nil, false
  }
  return values, true
}

// literalValue renders one constituent in TypeScript source form, reporting
// false when it names no single value a caller could write.
func literalValue(t *shimchecker.Type) (string, bool) {
  flags := t.Flags()
  switch {
  case flags&shimchecker.TypeFlagsNull != 0:
    return "null", true
  case flags&shimchecker.TypeFlagsUndefined != 0:
    return "undefined", true
  case flags&shimchecker.TypeFlagsLiteral != 0:
    // TypeFlagsLiteral covers an enum member too: EnumLiteral is always paired
    // with StringLiteral or NumberLiteral on a member, and with Union on the
    // enum type itself, which the union branch above has already opened.
    value := t.AsLiteralType().Value()
    if value == nil {
      // A computed enum member the checker could not fold to a constant. It has
      // a value at runtime that nothing here can name, so the enum has no
      // complete answer.
      return "", false
    }
    return shimchecker.ValueToString(value), true
  }
  return "", false
}
