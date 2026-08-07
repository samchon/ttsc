package evidence

import (
  "os"
  "regexp"
  "sort"
  "strings"
  "testing"
)

// prescribedGrammars reads every tag one evaluation tells an author to write.
//
// The three shapes a prescription takes: `Use @evidence…`, `Write '@evidence…'`,
// and `cite the target with '@evidence…'`. A shape this cannot see is a
// prescription nobody checks, which is how the fourth site shipped saying
// something the other three did not. `TestEveryPrescribingSiteIsRead` holds the
// pattern to the sites the code actually has, so adding one without teaching
// this fails there rather than silently here.
var prescribedGrammars = regexp.MustCompile(
  `(?:Use |Write '|cite the target with ')(@evidence(?:Exclude)?(?:\([^\s()]+\))?)`,
)

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

/**
 * Verifies every site that prescribes a citation is one the check above can read.
 *
 * `prescribedGrammars` matches message prose, so a site phrased in a way it does not know is a site nobody checks. That is not hypothetical: the exclusion repair shipped saying something the other three sites did not, and the check saw nothing, because it read two of the four shapes. Reading the call sites out of the source rather than the messages is what makes a new one fail here instead of silently.
 *
 *  1. Find every call to the two grammar helpers in the rule's own source.
 *  2. Assert each one is introduced by a phrase the collector recognizes.
 *  3. Assert the helpers are the only way a prescription is built.
 */
func TestEveryPrescribingSiteIsRead(t *testing.T) {
  source, err := os.ReadFile("graph.go")
  if err != nil {
    t.Fatalf("could not read the rule's own source: %v", err)
  }
  leadIns := []string{"Use ", "Write '", "cite the target with '"}
  sites := 0
  for index, line := range strings.Split(string(source), "\n") {
    for _, helper := range []string{
      "writtenTagGrammar(",
      "requiredCitationGrammar(",
    } {
      at := strings.Index(line, helper)
      // A definition or a doc comment is not a prescription.
      if at < 0 || strings.HasPrefix(strings.TrimSpace(line), "func ") ||
        strings.HasPrefix(strings.TrimSpace(line), "//") {
        continue
      }
      sites++
      prefix := line[:at]
      introduced := false
      for _, leadIn := range leadIns {
        if strings.Contains(prefix, leadIn) {
          introduced = true
          break
        }
      }
      if !introduced {
        t.Fatalf(
          "graph.go:%d prescribes a citation with a phrase collectPrescribedGrammars cannot read.\nTeach prescribedGrammars the new phrase, or use one of %v:\n%s",
          index+1,
          leadIns,
          strings.TrimSpace(line),
        )
      }
    }
  }
  if sites < 4 {
    t.Fatalf("expected every prescribing site to be found, got %d", sites)
  }

  // A tag whose grammar can vary is prescribed through a helper or not at all.
  // `@evidenceExclude` never carries a relation, so spelling that one is right;
  // a literal `@evidence` after a lead-in is a site inventing its own answer.
  for index, line := range strings.Split(string(source), "\n") {
    trimmed := strings.TrimSpace(line)
    if strings.HasPrefix(trimmed, "//") {
      continue
    }
    for _, leadIn := range leadIns {
      at := strings.Index(line, leadIn)
      if at < 0 {
        continue
      }
      rest := line[at+len(leadIn):]
      if !strings.HasPrefix(rest, "@evidence") ||
        strings.HasPrefix(rest, "@evidenceExclude") {
        continue
      }
      t.Fatalf(
        "graph.go:%d spells a citation grammar instead of asking for it:\n%s",
        index+1,
        trimmed,
      )
    }
  }
}

/**
 * Verifies a prescription names only a relation the host it addresses could satisfy.
 *
 * This is the shape the relation exists for: an implementation claim and a test claim over one requirement, where only the tests must prove it works. A tag written for one claim discharges no other, so borrowing the test claim's relation into the implementation's repair asks an author to claim something their own obligation never reads. The build then goes green on a relation nobody checked, which is the one outcome the option exists to prevent.
 *
 *  1. Put one requirement under an implementation claim requiring no relation and a test claim requiring `proves`.
 *  2. Read what each claim tells its own host to write.
 *  3. Assert neither is told the other's relation, and that following both clears the build.
 */
func TestPrescriptionNamesOnlyWhatTheAddressedHostCouldSatisfy(t *testing.T) {
  const config = `{"claims":[
    {
      "name":"implementation",
      "type":"typescript",
      "files":["src/api/**"],
      "symbol":"function",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    },
    {
      "name":"tests",
      "type":"typescript",
      "files":["src/test/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "role":"proves"
      }
    }
  ]}`
  sources := map[string]string{
    "docs/spec.md":     "## Refund {#refund}\n",
    "src/api/refund.ts": `export function refund(): void {}
`,
    "src/test/refund.ts": `export function testRefund(): void {}
`,
  }
  messages := runIndexRule(t, sources, config)
  implementation := ""
  tests := ""
  for _, message := range messages {
    if strings.Contains(message, "'implementation'") {
      implementation = message
    }
    if strings.Contains(message, "'tests'") {
      tests = message
    }
  }
  if !strings.Contains(implementation, "Use @evidence on a selected") {
    t.Fatalf(
      "the implementation host was told to claim a relation its own obligation never reads:\n%s",
      implementation,
    )
  }
  if !strings.Contains(tests, "Use @evidence(proves) on a selected") {
    t.Fatalf(
      "the test host was not told the relation its own obligation requires:\n%s",
      tests,
    )
  }

  sources["src/api/refund.ts"] = `/** @evidence docs/spec.md#refund Issues the refund. */
export function refund(): void {}
`
  sources["src/test/refund.ts"] = `/** @evidence(proves) docs/spec.md#refund Proves the refund works. */
export function testRefund(): void {}
`
  if clean := runIndexRule(t, sources, config); len(clean) != 0 {
    t.Fatalf(
      "following both prescriptions did not clear the build:\n%s",
      strings.Join(clean, "\n"),
    )
  }
}
