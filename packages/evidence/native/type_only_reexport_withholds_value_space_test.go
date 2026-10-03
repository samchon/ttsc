package evidence

import (
  "regexp"
  "sort"
  "strings"
  "testing"
)

// reexportedSurface is the file every case in this file re-exports.
//
// It holds one of each thing the answer depends on: a class whose name is
// type-space and whose members are not, an interface no class merges with whose
// members are type-space, and a module-scope function that is value-space
// outright.
const reexportedSurface = `
export class Sale {
  price: number = 0;
  charge(): void {}
}
export interface IPlain {
  rate: number;
}
export function run(): void {}
`

var missingAcknowledgement = regexp.MustCompile(`Missing acknowledgement for '([^']+)'`)

// reexportedPopulation is the sorted set of units one barrel form publishes.
//
// The obligation is read from what goes unacknowledged rather than from the
// inventory, because that is the population an author is actually held to, and
// it is the number the barrel form is supposed to change.
func reexportedPopulation(t *testing.T, barrel string) []string {
  t.Helper()
  messages := runIndexRule(t, map[string]string{
    "src/sale.ts":   reexportedSurface,
    "src/index.ts":  barrel,
    "src/ledger.ts": "/** This claim cites nothing. */\nexport interface ILedger {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{
      "type":"typescript",
      "files":["src/index.ts"],
      "symbol":["type","function","property"]
    }
  }]}`)
  targets := []string{}
  for _, message := range messages {
    if match := missingAcknowledgement.FindStringSubmatch(message); match != nil {
      targets = append(targets, match[1])
    }
  }
  sort.Strings(targets)
  return targets
}

func assertReexportedPopulation(t *testing.T, barrel string, want []string) {
  t.Helper()
  got := reexportedPopulation(t, barrel)
  if strings.Join(got, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "population of %q:\n%s\nwant:\n%s",
      strings.TrimSpace(barrel),
      strings.Join(got, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

// valueReexportPopulation is everything the declaring file publishes.
var valueReexportPopulation = []string{
  "IPlain",
  "IPlain.rate",
  "Sale",
  "Sale.prototype.charge",
  "Sale.prototype.price",
  "run",
}

// typeReexportPopulation is what survives a type-only edge: the class name,
// because a name is type-space, and the interface with its members, because an
// interface no class merges with declares nothing in value space.
var typeReexportPopulation = []string{
  "IPlain",
  "IPlain.rate",
  "Sale",
}











// reexportedFrom is the population one file layout publishes at one entry.
//
// The fixed layout above cannot express a barrel of barrels or two paths to one
// name, and both are where a mark that travels can go wrong.
func reexportedFrom(t *testing.T, files map[string]string, entry string) []string {
  t.Helper()
  files["src/ledger.ts"] = "/** This claim cites nothing. */\nexport interface ILedger {}\n"
  messages := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{
      "type":"typescript",
      "files":["`+entry+`"],
      "symbol":["type","function","property"]
    }
  }]}`)
  targets := []string{}
  for _, message := range messages {
    if match := missingAcknowledgement.FindStringSubmatch(message); match != nil {
      targets = append(targets, match[1])
    }
  }
  sort.Strings(targets)
  return targets
}

func assertReexportedFrom(
  t *testing.T,
  label string,
  files map[string]string,
  entry string,
  want []string,
) {
  t.Helper()
  got := reexportedFrom(t, files, entry)
  if strings.Join(got, "\n") != strings.Join(want, "\n") {
    t.Fatalf("%s:\n%s\nwant:\n%s", label, strings.Join(got, "\n"), strings.Join(want, "\n"))
  }
}
