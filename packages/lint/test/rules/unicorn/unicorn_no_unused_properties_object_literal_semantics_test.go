package linthost

import (
  "fmt"
  "regexp"
  "sort"
  "strings"
  "testing"

  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// unusedPropertiesMarkerPattern extracts `/* unused:NAME */` expectation
// markers placed on the same line as the property they pin.
var unusedPropertiesMarkerPattern = regexp.MustCompile(`/\* unused:([^*]+) \*/`)

// unusedPropertiesMessagePattern parses the reported property name out of the
// rule's canonical upstream message.
var unusedPropertiesMessagePattern = regexp.MustCompile("^Property `(.+)` is defined but never used\\.$")

// unusedPropertiesExpectedKeys returns the sorted `NAME@line` set declared by
// `/* unused:NAME */` markers in the source.
func unusedPropertiesExpectedKeys(t *testing.T, source string) []string {
  t.Helper()
  keys := []string{}
  for _, match := range unusedPropertiesMarkerPattern.FindAllStringSubmatchIndex(source, -1) {
    name := source[match[2]:match[3]]
    line := 1 + strings.Count(source[:match[0]], "\n")
    keys = append(keys, fmt.Sprintf("%s@%d", name, line))
  }
  sort.Strings(keys)
  return keys
}

// unusedPropertiesFindingKeys converts findings into the same sorted
// `NAME@line` shape, failing on any unexpected message or leftover fix.
func unusedPropertiesFindingKeys(t *testing.T, findings []*Finding) []string {
  t.Helper()
  keys := []string{}
  for _, finding := range findings {
    if finding.Rule != "unicorn/no-unused-properties" || finding.Severity != SeverityError {
      t.Fatalf("unexpected finding identity: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding unexpectedly offers edits: %+v", finding)
    }
    match := unusedPropertiesMessagePattern.FindStringSubmatch(finding.Message)
    if match == nil {
      t.Fatalf("unexpected message shape: %q", finding.Message)
    }
    line := shimscanner.GetECMALineOfPosition(finding.File, finding.Pos) + 1
    keys = append(keys, fmt.Sprintf("%s@%d", match[1], line))
  }
  sort.Strings(keys)
  return keys
}

// assertUnusedPropertiesFindings runs the rule over one disk-backed module
// and compares the reported `NAME@line` set against the source's markers.
func assertUnusedPropertiesFindings(t *testing.T, source string) {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/no-unused-properties", source, nil)
  expected := unusedPropertiesExpectedKeys(t, source)
  actual := unusedPropertiesFindingKeys(t, findings)
  if strings.Join(expected, "|") != strings.Join(actual, "|") {
    t.Fatalf("finding mismatch:\nwant %v\ngot  %v", expected, actual)
  }
}

// TestUnicornNoUnusedPropertiesObjectLiteralSemantics verifies every
// object-literal read, escape, and mutation branch of the upstream analysis.
//
// The rule filters a variable's references per property key: static accesses
// must name the key, destructuring must bind it, and any escape (alias,
// argument, spread, export, dynamic index, mutation, member call) keeps every
// property alive. Each positive here has a negative twin one property away so
// an over- or under-match in any branch flips the expectation set.
//
//  1. Declare one module-scope object per branch: direct/quoted/element/
//     computed reads, nested recursion, destructuring forms, rest, method
//     calls and assignments, accessors, shorthand, exports, and escapes.
//  2. Run the rule through the real Program/checker lifecycle.
//  3. Assert exactly the `/* unused:NAME */`-marked properties are reported.
func TestUnicornNoUnusedPropertiesObjectLiteralSemantics(t *testing.T) {
  source := `export {};
declare function consume(...values: unknown[]): void;
declare const record: Record<string, number>;

const direct = { kept: 1, /* unused:directDrop */ directDrop: 2 };
consume(direct.kept);

const quoted = { "kept": 1, /* unused:quotedDrop */ "quotedDrop": 2 };
consume(quoted.kept);

const element = { kept: 1, /* unused:elementDrop */ elementDrop: 2 };
consume(element["kept"]);

const computed = { ["kept"]: 1, /* unused:computedDrop */ ["computedDrop"]: 2 };
consume(computed["kept"]);

const nested = {
  outer: {
    inner: 1,
    /* unused:nestedDrop */ nestedDrop: 2,
  },
  /* unused:branchDrop */ branchDrop: { hidden: 3 },
};
consume(nested.outer.inner);

const destructured = { taken: 1, /* unused:destructuredDrop */ destructuredDrop: 2 };
const { taken } = destructured;
consume(taken);

let assigned = 0;
const reassignedPattern = { fetched: 1, /* unused:patternDrop */ patternDrop: 2 };
({ fetched: assigned } = reassignedPattern);
consume(assigned);

const rested = { firstRest: 1, alsoRest: 2 };
const { firstRest, ...rest } = rested;
consume(firstRest, rest);

const aliased = { viaAlias: 1, alsoViaAlias: 2 };
const alias = aliased;
consume(alias);

const spread = { viaSpread: 1, alsoViaSpread: 2 };
consume({ ...spread });

const whole = { viaWhole: 1, alsoViaWhole: 2 };
consume(whole);

const untouched = { neverRead: 1, alsoNeverRead: 2 };

let writeOnly = { onlyWritten: 1 };
writeOnly = { onlyWritten: 2 };

let rewritten = { survives: 1, alsoSurvives: 2 };
rewritten = { survives: 3, alsoSurvives: 4 };
consume(rewritten.survives);

const mutated = { seed: 1, other: 2 };
mutated.seed = 3;
consume(mutated.other);

const called = { helper() {}, extra: 1 };
called.helper();

const idle = { /* unused:act */ act() {}, usedNext: 1 };
consume(idle.usedNext);

const accessors = {
  get readable() {
    return 1;
  },
  /* unused:writable */ set writable(value: number) {},
  plain: 2,
};
consume(accessors.readable, accessors.plain);

const one = 1;
const two = 2;
const short = { one, /* unused:two */ two };
consume(short.one);

export const published = { openly: 1, alsoOpenly: 2 };
consume(published.openly);

const specified = { byName: 1, alsoByName: 2 };
consume(specified.byName);
export { specified };

const defaulted = { byDefault: 1 };
export default defaulted;

const optional = { maybeRead: 1, /* unused:optionalDrop */ optionalDrop: 2 };
consume(optional?.maybeRead);

const guarded = { shielded: 1, alsoShielded: 2 };
consume(Object.prototype.hasOwnProperty.call(guarded, "shielded"));

const probed = { inLeft: 1, inRight: 2 };
consume("inLeft" in probed);

const growing = { started: 1, follower: 2 };
growing.started += 1;
consume(growing.follower);

const looped = { item: 1, nextItem: 2 };
for (const key in looped) {
  consume(key);
}

const proto = {
  __proto__: { fromProto: 1 },
  "__proto__x": 2,
  /* unused:protoDrop */ protoDrop: 3,
  visible: 4,
};
consume(proto.visible, proto["__proto__x"]);

const dynamic = { anyOf: 1, allOf: 2 };
consume(record[String(dynamic.anyOf)], dynamic[("allOf" as keyof typeof dynamic)]);
`
  assertUnusedPropertiesFindings(t, source)
}
