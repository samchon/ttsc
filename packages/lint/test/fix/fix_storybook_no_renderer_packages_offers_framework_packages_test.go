package linthost

import (
  "strings"
  "testing"
)

// TestFixStorybookNoRendererPackagesOffersFrameworkPackages verifies
// `storybook/no-renderer-packages` offers the framework packages its own table
// already maps the renderer to, and imposes none of them.
//
// The banned-package table was a map to a list of preferred replacements, and
// the rule discarded the value: it looked the key up with `_, ok :=` and
// reported "use a framework package instead" without saying which. Which one
// is right depends on the project's bundler, which the source does not state,
// so the list becomes titled suggestions rather than an automatic fix, and the
// message names the same set for anyone reading the CLI rather than an editor.
//
//  1. Report an `@storybook/react` import and assert three suggestions, each
//     rewriting the module specifier to one framework package.
//  2. Assert no automatic edit is applied, so `ttsc fix` leaves the import.
//  3. Assert the message renders the set as a disjunction, and that a renderer
//     with a single successor renders without an "or".
//  4. Assert the negative twin `@storybook/react-vite`, already a framework
//     package, reports nothing.
func TestFixStorybookNoRendererPackagesOffersFrameworkPackages(t *testing.T) {
  source := "import type { Meta } from \"@storybook/react\";\nexport default { component: Button };\n"
  _, _, findings := runRuleFindingsSnapshot(t, "storybook/no-renderer-packages", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1 (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if len(finding.Fix) != 0 {
    t.Fatalf("automatic fixes = %d, want 0", len(finding.Fix))
  }
  expectedMessage := "Do not import Storybook renderer packages directly. Use a framework package instead: " +
    "`@storybook/nextjs`, `@storybook/react-vite`, or `@storybook/react-webpack5`."
  if finding.Message != expectedMessage {
    t.Fatalf("message:\nwant %q\ngot  %q", expectedMessage, finding.Message)
  }
  expected := []struct {
    title  string
    result string
  }{
    {
      "Import from `@storybook/nextjs`.",
      "import type { Meta } from \"@storybook/nextjs\";\nexport default { component: Button };\n",
    },
    {
      "Import from `@storybook/react-vite`.",
      "import type { Meta } from \"@storybook/react-vite\";\nexport default { component: Button };\n",
    },
    {
      "Import from `@storybook/react-webpack5`.",
      "import type { Meta } from \"@storybook/react-webpack5\";\nexport default { component: Button };\n",
    },
  }
  if len(finding.Suggestions) != len(expected) {
    t.Fatalf("suggestions = %+v, want %d", finding.Suggestions, len(expected))
  }
  for index, want := range expected {
    suggestion := finding.Suggestions[index]
    if suggestion.Title != want.title {
      t.Fatalf("suggestion %d title = %q, want %q", index, suggestion.Title, want.title)
    }
    rewritten, applied := applyFindingFixesToText(source, []*Finding{{Fix: suggestion.Edits}})
    if applied != 1 || rewritten != want.result {
      t.Fatalf("suggestion %d: applied=%d\nwant %q\ngot  %q", index, applied, want.result, rewritten)
    }
  }
  automatic, applied := applyFindingFixesToText(source, findings)
  if applied != 0 || automatic != source {
    t.Fatalf("automatic edits changed source: applied=%d source=%q", applied, automatic)
  }

  single := "import type { Meta } from \"@storybook/server\";\nexport default { component: Button };\n"
  _, _, singleFindings := runRuleFindingsSnapshot(t, "storybook/no-renderer-packages", single, nil)
  if len(singleFindings) != 1 || len(singleFindings[0].Suggestions) != 1 {
    t.Fatalf("single-successor findings = %+v", singleFindings)
  }
  if strings.Contains(singleFindings[0].Message, " or ") ||
    !strings.HasSuffix(singleFindings[0].Message, "instead: `@storybook/server-webpack5`.") {
    t.Fatalf("single-successor message = %q", singleFindings[0].Message)
  }

  assertRuleSkipsSource(
    t,
    "storybook/no-renderer-packages",
    "import type { Meta } from \"@storybook/react-vite\";\nexport default { component: Button };\n",
  )
}
