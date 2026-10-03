package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDocTagsReadOnlyWhatTheParserAttached verifies the boundary cases that
// decide whether a tag-shaped run of text is a fact about a declaration.
//
// The authored cases distinguish line-comment exclusion, a mid-sentence parsed
// tag, overload-signature attachment and two reconstructed inline-link forms.
// They do not enumerate every text-scanning algorithm, parser placement rule,
// overload form or link spelling.
//
//  1. Build a fixture with a tag in a line comment, a tag written mid-sentence
//     inside a documentation block, an overload run documented on its
//     signature, and a link tag whose braced form must survive verbatim.
//  2. Assert the line comment contributes nothing and the mid-sentence one is
//     the tag the parser says it is.
//  3. Assert the overload keeps its signature's tag and the link keeps its
//     braces.
//
// @evidence contracts/testing.md#behavioral-verification Verifies the boundary cases that decide whether a tag-shaped run of text is a fact about a declaration.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: a tag in a // comment must produce no tag, a tag written mid-sentence in a documentation block must be recorded with the text after the @evidence word (as TypeScript's parser opens it), an overload run's tag written on its first signature must be kept on the merged node, and a {@link ISale} or {@linkcode ISale} tag text must keep its braces and link keyword verbatim.
// @evidence contracts/testing.md#distinguishing-cases Build a fixture with a tag in a line comment, a tag written mid-sentence inside a documentation block, an overload run documented on its signature, and a link tag whose braced form must survive verbatim; Assert the line comment contributes nothing and the mid-sentence one is the tag the parser says it is; Assert the overload keeps its signature's tag and the link keeps its braces.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its native temporary project, constructs and closes a driver compiler Program in-process, and calls Build. A restored empty linked-plugin manifest excludes ambient hooks; no installed consumer or native product command runs. Literal expected tag texts and target suffixes are authored independently of the collected facts.
func TestDocTagsReadOnlyWhatTheParserAttached(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface ISale {
  price: number;
}

// @evidence docs/a.md#line A line comment is not documentation.
export function fromLineComment(): void {}

/**
 * Explains that an @evidence tag names a document, without being one.
 */
export function fromProse(): void {}

/** @evidence docs/a.md#overload Documented on the signature. */
export function overloaded(value: string): string;
export function overloaded(value: number): string;
export function overloaded(value: string | number): string {
  return String(value);
}

/** @evidence {@link ISale} The contract is mirrored here. */
export function linked(): void {}

/** @evidence {@linkcode ISale} And in code form. */
export function linkedCode(): void {}
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

  // A `//` comment is not documentation, so the parser attaches it to nothing
  // and no tag can be read out of it.
  for target, list := range tags {
    if suffixMatch(target, "#fromLineComment:function") && len(list) > 0 {
      t.Fatalf("line comment produced %d tags; only a documentation block attaches one", len(list))
    }
  }

  // The authored mid-sentence @evidence is expected as a parser-attached tag.
  // This fixture does not certify every @ placement. It is not second-
  // guessed: the population is "what the parser could not interpret", and a
  // graph that re-decided where a tag may begin would be reinterpreting the
  // compiler rather than reporting it. A convention that wants the stricter
  // rule — the tag must open its line — enforces that in its own rule, where the
  // author gets a diagnostic; here the fact is simply reported as parsed.
  assertDocTag(t, tags, "#fromProse:function", "evidence",
    "tag names a document, without being one.")

  // The implementation signature carries no block of its own. Collecting tags
  // outside the node-creation branch is what keeps the overload run's
  // documentation, which is written on the first signature.
  assertDocTag(t, tags, "#overloaded:function", "evidence",
    "docs/a.md#overload Documented on the signature.")

  // A citation target is matched by the token the author wrote, so the braces
  // and the link keyword have to survive the round trip through the AST.
  assertDocTag(t, tags, "#linked:function", "evidence",
    "{@link ISale} The contract is mirrored here.")
  assertDocTag(t, tags, "#linkedCode:function", "evidence",
    "{@linkcode ISale} And in code form.")
}
