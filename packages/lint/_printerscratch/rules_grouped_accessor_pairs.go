// groupedAccessorPairs: a `get` and `set` accessor that share the same
// property name should be declared next to each other, whether they sit
// in a class body or an object literal. When the pair is split apart by
// unrelated members, a reader scanning the declaration has to chase the
// read and write halves separately — and patches to one half are easy to
// make without noticing the other.
//
// AST-only: walk every class declaration/expression and object literal,
// group members by (name, static-ness), and for any group that contains
// both a getter and a setter check that their member indices are
// adjacent. The second-encountered half is the one reported, because the
// first half reads correctly until the reader hits the second
// declaration.
//
// The optional order option (`anyOrder` (the default), `getBeforeSet`, or
// `setBeforeGet`) additionally pins the relative order of an already
// adjacent pair, mirroring upstream's `invalidOrder` diagnostic.
// https://eslint.org/docs/latest/rules/grouped-accessor-pairs
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type groupedAccessorPairs struct{ optionsRule }

func (groupedAccessorPairs) Name() string { return "grouped-accessor-pairs" }
func (groupedAccessorPairs) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindClassDeclaration,
    shimast.KindClassExpression,
    shimast.KindObjectLiteralExpression,
  }
}
func (groupedAccessorPairs) Check(ctx *Context, node *shimast.Node) {
  members := groupedAccessorMembers(node)
  if len(members) < 2 {
    return
  }
  order := groupedAccessorOrder(ctx)

  type slot struct {
    name   string
    static bool
  }
  type entry struct {
    index int
    kind  shimast.Kind
    node  *shimast.Node
  }
  // Track first-seen group order so multiple pairs report deterministically;
  // a Go map's iteration order is randomized.
  groups := map[slot]*[]entry{}
  var groupOrder []slot
  for i, member := range members {
    if member == nil {
      continue
    }
    if member.Kind != shimast.KindGetAccessor && member.Kind != shimast.KindSetAccessor {
      continue
    }
    name := classMemberName(member)
    if name == "" {
      continue
    }
    key := slot{name: name, static: hasModifier(member, shimast.KindStaticKeyword)}
    if groups[key] == nil {
      groups[key] = &[]entry{}
      groupOrder = append(groupOrder, key)
    }
    *groups[key] = append(*groups[key], entry{index: i, kind: member.Kind, node: member})
  }
  for _, key := range groupOrder {
    entries := *groups[key]
    if len(entries) < 2 {
      continue
    }
    // Find a getter/setter pair within the group.
    var get, set *entry
    for i := range entries {
      e := &entries[i]
      if e.kind == shimast.KindGetAccessor && get == nil {
        get = e
      } else if e.kind == shimast.KindSetAccessor && set == nil {
        set = e
      }
    }
    if get == nil || set == nil {
      continue
    }
    former, later := get, set
    if set.index < get.index {
      former, later = set, get
    }
    // Non-adjacent indices in the members list break the rule.
    if later.index-former.index > 1 {
      // Report on whichever half appears later — the earlier one
      // reads fine in isolation; the later one is the surprise.
      ctx.Report(later.node, "Accessor pair should be grouped.")
      continue
    }
    // The pair is adjacent; enforce the requested order, if any.
    if (order == "getBeforeSet" && former.kind == shimast.KindSetAccessor) ||
      (order == "setBeforeGet" && former.kind == shimast.KindGetAccessor) {
      ctx.Report(later.node, "Expected "+accessorRole(later.kind)+" to be before "+accessorRole(former.kind)+".")
    }
  }
}

// groupedAccessorMembers returns the ordered member list the rule scans for
// a class body (its members) or an object literal (its properties). Any
// other node kind yields nil so the multi-visit rule can bail cheaply.
func groupedAccessorMembers(node *shimast.Node) []*shimast.Node {
  if node != nil && node.Kind == shimast.KindObjectLiteralExpression {
    if obj := node.AsObjectLiteralExpression(); obj != nil && obj.Properties != nil {
      return obj.Properties.Nodes
    }
    return nil
  }
  return classMembers(node)
}

// groupedAccessorOrder resolves the positional order option. A single
// positional slot is transported as a bare JSON string (see
// RuleOptionsMap); any unknown or absent value falls back to `anyOrder`,
// which disables the ordering check.
func groupedAccessorOrder(ctx *Context) string {
  var order string
  _ = ctx.DecodeOptions(&order)
  switch order {
  case "getBeforeSet", "setBeforeGet":
    return order
  default:
    return "anyOrder"
  }
}

// accessorRole names an accessor half for the `invalidOrder` message.
func accessorRole(kind shimast.Kind) string {
  if kind == shimast.KindSetAccessor {
    return "setter"
  }
  return "getter"
}

func init() {
  Register(groupedAccessorPairs{})
}
