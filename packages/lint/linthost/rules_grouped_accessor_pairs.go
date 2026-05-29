// groupedAccessorPairs: a `get` and `set` accessor that share the same
// property name should be declared next to each other in the class
// body. When the pair is split apart by unrelated members, a reader
// scanning the class has to chase the read and write halves separately
// — and patches to one half are easy to make without noticing the
// other.
//
// AST-only: walk every class declaration/expression, group members by
// (name, static-ness), and for any group that contains both a getter
// and a setter check that their member indices are adjacent. The
// second-encountered half is the one reported, because the first half
// reads correctly until the reader hits the second declaration.
// https://eslint.org/docs/latest/rules/grouped-accessor-pairs
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type groupedAccessorPairs struct{}

func (groupedAccessorPairs) Name() string { return "grouped-accessor-pairs" }
func (groupedAccessorPairs) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindClassDeclaration, shimast.KindClassExpression}
}
func (groupedAccessorPairs) Check(ctx *Context, node *shimast.Node) {
  members := classMembers(node)
  if len(members) < 2 {
    return
  }
  type slot struct {
    name   string
    static bool
  }
  type entry struct {
    index int
    kind  shimast.Kind
    node  *shimast.Node
  }
  groups := map[slot][]entry{}
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
    groups[key] = append(groups[key], entry{index: i, kind: member.Kind, node: member})
  }
  for _, entries := range groups {
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
    // Adjacent indices in the members list satisfy the rule.
    diff := get.index - set.index
    if diff == 1 || diff == -1 {
      continue
    }
    // Report on whichever half appears later — the earlier one
    // reads fine in isolation; the later one is the surprise.
    later := get
    if set.index > get.index {
      later = set
    }
    ctx.Report(later.node, "Accessor pair should be grouped.")
  }
}

func init() {
  Register(groupedAccessorPairs{})
}
