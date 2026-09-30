package linthost

import (
  "testing"
)

// TestNoImportAssignIgnoresResolvedShadowsAndDeeperValues prevents every
// name-based false positive while keeping namespace protection shallow, as the
// official rule requires. Local Object/Reflect declarations also prove the
// mutation-function recognition follows the global binding.
//
// @evidence contracts/testing.md#behavioral-verification The checker-backed engine leaves resolved local shadows, imported ordinary-object members and deeper namespace values clean.
// @evidence contracts/testing.md#independent-expectations Read-only import binding semantics do not freeze referenced object values or unrelated same-spelled local bindings; an authored zero result follows this identity and depth distinction.
// @evidence contracts/testing.md#distinguishing-cases Parameters, block/catch/type/function/class/static shadows, local Object/Reflect, allowed nonmutators, deeper namespace paths and import-equals members guard against lexical-name and recursive-freeze false positives.
// @evidence contracts/testing.md#execution-ownership runNoImportAssignProject loads the authored shadow/depth fixture into a Program/checker and calls program.runLintCycle. This Test owns the zero-result assertion for the complete source, without a product-host process.
func TestNoImportAssignIgnoresResolvedShadowsAndDeeperValues(t *testing.T) {
  source := `import defaultValue, { value, value as aliased } from "./dep";
import * as namespaceValue from "./dep";
import type { Model as ImportedModel } from "./dep";
import legacy = require("./dep");

declare const record: Record<string, any>;
declare function consume(value: unknown): void;

defaultValue.member = 1;
(defaultValue.member as any) += 1;
defaultValue.member++;
delete defaultValue.member;
for (defaultValue.member in record) {}
[defaultValue.member] = [record];
({ ...defaultValue.member } = record);
(value as any).member = 2;
namespaceValue.member.deep = 3;
namespaceValue["member"].deep = 4;
namespaceValue.member.deep++;
delete namespaceValue.member.deep;
for (namespaceValue.member.deep of []) {}
[namespaceValue.member.deep] = [];
({ ...namespaceValue.member.deep } = record);
Object.assign(namespaceValue.member, {});
Object.defineProperty(namespaceValue.member, "deep", {});
Object.assign(defaultValue, {});
Object.seal(namespaceValue);
Object.preventExtensions(namespaceValue);
Object.getPrototypeOf(namespaceValue);
Object[record.method](namespaceValue, {});
Reflect.preventExtensions(namespaceValue);
consume(namespaceValue);
legacy.member = 5;
({ [value]: record.local, key: record.other = value } = record);

function functionShadow(
  value: number,
  aliased: number,
  namespaceValue: { member: number },
  Object: { assign(target: object, source: object): object },
  Reflect: { set(target: object, key: string, value: unknown): boolean },
) {
  value = 1;
  ++aliased;
  namespaceValue.member = 2;
  Object.assign(namespaceValue, {});
  Reflect.set(namespaceValue, "member", 3);
}

function declarationShadows() {
  function value() {}
  value = function replacement() {};

  class namespaceValue {
    static member = 0;
  }
  namespaceValue = class replacement {};
  namespaceValue.member++;
}

function typeDeclarationShadow() {
  type ImportedModel = { local: true };
  ImportedModel = null as never;
}

{
  let value = 0;
  let namespaceValue = { member: 0 };
  [value] = [1];
  for (value of [1]) {}
  namespaceValue["member"]++;
}

try {
  throw 0;
} catch (value) {
  value = 1;
}

class ShadowContainer {
  method(value: number, namespaceValue: { member: number }) {
    value += 1;
    delete namespaceValue.member;
  }

  static {
    let value = 0;
    value++;
  }
}

consume(functionShadow);
consume(declarationShadows);
consume(typeDeclarationShadow);
consume(ShadowContainer);
`

  findings := runNoImportAssignProject(t, source)
  if len(findings) != 0 {
    t.Fatalf("resolved shadows and deeper imported values must stay clean, got %+v", findings)
  }
}
