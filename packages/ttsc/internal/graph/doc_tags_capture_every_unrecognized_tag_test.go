package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDocTagsCaptureEveryUnrecognizedTag verifies that the build pass records a
// DocTag for each documentation tag TypeScript does not recognize, on every
// declaration form, and records nothing for the tags it does.
//
// The population boundary is the whole design: naming particular tags would make
// the compiler host know one convention, so the pass collects exactly what the
// parser could not interpret. That makes the known-tag half of this test
// load-bearing rather than incidental — if `@param` ever arrived here, the field
// would silently become a second, worse copy of facts the AST already models.
//
//  1. Build a fixture whose declarations carry convention tags, known tags, a
//     tag with no text, and a multi-line reason, across a function, a class, a
//     class member, an interface member, a variable, and a namespace member.
//  2. Assert every unrecognized tag is recorded on its own declaration's node.
//  3. Assert no known tag is recorded, and that an untagged declaration
//     contributes nothing.
func TestDocTagsCaptureEveryUnrecognizedTag(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `/**
 * Renders the notice.
 *
 * @evidence docs/discount.md#coupon-stacking States the per-issuer limit
 *           this section defines, in the buyer's words.
 * @evidenceExclude prisma:Coupon.issuedAt Not surfaced here.
 * @param unused Ignored by the graph.
 * @returns Nothing the graph records.
 */
export function renderNotice(): string {
  return "notice";
}

/** @reference https://example.com/spec Reference document. */
export class Notice {
  /** @evidence docs/discount.md#member Member-level citation. */
  public render(): void {}

  /** @spec invented Any convention is one fact. */
  public flag: boolean = false;
}

export interface INotice {
  /** @evidence docs/discount.md#signature Interface member citation. */
  render(): void;
}

/** @evidence docs/discount.md#variable Variable citation. */
export const NOTICE_KIND = "notice";

export namespace Shopping {
  /** @evidence docs/discount.md#namespace Namespace member citation. */
  export function inner(): void {}
}

/** Ordinary documentation with no tag at all. */
export function untagged(): void {}

/** @bare */
export function bareTag(): void {}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  tags := docTagsByTargetSuffix(Build(prog))

  assertDocTag(t, tags, "#renderNotice:function", "evidence",
    "docs/discount.md#coupon-stacking States the per-issuer limit this section defines, in the buyer's words.")
  assertDocTag(t, tags, "#renderNotice:function", "evidenceExclude",
    "prisma:Coupon.issuedAt Not surfaced here.")
  assertDocTag(t, tags, "#Notice:class", "reference",
    "https://example.com/spec Reference document.")
  assertDocTag(t, tags, "#Notice.render:method", "evidence",
    "docs/discount.md#member Member-level citation.")
  assertDocTag(t, tags, "#Notice.flag:variable", "spec",
    "invented Any convention is one fact.")
  assertDocTag(t, tags, "#INotice.render:method", "evidence",
    "docs/discount.md#signature Interface member citation.")
  assertDocTag(t, tags, "#NOTICE_KIND:variable", "evidence",
    "docs/discount.md#variable Variable citation.")
  assertDocTag(t, tags, "#Shopping.inner:function", "evidence",
    "docs/discount.md#namespace Namespace member citation.")
  // A tag with a name and no text is a written fact; dropping it would report
  // the declaration as carrying nothing, which is a different claim.
  assertDocTag(t, tags, "#bareTag:function", "bare", "")

  for _, known := range []string{"param", "returns"} {
    for target, list := range tags {
      for _, tag := range list {
        if tag.Name == known {
          t.Fatalf("recorded known tag %q on %s; only tags the parser could not interpret belong here", known, target)
        }
      }
    }
  }
  for target, list := range tags {
    if suffixMatch(target, "#untagged:function") && len(list) > 0 {
      t.Fatalf("untagged declaration carries %d tags", len(list))
    }
  }
}

// docTagsByTargetSuffix groups a built graph's tags by their target node id.
func docTagsByTargetSuffix(g *Graph) map[string][]*DocTag {
  out := map[string][]*DocTag{}
  for _, tag := range g.DocTags {
    out[tag.Target] = append(out[tag.Target], tag)
  }
  return out
}

// assertDocTag fails unless exactly one tag with this name sits on the node
// whose id ends with suffix, carrying text.
func assertDocTag(t *testing.T, tags map[string][]*DocTag, suffix, name, text string) {
  t.Helper()
  found := 0
  for target, list := range tags {
    if !suffixMatch(target, suffix) {
      continue
    }
    for _, tag := range list {
      if tag.Name != name {
        continue
      }
      found++
      if tag.Text != text {
        t.Fatalf("%s @%s text = %q, want %q", suffix, name, tag.Text, text)
      }
    }
  }
  if found != 1 {
    t.Fatalf("%s @%s recorded %d times, want 1", suffix, name, found)
  }
}

func suffixMatch(value, suffix string) bool {
  return len(value) >= len(suffix) && value[len(value)-len(suffix):] == suffix
}
