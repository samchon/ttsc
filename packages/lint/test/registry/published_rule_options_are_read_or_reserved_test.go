package linthost

import (
  "fmt"
  "os"
  "path/filepath"
  "regexp"
  "runtime"
  "sort"
  "strings"
  "testing"
)

// reservedRuleOptionMarker is the sentence a published option field carries when
// the native subset accepts it for upstream compatibility and does not act on
// it. It is the only sanctioned way for a field to reach a user's config and
// change nothing.
const reservedRuleOptionMarker = "Reserved for upstream-compatible configs"

// publishedRuleOptionField is one declared option property, kept per declaration
// site rather than per name. Twenty-one option names are declared in more than
// one family file, so a name-keyed map would let one rule's decoder exempt every
// other rule that publishes the same key.
type publishedRuleOptionField struct {
  File  string
  Line  int
  Name  string
  Doc   string
  Owner string
}

// TestPublishedRuleOptionsAreReadOrReserved pins that every option field the
// package publishes either reaches a decision or says it does not.
//
// The existing parity test compares the SET of option-accepting rules against
// the typed keys, so it cannot see a field that is declared, documented as
// working, accepted by the config layer, and then never decoded. Fourteen such
// fields shipped in the `functional/*` family (#1132): a user set them, nothing
// warned, and the rule behaved as if the payload were absent. The sweep below is
// what turns the next one into a failure at build time.
//
//  1. Read every option field, its owning interface, and its doc comment from
//     `src/structures/rules/ITtscLint*RuleOptions.ts`.
//  2. Scan every Go source in the linthost package for the field's quoted name,
//     which covers both a `json:"…"` tag and a manual map-key decoder.
//  3. Require each declaration to appear in the Go sources or to carry the
//     reserved marker in its own doc comment.
//
// The quoted-name scan is a lower bound, not a proof of use: a field whose name
// collides with an unrelated string literal somewhere in the engine passes
// without being decoded. It still turns the whole failure mode this test was
// written for into a build error, because an option nobody implemented has no
// reason to appear as a Go string at all. Per-rule behavioral cases carry the
// proof that a decoded field reaches a decision.
func TestPublishedRuleOptionsAreReadOrReserved(t *testing.T) {
  assertReservedRuleOptionMarkerRecognizer(t)

  fields, err := readPublishedRuleOptionFields()
  if err != nil {
    t.Fatalf("read published rule option fields: %v", err)
  }
  if len(fields) == 0 {
    t.Fatal("no published rule option fields found; the source walk is broken")
  }
  sources, err := linthostGoSources()
  if err != nil {
    t.Fatalf("read linthost sources: %v", err)
  }

  var inert []string
  for _, field := range fields {
    if strings.Contains(sources, `"`+field.Name+`"`) {
      continue
    }
    if ruleOptionIsReserved(field.Doc) {
      continue
    }
    inert = append(inert, fmt.Sprintf(
      "%s.%s (%s:%d)", field.Owner, field.Name, field.File, field.Line,
    ))
  }
  sort.Strings(inert)
  if len(inert) != 0 {
    t.Fatalf(
      "published rule option fields that no rule reads and no doc comment marks %q: %v",
      reservedRuleOptionMarker,
      inert,
    )
  }
}

// ruleOptionIsReserved reports whether a field's own doc comment declares it
// accepted-but-inert.
func ruleOptionIsReserved(doc string) bool {
  return strings.Contains(doc, reservedRuleOptionMarker)
}

// assertReservedRuleOptionMarkerRecognizer proves the escape hatch is
// recognized without depending on the corpus still containing a reserved field.
// Asserting that some field is reserved would turn the sweep red the day every
// reserved option becomes implementable, which is the outcome it exists to
// encourage.
func assertReservedRuleOptionMarkerRecognizer(t *testing.T) {
  t.Helper()
  reserved := "/** Minimum accepted immutability. " + reservedRuleOptionMarker +
    "; the native subset computes no immutability level."
  if !ruleOptionIsReserved(reserved) {
    t.Fatalf("reserved marker not recognized in %q", reserved)
  }
  if ruleOptionIsReserved("/** Check interface member kinds. @default true") {
    t.Fatal("an ordinary doc comment was accepted as reserved")
  }
}

// readPublishedRuleOptionFields returns every declared option property with the
// interface that owns it and the doc comment immediately above it.
func readPublishedRuleOptionFields() ([]publishedRuleOptionField, error) {
  _, thisFile, _, ok := runtime.Caller(0)
  if !ok {
    return nil, errMissingCaller{}
  }
  // Same scratch layout the sibling parity tests rely on: the running test file
  // sits in linthost/ with the TypeScript tree one directory up.
  rulesDir := filepath.Join(
    filepath.Dir(thisFile), "..", "src", "structures", "rules",
  )
  entries, err := os.ReadDir(rulesDir)
  if err != nil {
    return nil, err
  }
  property := regexp.MustCompile(`^\s{2}(?:readonly\s+)?"?([\w$-]+)"?\??\s*:`)
  declaration := regexp.MustCompile(`^export interface (I[\w]+)`)
  var fields []publishedRuleOptionField
  for _, entry := range entries {
    name := entry.Name()
    if entry.IsDir() || !strings.HasSuffix(name, "RuleOptions.ts") {
      continue
    }
    body, err := os.ReadFile(filepath.Join(rulesDir, name))
    if err != nil {
      return nil, err
    }
    var doc strings.Builder
    inDoc := false
    owner := ""
    for index, line := range strings.Split(string(body), "\n") {
      trimmed := strings.TrimSpace(line)
      switch {
      case strings.HasPrefix(trimmed, "/**"):
        doc.Reset()
        doc.WriteString(trimmed)
        // A one-line `/** … */` closes on its own line; only a block form
        // leaves the comment open for the continuation branch below. Treating
        // the one-line form as open swallowed every property until the next
        // block comment closed, which is how this sweep first under-reported.
        inDoc = !strings.HasSuffix(trimmed, "*/")
      case inDoc && strings.HasPrefix(trimmed, "*/"):
        inDoc = false
      case inDoc:
        doc.WriteString(" ")
        doc.WriteString(strings.TrimPrefix(trimmed, "* "))
      case trimmed == "":
        // A blank line between a doc comment and the property it documents is
        // legal and keeps the association; only real content breaks it.
      default:
        if match := declaration.FindStringSubmatch(trimmed); match != nil {
          owner = match[1]
        }
        if match := property.FindStringSubmatch(line); match != nil {
          fields = append(fields, publishedRuleOptionField{
            File:  name,
            Line:  index + 1,
            Name:  match[1],
            Doc:   doc.String(),
            Owner: owner,
          })
        }
        // Any line that is neither a doc comment nor the property it documents
        // breaks the association. Without this an interface-level doc carrying
        // the reserved marker would be inherited by its first undocumented
        // member and exempt it.
        doc.Reset()
      }
    }
  }
  return fields, nil
}

// linthostGoSources concatenates every Go source in the running package
// directory, which the scratch layout materializes next to this test.
func linthostGoSources() (string, error) {
  _, thisFile, _, ok := runtime.Caller(0)
  if !ok {
    return "", errMissingCaller{}
  }
  entries, err := os.ReadDir(filepath.Dir(thisFile))
  if err != nil {
    return "", err
  }
  var builder strings.Builder
  for _, entry := range entries {
    name := entry.Name()
    if entry.IsDir() || !strings.HasSuffix(name, ".go") ||
      strings.HasSuffix(name, "_test.go") {
      continue
    }
    body, err := os.ReadFile(filepath.Join(filepath.Dir(thisFile), name))
    if err != nil {
      return "", err
    }
    builder.Write(body)
    builder.WriteString("\n")
  }
  return builder.String(), nil
}
