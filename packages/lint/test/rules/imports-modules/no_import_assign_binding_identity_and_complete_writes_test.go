package linthost

import (
  "testing"
)

// TestNoImportAssignBindingIdentityAndCompleteWrites pins every supported write
// surface to the actual import symbol rather than its spelling. It also verifies
// the ESLint namespace-mutation functions and exact outer mutation ranges.
//
// @evidence contracts/testing.md#behavioral-verification The checker-backed no-import-assign engine reports every authored import-binding and shallow namespace mutation with exact full mutation spans, rule/severity/messages and no edits.
// @evidence contracts/testing.md#independent-expectations ECMAScript imports are read-only bindings; namespace exports are read-only members. Literal marked snippets and binding/member messages specify all expected ranges independently of findings.
// @evidence contracts/testing.md#distinguishing-cases Assignments, updates, loop targets, destructuring, TS wrappers, namespace mutators, duplicate source-name aliases and type-only/import-equals bindings cover positive write surfaces; resolved shadows and deeper values have a separate negative case.
// @evidence contracts/testing.md#execution-ownership runNoImportAssignProject loads the authored dependency fixture files into a Program/checker and calls program.runLintCycle. assertNoImportAssignFindings compares the complete marked literal range/message list; this Test owns every write in that list.
func TestNoImportAssignBindingIdentityAndCompleteWrites(t *testing.T) {
  source := `import defaultValue, {
  value,
  value as aliased,
  same as sameA,
  type Model,
} from "./dep";
import { same as sameB } from "./dep2";
import * as namespaceValue from "./dep";
import type * as typeNamespace from "./dep";
import type DefaultModel from "./dep-default";
import type { Model as TypeAlias } from "./dep";
import legacy = require("./dep");

declare const replacement: typeof defaultValue;
declare const values: any[];
declare const record: Record<string, any>;

/* no-import-assign:start */defaultValue = replacement/* no-import-assign:end */;
/* no-import-assign:start */value += 1/* no-import-assign:end */;
/* no-import-assign:start */++aliased/* no-import-assign:end */;
/* no-import-assign:start */aliased--/* no-import-assign:end */;
(/* no-import-assign:start */[value] = values/* no-import-assign:end */);
(/* no-import-assign:start */{ key: aliased = 0 } = record/* no-import-assign:end */);
(/* no-import-assign:start */{ value } = record/* no-import-assign:end */);
(/* no-import-assign:start */[...aliased] = values/* no-import-assign:end */);
(/* no-import-assign:start */[value = replacement] = values/* no-import-assign:end */);
(/* no-import-assign:start */{ ...aliased } = record/* no-import-assign:end */);
(/* no-import-assign:start */[value, aliased] = values/* no-import-assign:end */);
(/* no-import-assign:start */(value as any) = replacement/* no-import-assign:end */);
/* no-import-assign:start */for (value of values) {}/* no-import-assign:end */
/* no-import-assign:start */for (aliased in record) {}/* no-import-assign:end */

/* no-import-assign:start */namespaceValue.member = 1/* no-import-assign:end */;
/* no-import-assign:start */namespaceValue.member += 1/* no-import-assign:end */;
/* no-import-assign:start */namespaceValue["member"]++/* no-import-assign:end */;
/* no-import-assign:start */++namespaceValue.member/* no-import-assign:end */;
/* no-import-assign:start */delete namespaceValue.member/* no-import-assign:end */;
/* no-import-assign:start */delete namespaceValue?.member/* no-import-assign:end */;
(/* no-import-assign:start */[namespaceValue.member] = values/* no-import-assign:end */);
(/* no-import-assign:start */{ key: namespaceValue.member = 0 } = record/* no-import-assign:end */);
(/* no-import-assign:start */{ ...namespaceValue.member } = record/* no-import-assign:end */);
(/* no-import-assign:start */namespaceValue[replacement as any] = 1/* no-import-assign:end */);
/* no-import-assign:start */for (namespaceValue["member"] of values) {}/* no-import-assign:end */
/* no-import-assign:start */namespaceValue = replacement/* no-import-assign:end */;

/* no-import-assign:start */Object["assign"](namespaceValue, {})/* no-import-assign:end */;
/* no-import-assign:start */Object.defineProperty(namespaceValue, "x", {})/* no-import-assign:end */;
/* no-import-assign:start */(Object?.defineProperty)(namespaceValue, "y", {})/* no-import-assign:end */;
/* no-import-assign:start */Object.defineProperties(namespaceValue, {})/* no-import-assign:end */;
/* no-import-assign:start */Object.freeze(namespaceValue)/* no-import-assign:end */;
/* no-import-assign:start */Object.setPrototypeOf(namespaceValue, null)/* no-import-assign:end */;
/* no-import-assign:start */Reflect.defineProperty(namespaceValue, "x", {})/* no-import-assign:end */;
/* no-import-assign:start */Reflect.deleteProperty(namespaceValue, "x")/* no-import-assign:end */;
/* no-import-assign:start */Reflect.set(namespaceValue, "x", 1)/* no-import-assign:end */;
/* no-import-assign:start */Reflect.setPrototypeOf(namespaceValue, null)/* no-import-assign:end */;

/* no-import-assign:start */sameA = 1/* no-import-assign:end */;
/* no-import-assign:start */sameB = 2/* no-import-assign:end */;
/* no-import-assign:start */legacy = null as never/* no-import-assign:end */;
/* no-import-assign:start */Model = null as never/* no-import-assign:end */;
/* no-import-assign:start */DefaultModel = null as never/* no-import-assign:end */;
/* no-import-assign:start */TypeAlias = null as never/* no-import-assign:end */;
(/* no-import-assign:start */{ Model } = record/* no-import-assign:end */);
/* no-import-assign:start */typeNamespace = null as never/* no-import-assign:end */;
/* no-import-assign:start */typeNamespace.member = 1/* no-import-assign:end */;
`

  binding := func(snippet, name string) noImportAssignExpectedFinding {
    return noImportAssignExpectedFinding{snippet: snippet, message: "'" + name + "' is read-only."}
  }
  member := func(snippet, name string) noImportAssignExpectedFinding {
    return noImportAssignExpectedFinding{snippet: snippet, message: "The members of '" + name + "' are read-only."}
  }
  expected := []noImportAssignExpectedFinding{
    binding("defaultValue = replacement", "defaultValue"),
    binding("value += 1", "value"),
    binding("++aliased", "aliased"),
    binding("aliased--", "aliased"),
    binding("[value] = values", "value"),
    binding("{ key: aliased = 0 } = record", "aliased"),
    binding("{ value } = record", "value"),
    binding("[...aliased] = values", "aliased"),
    binding("[value = replacement] = values", "value"),
    binding("{ ...aliased } = record", "aliased"),
    binding("[value, aliased] = values", "value"),
    binding("[value, aliased] = values", "aliased"),
    binding("(value as any) = replacement", "value"),
    binding("for (value of values) {}", "value"),
    binding("for (aliased in record) {}", "aliased"),
    member("namespaceValue.member = 1", "namespaceValue"),
    member("namespaceValue.member += 1", "namespaceValue"),
    member("namespaceValue[\"member\"]++", "namespaceValue"),
    member("++namespaceValue.member", "namespaceValue"),
    member("delete namespaceValue.member", "namespaceValue"),
    member("delete namespaceValue?.member", "namespaceValue"),
    member("[namespaceValue.member] = values", "namespaceValue"),
    member("{ key: namespaceValue.member = 0 } = record", "namespaceValue"),
    member("{ ...namespaceValue.member } = record", "namespaceValue"),
    member("namespaceValue[replacement as any] = 1", "namespaceValue"),
    member("for (namespaceValue[\"member\"] of values) {}", "namespaceValue"),
    binding("namespaceValue = replacement", "namespaceValue"),
    member("Object[\"assign\"](namespaceValue, {})", "namespaceValue"),
    member("Object.defineProperty(namespaceValue, \"x\", {})", "namespaceValue"),
    member("(Object?.defineProperty)(namespaceValue, \"y\", {})", "namespaceValue"),
    member("Object.defineProperties(namespaceValue, {})", "namespaceValue"),
    member("Object.freeze(namespaceValue)", "namespaceValue"),
    member("Object.setPrototypeOf(namespaceValue, null)", "namespaceValue"),
    member("Reflect.defineProperty(namespaceValue, \"x\", {})", "namespaceValue"),
    member("Reflect.deleteProperty(namespaceValue, \"x\")", "namespaceValue"),
    member("Reflect.set(namespaceValue, \"x\", 1)", "namespaceValue"),
    member("Reflect.setPrototypeOf(namespaceValue, null)", "namespaceValue"),
    binding("sameA = 1", "sameA"),
    binding("sameB = 2", "sameB"),
    binding("legacy = null as never", "legacy"),
    binding("Model = null as never", "Model"),
    binding("DefaultModel = null as never", "DefaultModel"),
    binding("TypeAlias = null as never", "TypeAlias"),
    binding("{ Model } = record", "Model"),
    binding("typeNamespace = null as never", "typeNamespace"),
    member("typeNamespace.member = 1", "typeNamespace"),
  }

  findings := runNoImportAssignProject(t, source)
  assertNoImportAssignFindings(t, source, findings, expected)
}
