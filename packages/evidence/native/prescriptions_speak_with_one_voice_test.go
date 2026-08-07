package evidence

import (
  "regexp"
  "sort"
  "strings"
  "testing"
)

// prescribedGrammars collects every tag one evaluation tells an author to write.
//
// The pattern reads the two shapes a prescription takes, `Use @evidence…` and
// `Write '@evidence…'`, which is every one this rule emits. A shape it cannot
// see is a prescription this case cannot check, so a new one has to be added
// here as well as written.
var prescribedGrammars = regexp.MustCompile(
  `(?:Use |Write ')(@evidence(?:Exclude)?(?:\([^\s()]+\))?)`,
)

// collectPrescribedGrammars reads what one evaluation prescribes for one
// target.
//
// A message naming another target is another obligation's business and may
// prescribe another tag; the rule binds the sentences about one cited thing. A
// malformed declaration names no target at all, so it belongs to every group:
// whatever it prescribes has to agree with everything the author will be told
// once the target is there.
func collectPrescribedGrammars(messages []string, target string) []string {
  seen := map[string]bool{}
  found := []string{}
  for _, message := range messages {
    if !strings.Contains(message, "'"+target+"'") &&
      !strings.Contains(message, "Malformed @") {
      continue
    }
    for _, match := range prescribedGrammars.FindAllStringSubmatch(message, -1) {
      if seen[match[1]] {
        continue
      }
      seen[match[1]] = true
      found = append(found, match[1])
    }
  }
  sort.Strings(found)
  return found
}

/**
 * Verifies every prescription one evaluation makes for one target names one tag.
 *
 * Six correction rounds each found an instance of one class: a diagnostic telling an author to write a citation that another diagnostic in the same build refuses. Each was fixed where it was found, and the next round found the next one, because the class was reviewable rather than checkable. This is the check: collect what a single evaluation prescribes and assert it speaks with one voice.
 *
 *  1. Put one target under obligations that notice it differently.
 *  2. Collect every tag the build tells the author to write.
 *  3. Assert there is exactly one, and that writing it clears the build.
 */
func TestOneEvaluationPrescribesOneTag(t *testing.T) {
  for _, test := range []struct {
    name    string
    sources map[string]string
    config  string
    want    map[string]string
  }{
    {
      // A relation-requiring reference beside one requiring none. Both accept
      // the relation; only one accepts the bare tag.
      name: "one reference constrained and one not",
      sources: map[string]string{
        "docs/spec.md": "## Contract {#contract}\n",
        "src/test.ts":  "export function testContract(): void {}\n",
      },
      config: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "symbol":"function",
        "reference":[
          {"type":"markdown","files":["docs/spec.md"],"symbol":"h2","role":"implements"},
          {"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
        ]
      }]}`,
      want: map[string]string{"docs/spec.md#contract": "@evidence(implements)"},
    },
    {
      // A malformed tag is repaired before resolution, and the missing unit
      // after it. The two sites read different inputs and must still agree.
      name: "a repair before resolution and a repair after it",
      sources: map[string]string{
        "docs/spec.md": "## Contract {#contract}\n",
        "src/test.ts": `/** @evidence */
export function testContract(): void {}
`,
      },
      config: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "symbol":"function",
        "reference":[
          {"type":"markdown","files":["docs/spec.md"],"symbol":"h2","role":"implements"},
          {"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
        ]
      }]}`,
      want: map[string]string{"docs/spec.md#contract": "@evidence(implements)"},
    },
    {
      // An unbraced symbol target cannot belong to the Markdown reference, so
      // that reference's relation must not vote on the repair.
      name: "a target that says which reference owns it",
      sources: map[string]string{
        "docs/spec.md":    "## Contract {#contract}\n",
        "src/contract.ts": "export interface IContract {}\n",
        "src/test.ts": `import type { IContract } from "./contract";

/** @evidence IContract Implements the contract. */
export function testContract(): void {}
`,
      },
      config: `{"claims":[{
        "type":"typescript",
        "files":["src/test.ts"],
        "symbol":"function",
        "reference":[
          {"type":"typescript","files":["src/contract.ts"],"symbol":"type","role":"mirrors"},
          {"type":"markdown","files":["docs/spec.md"],"symbol":"h2","role":"implements"}
        ]
      }]}`,
      want: map[string]string{
        "IContract":             "@evidence(mirrors)",
        "docs/spec.md#contract": "@evidence(implements)",
      },
    },
  } {
    t.Run(test.name, func(t *testing.T) {
      messages := runIndexRule(t, test.sources, test.config)
      for target, want := range test.want {
        grammars := collectPrescribedGrammars(messages, target)
        if len(grammars) != 1 || grammars[0] != want {
          t.Fatalf(
            "expected every prescription for %s to name %s, got %v:\n%s",
            target,
            want,
            grammars,
            strings.Join(messages, "\n"),
          )
        }
      }
    })
  }
}

/**
 * Verifies an exclusion is never prescribed a relation, whatever the obligations want.
 *
 * A relation belongs to positive evidence. The prescription for a malformed exclusion has to stay an exclusion, or one sentence tells the author to write a tag whose own grammar refuses the word it just handed them.
 *
 *  1. Require a relation on every reference.
 *  2. Write a malformed exclusion beside a malformed citation.
 *  3. Assert the two prescriptions differ in exactly the tag they name.
 */
func TestPrescriptionKeepsTheTagTheAuthorMeant(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence */
export function testContract(): void {}

/** @evidenceExclude */
export function testExcluded(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"implements"
    }
  }]}`)
  grammars := collectPrescribedGrammars(messages, "docs/spec.md#contract")
  want := []string{"@evidence(implements)", "@evidenceExclude"}
  if strings.Join(grammars, " ") != strings.Join(want, " ") {
    t.Fatalf(
      "expected %v, got %v:\n%s",
      want,
      grammars,
      strings.Join(messages, "\n"),
    )
  }
}
