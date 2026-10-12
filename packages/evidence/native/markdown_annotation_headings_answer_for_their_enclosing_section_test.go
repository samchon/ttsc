package evidence

import (
  "strings"
  "testing"
)

// annotationSceneConfig is a Markdown checklist claim: every H2 scene of the
// novel answers every H2 principle.
const annotationSceneConfig = `{"claims":[{
  "type":"markdown",
  "files":["docs/novel.md"],
  "symbol":"h2",
  "reference":{"type":"markdown","files":["docs/principles.md"],"symbol":"h2","checklist":true}
}]}`

const annotationScenePrinciples = "# Principles\n\n## Show {#show}\n\nShow, do not tell.\n\n## Pace {#pace}\n\nKeep the pace.\n"

/**
 * TestMarkdownAnnotationHeadingsAnswerForTheirEnclosingSection verifies a
 * visible annotation heading answers for the section it is nested in.
 *
 * A checklist claim over H2 scenes owes every principle from every scene.
 * Written as `### @evidence` under a scene, with the explanation below and an
 * ordinary deeper heading inside it, each answer must count for that scene and
 * not create a unit of its own: otherwise a claim selecting `h2` would refuse
 * it as out of scope and the scene would still owe the item.
 *
 *  1. Answer both principles from both scenes with H3 citation and exclusion
 *     sections, one holding an H4 detail.
 *  2. Require the graph to pass.
 *  3. Remove one scene's answer and require that scene alone to owe it.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs graphRule.Check over a Markdown checklist claim whose two H2 scenes answer two principles through visible H3 `@evidence` and `@evidenceExclude` sections; the case asserts no diagnostics, then removes scene two's pace section and asserts one checklist finding naming `docs/principles.md#pace`.
 * @evidence contracts/testing.md#independent-expectations The ownership rule says an annotation belongs to the nearest shallower heading, so each H3 section answers its H2 scene; the checklist contract then owes every principle from every scene, which fixes both the passing result and the single missing item.
 * @evidence contracts/testing.md#distinguishing-cases Citation versus exclusion sections, a deeper ordinary heading inside an explanation, two scenes sharing targets, and the negative control that differs only by one removed section; out-of-scope hosting and other owners are owned by the ownership entry.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownAnnotationHeadingsAnswerForTheirEnclosingSection is a native Go unit entry; runIndexRule writes temporary fixtures and calls the graph rule in-process without an installed consumer or product host.
 */
func TestMarkdownAnnotationHeadingsAnswerForTheirEnclosingSection(t *testing.T) {
  pace := "### @evidence docs/principles.md#pace\n\nCuts the dialogue short.\n"
  novel := "# Novel\n\n" +
    "## Scene one {#scene-one}\n\nThe storm arrives.\n\n" +
    "### @evidence docs/principles.md#show\n\nShows the storm through the wet sleeves.\n\n" +
    "### @evidenceExclude docs/principles.md#pace\n\nA one-line scene has no pace to keep.\n\n" +
    "## Scene two {#scene-two}\n\nThe hand trembles.\n\n" +
    "### @evidence docs/principles.md#show\n\nShows fear through the trembling hand.\n\n#### Detail\n\nThe hand appears twice.\n\n" +
    pace
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/principles.md": annotationScenePrinciples,
    "docs/novel.md":      novel,
  }, annotationSceneConfig))

  messages := runIndexRule(t, map[string]string{
    "docs/principles.md": annotationScenePrinciples,
    "docs/novel.md":      strings.Replace(novel, pace, "", 1),
  }, annotationSceneConfig)
  assertReported(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/principles.md#pace'")
  assertProblemContains(t, messages, "Scene two")
}
