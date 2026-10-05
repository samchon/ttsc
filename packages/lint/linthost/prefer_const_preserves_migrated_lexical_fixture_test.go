package linthost

import (
  "path/filepath"
  "reflect"
  "regexp"
  "strconv"
  "testing"
)

// TestPreferConstPreservesMigratedLexicalFixture retains the original lexical
// consumer's four authored file contents at the direct Go check boundary.
//
//  1. Materialize the original case.ts, NodeNext configuration, package marker
//     and scalar error rule setting without an installed consumer.
//  2. Run check through the existing manifest and real Program/Checker.
//  3. Require precisely the stable sibling, single later assignment and stable
//     destructuring binding; the same-spelled reassigned sibling stays silent.
//
// @evidence contracts/testing.md#behavioral-verification The direct check must return 2 with empty stdout and exactly prefer-const errors at case.ts 3:7, 15:1 and 19:14. Same-spelled reassigned value and destructuring first receive no diagnostic.
// @evidence contracts/testing.md#independent-expectations Four literal file contents preserve lint-prefer-const-lexical's source, NodeNext/noEmit/strict settings, package marker and scalar error configuration; the three line/column/rule/severity expectations are authored from its annotations rather than findings.
// @evidence contracts/testing.md#distinguishing-cases Stable sibling value, assignedLater's single later assignment and stable second contrast with the identically named sibling value and destructured first that each receive an additional write. Exact ordered population rejects substituting a mutable binding at the same count.
// @evidence contracts/testing.md#execution-ownership This untagged Go unit invokes the existing in-process check command with a real Program/Checker and temporary files. It does not build a native binary, install or auto-discover a consumer package, or authenticate native warning and TS diagnostic-code forwarding.
func TestPreferConstPreservesMigratedLexicalFixture(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "src", "case.ts"), `function shouldReport(): number {
  // expect: prefer-const error
  let value = 1;
  return value;
}

function sameNameButReassigned(): number {
  let value = 1;
  value += 1;
  return value;
}

let assignedLater: number;
// expect: prefer-const error
assignedLater = 1;

const input = { first: 1, second: 2 };
// expect: prefer-const error
let { first, second } = input;
first += 1;

console.log(
  shouldReport(),
  sameNameButReassigned(),
  assignedLater,
  first,
  second,
);
`)
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "rootDir": "src"
  },
  "files": ["src/case.ts"]
}
`)
  writeFile(t, filepath.Join(root, "package.json"), `{
  "private": true,
  "devDependencies": {
    "@ttsc/lint": "*"
  }
}
`)
  writeFile(t, filepath.Join(root, "lint.config.json"), `{
  "rules": {
    "prefer-const": "error"
  }
}
`)
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  rendered := ansiControlSequencePattern.ReplaceAllString(stderr, "")
  pattern := regexp.MustCompile(`(?m)case\.ts:(\d+):(\d+)\s+-\s+(error|warning)\s+TS\d+:\s*\[([@\w/-]+)\]`)
  actual := []ruleExpectation{}
  sites := [][2]int{}
  for _, match := range pattern.FindAllStringSubmatch(rendered, -1) {
    line, err := strconv.Atoi(match[1])
    if err != nil {
      t.Fatal(err)
    }
    column, err := strconv.Atoi(match[2])
    if err != nil {
      t.Fatal(err)
    }
    sites = append(sites, [2]int{line, column})
    severity := SeverityError
    if match[3] == "warning" {
      severity = SeverityWarn
    }
    actual = append(actual, ruleExpectation{Rule: match[4], Severity: severity, Line: line})
  }
  expected := []ruleExpectation{
    {Rule: "prefer-const", Severity: SeverityError, Line: 3},
    {Rule: "prefer-const", Severity: SeverityError, Line: 15},
    {Rule: "prefer-const", Severity: SeverityError, Line: 19},
  }
  expectedSites := [][2]int{{3, 7}, {15, 1}, {19, 14}}
  if code != 2 || stdout != "" || !reflect.DeepEqual(actual, expected) || !reflect.DeepEqual(sites, expectedSites) {
    t.Fatalf("prefer-const original lexical fixture: code=%d stdout=%q\nwant=%+v\ngot=%+v\nstderr=%s", code, stdout, expected, actual, stderr)
  }
}
