package linthost

import (
  "encoding/json"
  "sort"
  "strings"
  "testing"
)

const unicornImportStyleRuleName = "unicorn/import-style"

// unicornImportStylePolicyOptions mirrors the options fixture upstream's
// test suite applies to every case: four synthetic modules, each named
// after the one style it allows.
const unicornImportStylePolicyOptions = `{
  "checkExportFrom": true,
  "styles": {
    "unassigned": {"unassigned": true, "named": false},
    "default": {"default": true, "named": false},
    "namespace": {"namespace": true, "named": false},
    "named": {"named": true}
  }
}`

type unicornImportStyleFinding struct {
  target  string
  message string
}

// runUnicornImportStyleFindings executes the rule over one source file
// and normalizes every finding to its exact source range and message.
// The helper also locks the structural invariants shared by all cases:
// the rule never offers edits and never reports an invalid range.
func runUnicornImportStyleFindings(t *testing.T, source, optionsJSON string) []unicornImportStyleFinding {
  t.Helper()
  var options json.RawMessage
  if optionsJSON != "" {
    options = json.RawMessage(optionsJSON)
  }
  _, _, findings := runRuleFindingsSnapshot(t, unicornImportStyleRuleName, source, options)
  type positionedFinding struct {
    pos     int
    finding unicornImportStyleFinding
  }
  entries := make([]positionedFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != unicornImportStyleRuleName {
      t.Fatalf("unexpected rule in findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("unicorn/import-style must not offer edits: %+v", finding)
    }
    if finding.Pos < 0 || finding.End <= finding.Pos || finding.End > len(source) {
      t.Fatalf("unicorn/import-style returned an invalid source range: %+v", finding)
    }
    entries = append(entries, positionedFinding{
      pos: finding.Pos,
      finding: unicornImportStyleFinding{
        target:  source[finding.Pos:finding.End],
        message: finding.Message,
      },
    })
  }
  sort.SliceStable(entries, func(i, j int) bool {
    return entries[i].pos < entries[j].pos
  })
  normalized := make([]unicornImportStyleFinding, len(entries))
  for index, entry := range entries {
    normalized[index] = entry.finding
  }
  return normalized
}

func assertUnicornImportStyleFindings(
  t *testing.T,
  got []unicornImportStyleFinding,
  want ...unicornImportStyleFinding,
) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("finding count mismatch:\nwant %+v\ngot  %+v", want, got)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("finding[%d] mismatch:\nwant %+v\ngot  %+v\nall  %+v", index, want[index], got[index], got)
    }
  }
}

// TestRuleCorpusUnicornImportStyle verifies the corpus fixture: the
// built-in default table flags a namespace import of `node:path`, a
// default import of `node:util`, and a named import of `chalk`.
//
// The fixture runs with no options at all, so it pins the default
// `styles` table (`chalk`/`path` default-only, `util` named-only) and
// the `node:` prefix inheritance through the severity-only corpus path.
//
//  1. Enable unicorn/import-style via expect annotations only.
//  2. Import each default-table module in a disallowed style next to an
//     allowed twin.
//  3. Assert exactly the three annotated lines are reported.
func TestRuleCorpusUnicornImportStyle(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/import-style.ts", `// Default policies: import path/chalk by default import only, util by named only.
// expect: unicorn/import-style error
import * as path from "node:path";
// expect: unicorn/import-style error
import util from "node:util";
// expect: unicorn/import-style error
import { red } from "chalk";
import { inspect } from "node:util";
import pathDefault from "node:path";
import * as fs from "node:fs";

void path;
void util;
void red;
void inspect;
void pathDefault;
void fs;
`)
}

// TestUnicornImportStyleDefaultPoliciesAtExactRanges verifies the
// built-in table without options: `util` rejects default and namespace
// imports, `chalk` rejects named imports, and `node:` specifiers keep
// their spelling in the diagnostic while inheriting the bare policy.
//
// Upstream renders `Use {{allowedStyles}} import for module
// \x60{{moduleName}}\x60.`; the exact message text and the whole-declaration
// range are the observable contract, so both are asserted verbatim.
//
//  1. Run the rule with no options over six violations and four
//     compliant twins.
//  2. Assert finding order, exact source ranges, and exact messages.
func TestUnicornImportStyleDefaultPoliciesAtExactRanges(t *testing.T) {
  source := `import util from "util";
import * as util2 from "util";
import util3 from "node:util";
import { red } from "chalk";
import { red as green } from "chalk";
import * as path from "node:path";
import { inspect } from "util";
import chalk from "chalk";
import { default as chalk2 } from "chalk";
import path2 from "path";
void [util, util2, util3, red, green, path, inspect, chalk, chalk2, path2];
`
  findings := runUnicornImportStyleFindings(t, source, "")
  assertUnicornImportStyleFindings(
    t,
    findings,
    unicornImportStyleFinding{
      target:  `import util from "util";`,
      message: "Use named import for module `util`.",
    },
    unicornImportStyleFinding{
      target:  `import * as util2 from "util";`,
      message: "Use named import for module `util`.",
    },
    unicornImportStyleFinding{
      target:  `import util3 from "node:util";`,
      message: "Use named import for module `node:util`.",
    },
    unicornImportStyleFinding{
      target:  `import { red } from "chalk";`,
      message: "Use default import for module `chalk`.",
    },
    unicornImportStyleFinding{
      target:  `import { red as green } from "chalk";`,
      message: "Use default import for module `chalk`.",
    },
    unicornImportStyleFinding{
      target:  `import * as path from "node:path";`,
      message: "Use default import for module `node:path`.",
    },
  )
}

// TestUnicornImportStyleDefaultPoliciesSkipCompliantAndUnknownModules
// verifies the negative space of the default table: compliant styles,
// modules missing from the table, and `node:` builtins without a
// configured bare name produce no findings at all.
//
// An over-matching port would flag unaffected modules; this pins the
// module lookup to exact (prefix-stripped) names.
//
//  1. Import every default-table module in its allowed style.
//  2. Import unrelated modules in every style.
//  3. Assert zero findings under default options.
func TestUnicornImportStyleDefaultPoliciesSkipCompliantAndUnknownModules(t *testing.T) {
  assertRuleSkipsSource(t, unicornImportStyleRuleName, `import { inspect } from "util";
import { promisify as promise } from "node:util";
import chalk from "chalk";
import path from "path";
import nodePath from "node:path";
import fs from "node:fs";
import * as fs2 from "node:fs";
import { readFile } from "node:fs";
import fsPromises from "node:fs/promises";
import unknown from "node:unknown";
import lodash from "lodash";
void [inspect, promise, chalk, path, nodePath, fs, fs2, readFile, fsPromises, unknown, lodash];
`)
}

// TestUnicornImportStyleUnassignedPolicyAcceptsUnassignedForms verifies
// every syntax family that carries the unassigned style: side-effect
// imports, empty named clauses, bare dynamic imports, statement-level
// require calls, empty destructuring, and `export {} from`.
//
// These are the valid halves of upstream's `unassigned` module matrix;
// a port that classified `import {} from` as named would fail here.
//
//  1. Configure module `unassigned` to allow only the unassigned style.
//  2. Write each unassigned-style form once.
//  3. Assert zero findings.
func TestUnicornImportStyleUnassignedPolicyAcceptsUnassignedForms(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `require("unassigned");
const {} = require("unassigned");
import "unassigned";
import {} from "unassigned";
import("unassigned");
export {} from "unassigned";
`, unicornImportStylePolicyOptions)
}

// TestUnicornImportStyleUnassignedPolicyReportsEveryAssignedForm
// verifies the invalid half of the `unassigned` module matrix: any
// import form that binds something is reported with the exact upstream
// message.
//
// The declarator paths (require and awaited dynamic import) must
// classify the binding target, so identifier, object-pattern, aliased,
// rest, and array-pattern targets are all pinned here.
//
//  1. Configure module `unassigned` to allow only the unassigned style.
//  2. Write every assigned form upstream's suite rejects.
//  3. Assert one finding per statement with the exact message.
func TestUnicornImportStyleUnassignedPolicyReportsEveryAssignedForm(t *testing.T) {
  source := `const { x } = require("unassigned");
const { default: y } = require("unassigned");
const { a: z } = require("unassigned");
const { ...rest } = require("unassigned");
const [] = require("unassigned");
const whole = require("unassigned");
import def from "unassigned";
import * as ns from "unassigned";
import { named } from "unassigned";
import { named as alias } from "unassigned";
export * from "unassigned";
export { e } from "unassigned";
export { e as f } from "unassigned";
export { default } from "unassigned";
async () => {
  const { g } = await import("unassigned");
};
async () => {
  const h = await import("unassigned");
};
void [x, y, z, rest, whole, def, ns, named, alias];
`
  findings := runUnicornImportStyleFindings(t, source, unicornImportStylePolicyOptions)
  message := "Use unassigned import for module `unassigned`."
  if len(findings) != 16 {
    t.Fatalf("want 16 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
  if findings[0].target != `{ x } = require("unassigned")` {
    t.Fatalf("declarator range mismatch: %q", findings[0].target)
  }
  if findings[10].target != `export * from "unassigned";` {
    t.Fatalf("export-star range mismatch: %q", findings[10].target)
  }
  if findings[14].target != `{ g } = await import("unassigned")` {
    t.Fatalf("awaited-import declarator range mismatch: %q", findings[14].target)
  }
}

// TestUnicornImportStyleDefaultModulePolicyMatrix verifies the
// `default`-only module: default bindings pass, and the require paths
// additionally accept namespace-shaped targets because CommonJS interop
// cannot distinguish `x = require(...)` from a compiled default export.
//
// The interop extension applies to `require` only — `const x = await
// import("default")` stays a violation — which is the branch most
// easily lost in a port.
//
//  1. Configure module `default` to allow only the default style.
//  2. Assert the compliant forms (including require interop) are clean.
//  3. Assert each violating form reports the exact message.
func TestUnicornImportStyleDefaultModulePolicyMatrix(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `const x = require("default");
const { default: y } = require("default");
const [] = require("default");
import z from "default";
async () => {
  const { default: w } = await import("default");
  void w;
};
export { default } from "default";
void [x, y, z];
`, unicornImportStylePolicyOptions)

  source := `require("default");
const {} = require("default");
const { ...rest } = require("default");
import "default";
import {} from "default";
import("default");
import * as ns from "default";
const { a } = require("default");
import { b } from "default";
async () => {
  const c = await import("default");
};
export * from "default";
export { d } from "default";
void [rest, ns, a, b];
`
  findings := runUnicornImportStyleFindings(t, source, unicornImportStylePolicyOptions)
  message := "Use default import for module `default`."
  if len(findings) != 12 {
    t.Fatalf("want 12 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
  if findings[0].target != `require("default")` {
    t.Fatalf("bare require range mismatch: %q", findings[0].target)
  }
  if findings[5].target != `import("default")` {
    t.Fatalf("dynamic import range mismatch: %q", findings[5].target)
  }
}

// TestUnicornImportStyleNamespaceModulePolicyMatrix verifies the
// `namespace`-only module: namespace bindings and whole-object require
// targets pass, everything else is reported.
//
// `const x = require("namespace")` is valid because identifier targets
// are namespace-style; `const { default: x }` is a default-style
// violation. Array-binding targets also classify as namespace.
//
//  1. Configure module `namespace` to allow only the namespace style.
//  2. Assert the compliant forms are clean.
//  3. Assert each violating form reports the exact message.
func TestUnicornImportStyleNamespaceModulePolicyMatrix(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `const x = require("namespace");
const [] = require("namespace");
import * as y from "namespace";
async () => {
  const z = await import("namespace");
  void z;
};
export * from "namespace";
export * as ns from "namespace";
void [x, y];
`, unicornImportStylePolicyOptions)

  source := `require("namespace");
const {} = require("namespace");
import "namespace";
import {} from "namespace";
import("namespace");
const { default: a } = require("namespace");
const { ...rest } = require("namespace");
import b from "namespace";
const { c } = require("namespace");
import { d } from "namespace";
async () => {
  const { e } = await import("namespace");
};
export { f } from "namespace";
export { default } from "namespace";
void [a, rest, b, c, d];
`
  findings := runUnicornImportStyleFindings(t, source, unicornImportStylePolicyOptions)
  message := "Use namespace import for module `namespace`."
  if len(findings) != 13 {
    t.Fatalf("want 13 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
}

// TestUnicornImportStyleNamedModulePolicyMatrix verifies the
// `named`-only module across every syntax family, including the mixed
// `import util, {inspect}` form where one disallowed style among the
// actual styles is enough to report.
//
// Named destructuring of an awaited dynamic import passes while its
// array-pattern twin (namespace style) fails, pinning the
// binding-target classifier in both directions.
//
//  1. Configure module `named` to allow only the named style.
//  2. Assert the compliant forms are clean.
//  3. Assert each violating form reports the exact message.
func TestUnicornImportStyleNamedModulePolicyMatrix(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `const { x } = require("named");
const { ...rest } = require("named");
const { a: y } = require("named");
import { z } from "named";
import { z as w } from "named";
async () => {
  const { b } = await import("named");
};
async () => {
  const { c: d } = await import("named");
};
export { e } from "named";
export { e as f } from "named";
void [x, rest, y, z, w];
`, unicornImportStylePolicyOptions)

  source := `require("named");
const {} = require("named");
const [] = require("named");
import "named";
import {} from "named";
import("named");
const a = require("named");
const { default: b } = require("named");
import c from "named";
import * as ns from "named";
import util, { inspect } from "named";
async () => {
  const { default: d } = await import("named");
};
async () => {
  const [e] = await import("named");
};
async () => {
  const f = await import("named");
};
export * from "named";
export { default } from "named";
void [a, b, c, ns, util, inspect];
`
  findings := runUnicornImportStyleFindings(t, source, unicornImportStylePolicyOptions)
  message := "Use named import for module `named`."
  if len(findings) != 16 {
    t.Fatalf("want 16 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
  if findings[10].target != `import util, { inspect } from "named";` {
    t.Fatalf("mixed import range mismatch: %q", findings[10].target)
  }
  if findings[12].target != `[e] = await import("named")` {
    t.Fatalf("array-pattern declarator range mismatch: %q", findings[12].target)
  }
}

// TestUnicornImportStyleAcceptsMixedStylesWhenAllAllowed verifies that
// a reference carrying several actual styles is compliant when every
// one of them is allowed: `import util, {inspect}` under a module that
// allows both named and default.
//
// The report predicate is `every actual ∈ allowed`; asserting the
// two-style positive prevents an accidental `some` in the port.
//
//  1. Allow named and default for one module.
//  2. Import both styles in one declaration.
//  3. Assert zero findings.
func TestUnicornImportStyleAcceptsMixedStylesWhenAllAllowed(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `import util, { inspect } from "named-or-default";
void [util, inspect];
`, `{"styles": {"named-or-default": {"named": true, "default": true}}}`)
}

// TestUnicornImportStyleDisjunctionListsAllowedStylesInOrder verifies
// the message formatter against upstream's en-US disjunction list:
// three styles render as "a, b, or c" in configuration order, two as
// "a or b" with the inherited default first.
//
// Style order comes from JavaScript object-spread semantics (defaults
// first, then user-added keys), which the ordered JSON decoding must
// reproduce.
//
//  1. Configure a module with three allowed styles and violate it.
//  2. Extend `util` (default `named`) with `default` and violate it.
//  3. Assert both exact messages.
func TestUnicornImportStyleDisjunctionListsAllowedStylesInOrder(t *testing.T) {
  findings := runUnicornImportStyleFindings(
    t,
    "require(\"no-unassigned\");\n",
    `{"styles": {"no-unassigned": {"named": true, "namespace": true, "default": true}}}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `require("no-unassigned")`,
    message: "Use named, namespace, or default import for module `no-unassigned`.",
  })

  findings = runUnicornImportStyleFindings(
    t,
    "import * as util from \"node:util\";\nvoid util;\n",
    `{"styles": {"util": {"default": true}}}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `import * as util from "node:util";`,
    message: "Use named or default import for module `node:util`.",
  })
}

// TestUnicornImportStyleStyleOverridesReplaceInheritedFlags verifies
// per-style overrides on top of the default table: `util: false`
// clears the policy, `util: {named: false}` disables the only allowed
// style (leaving the module unrestricted, not banned), and explicit
// `{default: true, named: false}` swaps the allowed style.
//
// These are upstream's regression cases for the merge semantics where
// `false` must not turn a module into a banned one.
//
//  1. Run each override against every style of `node:util`.
//  2. Assert the unrestricted overrides yield zero findings.
//  3. Assert the swapped policy reports named imports with the swapped
//     message.
func TestUnicornImportStyleStyleOverridesReplaceInheritedFlags(t *testing.T) {
  everyStyle := `import util from "node:util";
import * as util2 from "node:util";
import { foo } from "node:util";
void [util, util2, foo];
`
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    everyStyle,
    `{"styles": {"util": false}}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    everyStyle,
    `{"styles": {"util": {"named": false}}}`,
  )

  findings := runUnicornImportStyleFindings(
    t,
    "import { promisify } from \"node:util\";\nvoid promisify;\n",
    `{"styles": {"util": {"default": true, "named": false}}}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `import { promisify } from "node:util";`,
    message: "Use default import for module `node:util`.",
  })

  findings = runUnicornImportStyleFindings(
    t,
    "import * as fs from \"node:fs\";\nvoid fs;\n",
    `{"styles": {"fs": {"default": true}}}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `import * as fs from "node:fs";`,
    message: "Use default import for module `node:fs`.",
  })
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    "import * as fs from \"node:fs\";\nvoid fs;\n",
    `{"styles": {"fs": {"namespace": true}}}`,
  )
}

// TestUnicornImportStyleCheckTogglesDisableEachSyntaxFamily verifies
// the four `check*` switches: each one silences exactly its own syntax
// family, and `checkExportFrom` defaults to off.
//
// A port wiring a toggle to the wrong listener (for example
// `checkDynamicImport` to the declarator path only) would pass a
// smoke test but fail one of these targeted probes.
//
//  1. Violate one family per toggle with the toggle disabled.
//  2. Assert zero findings for each.
//  3. Re-enable `checkExportFrom` and assert the export is reported.
func TestUnicornImportStyleCheckTogglesDisableEachSyntaxFamily(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    "import \"chalk\";\n",
    `{"checkImport": false}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    `import("chalk");
async () => {
  const { red } = await import("chalk");
  void red;
};
`,
    `{"checkDynamicImport": false}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    `require("chalk");
const { red } = require("chalk");
void red;
`,
    `{"checkRequire": false}`,
  )
  assertRuleSkipsSource(t, unicornImportStyleRuleName, "export * from \"util\";\n")

  findings := runUnicornImportStyleFindings(
    t,
    "export * from \"util\";\n",
    `{"checkExportFrom": true}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `export * from "util";`,
    message: "Use named import for module `util`.",
  })
}

// TestUnicornImportStyleExtendDefaultStylesFalseDropsBuiltinPolicies
// verifies `extendDefaultStyles: false`: the built-in table disappears
// entirely, leaving only the user's own module policies active.
//
// Without this branch the defaults would leak through and flag `chalk`
// and `util` even when the user replaced the table.
//
//  1. Disable extension with an empty and a single-module table.
//  2. Assert former default-table modules are unrestricted.
//  3. Assert the user's own module policy still fires.
func TestUnicornImportStyleExtendDefaultStylesFalseDropsBuiltinPolicies(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    `require("chalk");
import util from "util";
import { red } from "chalk";
void [util, red];
`,
    `{"styles": {}, "extendDefaultStyles": false}`,
  )

  findings := runUnicornImportStyleFindings(
    t,
    `import util from "util";
import custom from "custom";
void [util, custom];
`,
    `{"styles": {"custom": {"named": true}}, "extendDefaultStyles": false}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `import custom from "custom";`,
    message: "Use named import for module `custom`.",
  })
}

// TestUnicornImportStyleBannedModuleReportsDedicatedMessage verifies
// the misuse diagnostic: a module whose four canonical styles are all
// explicitly `false` reports upstream's banned-module message on every
// import form, with and without `extendDefaultStyles`.
//
// The banned set is computed from explicit `false` entries only, so a
// near-miss (one style merely omitted) must stay completely silent.
//
//  1. Ban a module and exercise every syntax family.
//  2. Assert the dedicated message on each form.
//  3. Assert the three-of-four near-miss produces no findings.
func TestUnicornImportStyleBannedModuleReportsDedicatedMessage(t *testing.T) {
  bannedOptions := `{
    "checkExportFrom": true,
    "extendDefaultStyles": false,
    "styles": {"banned": {"unassigned": false, "default": false, "namespace": false, "named": false}}
  }`
  source := `import "banned";
import foo from "banned";
import * as bar from "banned";
import { baz } from "banned";
import("banned");
require("banned");
const qux = require("banned");
async () => {
  const quux = await import("banned");
};
export { corge } from "banned";
export * from "banned";
void [foo, bar, baz, qux];
`
  findings := runUnicornImportStyleFindings(t, source, bannedOptions)
  message := "All import styles are disabled for module `banned`. Use the `no-restricted-imports` rule to disallow a module."
  if len(findings) != 10 {
    t.Fatalf("want 10 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }

  extendedFindings := runUnicornImportStyleFindings(
    t,
    "import \"banned\";\n",
    `{"styles": {"banned": {"unassigned": false, "default": false, "namespace": false, "named": false}}}`,
  )
  assertUnicornImportStyleFindings(t, extendedFindings, unicornImportStyleFinding{
    target:  `import "banned";`,
    message: message,
  })

  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    "import foo from \"almost-banned\";\nvoid foo;\n",
    `{"styles": {"almost-banned": {"default": false, "namespace": false, "named": false}}}`,
  )
}

// TestUnicornImportStyleSkipsNonMatchingReferenceShapes verifies the
// structural negatives upstream never reports: multi-argument or
// non-static require calls, member and assignment positions,
// `import … = require(…)` equals-declarations, and local exports.
//
// Each shape is one property away from a reported form, so any
// over-broad matcher in the call or declarator path fails here. One
// deliberate deviation hides in `const y = require()`: upstream throws
// (`sourceCode.getScope(undefined)`) on the argument-less declarator,
// so graceful silence is this port's canonical replacement for a crash.
//
//  1. Configure the four policy modules plus default table.
//  2. Write every near-miss shape.
//  3. Assert zero findings.
func TestUnicornImportStyleSkipsNonMatchingReferenceShapes(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `declare const variable: string;
declare function require(name?: unknown, extra?: unknown, more?: unknown): { x: number };
declare const foo: { require(name: string): void };
require(1, 2, 3);
require(variable);
require();
require?.("util");
const x = require(variable);
const y = require();
const z = require("unassigned").x;
let assigned;
assigned = require("util");
foo.require("util");
import legacy = require("util");
const p = variable ? 1 : 2;
export { p };
export const q = 1;
async () => {
  const { red } = await import(variable);
};
void [x, y, z, assigned, legacy];
`, unicornImportStylePolicyOptions)
}

// TestUnicornImportStyleOptionalRequireCallsAreNeverClassified verifies
// that `require?.(…)` stays silent in both listener positions: the
// statement listener requires a non-optional call, and the declarator
// listener never fires because ESTree wraps optional calls in a
// ChainExpression, so upstream's `init.type === 'CallExpression'` check
// fails (verified against eslint-plugin-unicorn 71.1.0).
//
//  1. Run both optional-call shapes against the default `util` policy.
//  2. Assert zero findings.
func TestUnicornImportStyleOptionalRequireCallsAreNeverClassified(t *testing.T) {
  assertRuleSkipsSource(t, unicornImportStyleRuleName, `require?.("util");
const util = require?.("util");
void util;
`)
}

// TestUnicornImportStyleEvaluatesStaticStringModuleNames verifies the
// static-string evaluator behind module resolution: literal
// concatenation, `node:` assembled from parts, template literals, and
// templates with static substitutions all resolve, while expressions
// with non-static parts stay silent.
//
// Upstream resolves these through eslint-utils' getStringIfConstant;
// the port must at least cover the concatenation forms upstream's own
// test suite pins.
//
//  1. Require `util` through four static spellings under default
//     options.
//  2. Assert each resolves to the util policy with the right module
//     spelling in the message.
//  3. Assert a concatenation with an identifier reports nothing.
func TestUnicornImportStyleEvaluatesStaticStringModuleNames(t *testing.T) {
  source := "require('ut' + 'il');\n" +
    "require('node:' + 'util');\n" +
    "require(`util`);\n" +
    "const u = require(`${'ut'}${'il'}`);\n" +
    "void u;\n"
  findings := runUnicornImportStyleFindings(t, source, "")
  assertUnicornImportStyleFindings(
    t,
    findings,
    unicornImportStyleFinding{
      target:  "require('ut' + 'il')",
      message: "Use named import for module `util`.",
    },
    unicornImportStyleFinding{
      target:  "require('node:' + 'util')",
      message: "Use named import for module `node:util`.",
    },
    unicornImportStyleFinding{
      target:  "require(`util`)",
      message: "Use named import for module `util`.",
    },
    unicornImportStyleFinding{
      target:  "u = require(`${'ut'}${'il'}`)",
      message: "Use named import for module `util`.",
    },
  )

  assertRuleSkipsSource(t, unicornImportStyleRuleName, `declare const il: string;
require("ut" + il);
`)
}

// TestUnicornImportStyleTypeOnlyImportsFollowValueSemantics verifies
// upstream's TypeScript cases: type-only imports classify exactly like
// value imports — a default type import of `chalk` passes while named
// type imports (inline or clause-level) are reported.
//
// The rule reads specifier shape only; an accidental type-only
// exemption would silently unlock named imports of default-only
// modules.
//
//  1. Run type-only positives and negatives against the default table
//     and the named policy module.
//  2. Assert the two named type imports of `chalk` are reported.
//  3. Assert the compliant type imports stay silent.
func TestUnicornImportStyleTypeOnlyImportsFollowValueSemantics(t *testing.T) {
  assertRuleSkipsSource(t, unicornImportStyleRuleName, `import type chalk from "chalk";
void 0;
`)
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    "import type { x } from \"named\";\nvoid 0;\n",
    unicornImportStylePolicyOptions,
  )

  source := `import { type ChalkInstance } from "chalk";
import type { ChalkOptions } from "chalk";
void 0;
`
  findings := runUnicornImportStyleFindings(t, source, "")
  assertUnicornImportStyleFindings(
    t,
    findings,
    unicornImportStyleFinding{
      target:  `import { type ChalkInstance } from "chalk";`,
      message: "Use default import for module `chalk`.",
    },
    unicornImportStyleFinding{
      target:  `import type { ChalkOptions } from "chalk";`,
      message: "Use default import for module `chalk`.",
    },
  )
}

// TestUnicornImportStyleDynamicImportExpressionForms verifies the two
// dynamic-import listeners: a bare or promise-assigned `import()` is
// unassigned style, an `(await import()).member` access is unassigned,
// and only the exact `const … = await import(…)` declarator shape is
// routed to the binding-target classifier.
//
// The skip predicate (isAssignedDynamicImport) must not swallow the
// non-declarator awaits, or those violations vanish.
//
//  1. Violate the default-only `chalk` policy through each dynamic
//     form.
//  2. Assert every form reports with the default-import message.
//  3. Assert the compliant awaited-default destructure is silent.
func TestUnicornImportStyleDynamicImportExpressionForms(t *testing.T) {
  assertRuleSkipsSource(t, unicornImportStyleRuleName, `async () => {
  const { default: chalk } = await import("chalk");
  void chalk;
};
`)

  source := `import("chalk");
const promise = import("chalk");
async () => {
  const { red } = await import("chalk");
  void red;
};
async () => {
  const chalk = await import("chalk");
  void chalk;
};
async () => {
  const value = (await import("chalk")).default;
  void value;
};
void promise;
`
  findings := runUnicornImportStyleFindings(t, source, "")
  message := "Use default import for module `chalk`."
  if len(findings) != 5 {
    t.Fatalf("want 5 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
  if findings[0].target != `import("chalk")` {
    t.Fatalf("bare dynamic import range mismatch: %q", findings[0].target)
  }
  // A promise-assigned dynamic import (no await) reports at the import
  // expression itself, exactly like upstream's ImportExpression listener.
  if findings[1].target != `import("chalk")` {
    t.Fatalf("promise-assigned dynamic import range mismatch: %q", findings[1].target)
  }
  if findings[4].target != `import("chalk")` {
    t.Fatalf("member-access dynamic import range mismatch: %q", findings[4].target)
  }
}

// TestUnicornImportStyleObjectPatternKeyForms verifies the
// binding-target classifier's key handling: identifier keys classify
// by name, computed identifier keys count as named, and literal keys
// contribute no style at all (leaving the reference compliant).
//
// Upstream checks `property.key.type === 'Identifier'` without a
// computed guard, so `{[key]: x}` is named while `{"literal": x}` and
// `{0: x}` are unclassified — asymmetries worth pinning.
//
//  1. Destructure `named` and `default` policy modules with each key
//     form.
//  2. Assert literal keys stay silent even under the default-only
//     policy.
//  3. Assert computed identifier keys count as named.
func TestUnicornImportStyleObjectPatternKeyForms(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `declare const key: string;
const { "literal": a } = require("default");
const { 0: b } = require("default");
const { [key]: c } = require("named");
void [a, b, c];
`, unicornImportStylePolicyOptions)

  findings := runUnicornImportStyleFindings(
    t,
    `declare const key: string;
const { [key]: c } = require("default");
void c;
`,
    unicornImportStylePolicyOptions,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `{ [key]: c } = require("default")`,
    message: "Use default import for module `default`.",
  })
}

// TestUnicornImportStyleRejectsMalformedOptionsBeforeLinting verifies
// option validation happens at engine construction: every schema
// violation upstream's JSON schema rejects surfaces as a config error
// before any file is linted.
//
// Silent acceptance would let a typo disable the rule without any
// signal, the exact failure mode the stub this rule replaces had.
//
//  1. Build an engine with each malformed payload.
//  2. Assert ConfigError carries the expected message fragment.
func TestUnicornImportStyleRejectsMalformedOptionsBeforeLinting(t *testing.T) {
  cases := []struct {
    name    string
    options string
    want    string
  }{
    {name: "not object", options: `[]`, want: "must be an object"},
    {name: "unknown key", options: `{"stylez": {}}`, want: `unknown option "stylez"`},
    {name: "non-boolean toggle", options: `{"checkImport": "yes"}`, want: `option "checkImport" must be a boolean`},
    {name: "null toggle", options: `{"checkRequire": null}`, want: `option "checkRequire" must be a boolean`},
    {name: "styles not object", options: `{"styles": true}`, want: `option "styles" must be an object`},
    {name: "styles null", options: `{"styles": null}`, want: `option "styles" must be an object`},
    {name: "module string", options: `{"styles": {"util": "named"}}`, want: `styles entry "util" must be false or an object of booleans`},
    {name: "module true", options: `{"styles": {"util": true}}`, want: `styles entry "util" must be false or an object of booleans`},
    {name: "module null", options: `{"styles": {"util": null}}`, want: `styles entry "util" must be false or an object of booleans`},
    {name: "style non-boolean", options: `{"styles": {"util": {"named": "x"}}}`, want: `style "named" of module "util" must be a boolean`},
    {name: "style null", options: `{"styles": {"util": {"named": null}}}`, want: `style "named" of module "util" must be a boolean`},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules: RuleConfig{unicornImportStyleRuleName: SeverityError},
        Options: RuleOptionsMap{
          unicornImportStyleRuleName: json.RawMessage(test.options),
        },
      })
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), test.want) {
        t.Fatalf("ConfigError: want substring %q, got %v", test.want, err)
      }
    })
  }
}

// TestUnicornImportStyleReportsNoAutomaticFixes verifies the rule is
// diagnostic-only through the real fix applier: a violation yields a
// finding but `ttsc fix` applies nothing and the source is unchanged.
//
// Upstream ships no fixer for this rule; an accidental edit here would
// rewrite user imports non-semantically.
//
//  1. Violate the default `util` policy.
//  2. Run the fix pipeline.
//  3. Assert zero applied fixes and byte-identical source.
func TestUnicornImportStyleReportsNoAutomaticFixes(t *testing.T) {
  assertNoFixSnapshot(t, unicornImportStyleRuleName, "import util from \"util\";\nvoid util;\n")
}
