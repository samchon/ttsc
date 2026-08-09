package linthost

import (
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

// TestPublishedRuleOptionsAreReadOrReserved pins that every option field the
// package publishes either reaches a decision or says it does not.
//
// The existing parity test compares the SET of option-accepting rules against
// the typed keys, so it cannot see a field that is declared, documented as
// working, accepted by the config layer, and then never decoded. Seven such
// fields shipped in the `functional/*` family (#1132): a user set them, nothing
// warned, and the rule behaved as if the payload were absent. The sweep below is
// what turns the next one into a failure at build time.
//
//  1. Read every option field and its doc comment from
//     `src/structures/rules/ITtscLint*RuleOptions.ts`.
//  2. Scan every Go source in the linthost package for the field's quoted name,
//     which covers both a `json:"…"` tag and a manual map-key decoder.
//  3. Require each field to appear in the Go sources or to carry the reserved
//     marker in its doc comment.
//
// The quoted-name scan is a lower bound, not a proof of use: a field whose name
// collides with an unrelated string literal somewhere in the engine passes
// without being decoded. It still turns the whole failure mode this test was
// written for into a build error, because an option nobody implemented has no
// reason to appear as a Go string at all. Per-rule behavioral cases carry the
// proof that a decoded field reaches a decision.
func TestPublishedRuleOptionsAreReadOrReserved(t *testing.T) {
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
  reserved := 0
  for name, doc := range fields {
    if strings.Contains(sources, `"`+name+`"`) {
      continue
    }
    if strings.Contains(doc, reservedRuleOptionMarker) {
      reserved++
      continue
    }
    inert = append(inert, name)
  }
  sort.Strings(inert)
  if len(inert) != 0 {
    t.Fatalf(
      "published rule option fields that no rule reads and no doc comment marks %q: %v",
      reservedRuleOptionMarker,
      inert,
    )
  }
  if reserved == 0 {
    t.Fatalf("no field carries the %q marker; the escape hatch is unexercised and the sweep proves nothing", reservedRuleOptionMarker)
  }
}

// readPublishedRuleOptionFields returns each declared option property name
// mapped to the doc comment immediately above it.
func readPublishedRuleOptionFields() (map[string]string, error) {
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
  fields := map[string]string{}
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
    for _, line := range strings.Split(string(body), "\n") {
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
      default:
        if match := property.FindStringSubmatch(line); match != nil {
          fields[match[1]] = doc.String()
          doc.Reset()
        }
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
