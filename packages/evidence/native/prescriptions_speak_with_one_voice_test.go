package evidence

import (
  "go/ast"
  "go/parser"
  "go/token"
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

// collectPrescribedGrammars reads what one evaluation prescribes for one
// target.
//
// A message naming another target is another obligation's business and may
// prescribe another tag; the rule binds the sentences about one cited thing. A
// malformed declaration may name no target at all, so it belongs to every
// group: whatever it prescribes has to agree with everything the author will be
// told once the target is there.
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
 * Verifies no source in this package spells a citation grammar of its own.
 *
 * The collector reads message prose, so a site phrased in a way its pattern does not know is a site nobody checks; that is how the exclusion repair shipped disagreeing with three others. Reading lines for two helper names checked the wrong thing in both directions at once: it rejected a refactor that changed no message, and it admitted a fifth helper, a lead-in the collector cannot follow, a hand-spelled grammar under a new phrase, and a second call on one line. The property that actually holds is narrower and mechanical, and it reaches every file rather than the one the last check knew about.
 *
 *  1. Parse every non-test source in the package.
 *  2. Find every string literal spelling the shape an author is told to type.
 *  3. Assert each one is inside a function whose job is to answer what that grammar is.
 */
func TestNoSourceSpellsACitationGrammar(t *testing.T) {
  // `@evidenceExclude` never carries a relation, so its spelling cannot go
  // stale and every site may write it. The parenthesized form is the one a
  // reference changes, and the marker constants are the parser's own alphabet
  // rather than advice to an author.
  answering := map[string]bool{
    "writtenTagGrammar":       true,
    "requiredCitationGrammar": true,
    "evidenceHintAudiences":   true,
  }
  // Naming the tag family is not prescribing a citation: "Duplicate @evidence
  // for 'x'" says which tag it found. What goes stale is the shape an author is
  // told to type, which is the template and the relation opener.
  spellings := []string{"@evidence <target>", "@evidence("}
  entries, err := os.ReadDir(".")
  if err != nil {
    t.Fatalf("could not read the package: %v", err)
  }
  fileSet := token.NewFileSet()
  spelled := []string{}
  for _, entry := range entries {
    name := entry.Name()
    if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
      continue
    }
    parsed, err := parser.ParseFile(fileSet, name, nil, 0)
    if err != nil {
      t.Fatalf("could not parse %s: %v", name, err)
    }
    for _, declaration := range parsed.Decls {
      function, isFunction := declaration.(*ast.FuncDecl)
      if !isFunction || answering[function.Name.Name] {
        continue
      }
      ast.Inspect(function, func(node ast.Node) bool {
        literal, isLiteral := node.(*ast.BasicLit)
        if !isLiteral || literal.Kind != token.STRING {
          return true
        }
        for _, spelling := range spellings {
          if !strings.Contains(literal.Value, spelling) {
            continue
          }
          spelled = append(
            spelled,
            fileSet.Position(literal.Pos()).String()+": "+literal.Value,
          )
          return false
        }
        return true
      })
    }
  }
  if len(spelled) != 0 {
    t.Fatalf(
      "these spell a citation grammar instead of asking for it, so nothing keeps them agreeing with the rest of the build:\n%s",
      strings.Join(spelled, "\n"),
    )
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
    "docs/spec.md": "## Refund {#refund}\n",
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

/**
 * Verifies a target naming an aggregate scope is prescribed the relation its units want.
 *
 * A repair runs before resolution and has only the text the author wrote, so the lookup has to answer for what a target can name rather than for what a reference selects. Keyed on selected units alone it answers nothing for a scope, and the site then prescribes the bare tag while the diagnostic beside it asks for the relation. The inversion is the tell: a target resolving to nothing would have been served better than one resolving correctly.
 *
 *  1. Require a relation on a reference selecting headings.
 *  2. Cite the file, which is their containing scope and not itself selected.
 *  3. Assert the repair and the owed unit name the same relation.
 */
func TestAggregateTargetIsPrescribedItsUnitsRelation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence docs/spec.md */
export function testContract(): void {}
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
  assertProblemContains(t, messages, "Write '@evidence(implements) <target> <reason>'")
  grammars := collectPrescribedGrammars(messages, "docs/spec.md#contract")
  if len(grammars) != 1 || grammars[0] != "@evidence(implements)" {
    t.Fatalf(
      "the scope and the unit it covers were prescribed differently: %v\n%s",
      grammars,
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a host owing two claims is told one tag both of them take.
 *
 * Where two claims select the same files, one host answers to both, so the claim that noticed a missing unit is not the whole of what its repair must satisfy. Naming only its own requirement prescribes the one tag that cannot clear the build, and the author writes it, rebuilds, and is refused by the claim nobody mentioned.
 *
 *  1. Point two claims at one file population, one requiring a relation and one requiring none.
 *  2. Read what each tells the shared host to write.
 *  3. Assert both name the relation, and that writing it clears the build.
 */
func TestSharedHostHearsOneTagFromBothClaims(t *testing.T) {
  const config = `{"claims":[
    {
      "name":"implementation",
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    },
    {
      "name":"proofs",
      "type":"typescript",
      "files":["src/**"],
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
    "docs/spec.md": "## Refund {#refund}\n",
    "src/refund.ts": `export function refund(): void {}
`,
  }
  grammars := collectPrescribedGrammars(
    runIndexRule(t, sources, config),
    "docs/spec.md#refund",
  )
  if len(grammars) != 1 || grammars[0] != "@evidence(proves)" {
    t.Fatalf("a shared host was told two different tags: %v", grammars)
  }

  sources["src/refund.ts"] = `/** @evidence(proves) docs/spec.md#refund Proves the refund works. */
export function refund(): void {}
`
  if clean := runIndexRule(t, sources, config); len(clean) != 0 {
    t.Fatalf(
      "the one prescribed tag did not clear both claims:\n%s",
      strings.Join(clean, "\n"),
    )
  }
}
