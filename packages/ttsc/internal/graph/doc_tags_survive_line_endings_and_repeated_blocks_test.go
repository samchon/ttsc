package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDocTagsSurviveLineEndingsAndRepeatedBlocks verifies the boundary cases
// where one declaration's tags can be silently lost or doubled.
//
// Each is invisible when wrong. A CRLF checkout that joined a reason
// differently would make the same source produce different index entries on
// Windows and POSIX, so a citation found on one machine would be missing on the
// other. A merged identity declared twice keeps whichever declarations the walk
// reached, and a `var` redeclaration is the one shape where the same identity
// carries two documentation blocks that both have to survive. A link written
// with trailing text inside its braces is reassembled from two fields, so the
// text can be dropped without the target changing.
//
//  1. Build a fixture with CRLF sources, a redeclared `var` documented twice, a
//     multi-binding statement, a declaration carrying two documentation blocks,
//     and a link carrying trailing text.
//  2. Assert the CRLF reason joins exactly as its LF twin does.
//  3. Assert both blocks of the merged identity are kept, every binding of the
//     statement carries its documentation, and the link keeps its text.
func TestDocTagsSurviveLineEndingsAndRepeatedBlocks(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)

  lf := `export interface ISale {
  price: number;
}

/**
 * Renders it.
 *
 * @evidence docs/a.md#reason States the limit
 *           this section defines.
 */
export function joined(): void {}

/** @evidence {@link ISale the sale contract} And prose after it. */
export function linkText(): void {}

/** @evidence docs/a.md#first The first declaration. */
export var merged: number;
/** @evidence docs/a.md#second The second declaration. */
export var merged: number;

/** @evidence docs/a.md#shared Documents the whole statement. */
export var first = 1,
  second = 2;

/** @evidence docs/a.md#one First block. */
/** @evidence docs/a.md#two Second block on the same declaration. */
export function twoBlocks(): void {}
`
  // The shared fixture config names one root, and the CRLF twin has to be the
  // same declarations rather than a second set, so the two spellings compile as
  // two projects instead of two files of one.
  writeFile(t, filepath.Join(root, "src", "main.ts"), lf)
  crlfRoot := t.TempDir()
  writeFile(t, filepath.Join(crlfRoot, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(crlfRoot, "src", "main.ts"),
    strings.ReplaceAll(strings.ReplaceAll(lf, "\r\n", "\n"), "\n", "\r\n"))

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  crlfProg, crlfDiags, err := driver.LoadProgram(crlfRoot, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(crlfDiags) != 0 {
    t.Fatalf("unexpected CRLF diagnostics: %v", crlfDiags)
  }
  defer func() { _ = crlfProg.Close() }()

  byRoot := map[string]map[string][]*DocTag{
    "LF":   docTagsByTargetSuffix(Build(prog)),
    "CRLF": docTagsByTargetSuffix(Build(crlfProg)),
  }

  // A reason written across two comment lines is one string, under both
  // spellings of a line terminator.
  for spelling, tags := range byRoot {
    assertDocTagIn(t, tags, spelling, "#joined:function", "evidence",
      "docs/a.md#reason States the limit this section defines.")
    assertDocTagIn(t, tags, spelling, "#linkText:function", "evidence",
      "{@link ISale the sale contract} And prose after it.")
    // Both declarations of one identity contribute: collecting inside the
    // node-creation branch would have kept whichever won the display span.
    assertDocTagIn(t, tags, spelling, "#merged:variable", "evidence",
      "docs/a.md#first The first declaration.")
    assertDocTagIn(t, tags, spelling, "#merged:variable", "evidence",
      "docs/a.md#second The second declaration.")
    // One statement documents every binding it declares: the text sits above
    // the statement and nothing in the source assigns it to the first name.
    assertDocTagIn(t, tags, spelling, "#first:variable", "evidence",
      "docs/a.md#shared Documents the whole statement.")
    assertDocTagIn(t, tags, spelling, "#second:variable", "evidence",
      "docs/a.md#shared Documents the whole statement.")
    // TypeScript attaches more than one documentation block to a declaration
    // when more than one is written, and each is a place a tag can sit. Reading
    // only the last would silently drop the first.
    assertDocTagIn(t, tags, spelling, "#twoBlocks:function", "evidence",
      "docs/a.md#one First block.")
    assertDocTagIn(t, tags, spelling, "#twoBlocks:function", "evidence",
      "docs/a.md#two Second block on the same declaration.")
  }
}

// assertDocTagIn fails unless a tag with this name and text sits on the node
// whose id ends with suffix, naming the source spelling in the failure.
func assertDocTagIn(t *testing.T, tags map[string][]*DocTag, spelling, suffix, name, text string) {
  t.Helper()
  for target, list := range tags {
    if !suffixMatch(target, suffix) {
      continue
    }
    for _, tag := range list {
      if tag.Name == name && tag.Text == text {
        return
      }
    }
    t.Fatalf("%s %s carries %s, want @%s %q", spelling, suffix, renderDocTags(list), name, text)
  }
  t.Fatalf("%s %s recorded no tags at all, want @%s %q", spelling, suffix, name, text)
}

func renderDocTags(list []*DocTag) string {
  out := make([]string, 0, len(list))
  for _, tag := range list {
    out = append(out, "@"+tag.Name+" "+tag.Text)
  }
  return "[" + strings.Join(out, " | ") + "]"
}
