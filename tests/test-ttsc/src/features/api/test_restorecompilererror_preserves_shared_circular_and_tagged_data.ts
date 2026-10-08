import assert from "node:assert/strict";

import { restoreCompilerError } from "../../../../../packages/ttsc/src/internal/restoreCompilerError";
import { serializeCompilerError } from "../../../../../packages/ttsc/src/internal/serializeCompilerError";

/**
 * Verifies compiler-error reception preserves shared, circular and tagged data.
 *
 * JSON-pointer markers describe identities, not new Error messages. Forward
 * targets and escaped property names must connect the original graph without
 * recursion, while exceptional values remain the serializer's descriptions.
 *
 * 1. Serialize and restore shared causes and escaped custom property targets.
 * 2. Restore a self-referencing aggregate and nested independent error trees.
 * 3. Preserve plain outcome cycles, literal marker metadata and tagged values.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual serializeCompilerError and restoreCompilerError restore messages, errno fields, shared identity, self causes/aggregate members and non-Error outcome data; getter counts and literal tagged values verify restoration does not execute or fabricate exceptional values.
 * @evidence contracts/testing.md#independent-expectations Original authored object relationships define which received references must be identical, while literal messages, errno and tag shapes define their values independently of the restoring traversal.
 * @evidence contracts/testing.md#distinguishing-cases Shared versus independent Error objects, escaped forward targets, root cycles, nested aggregates, plain cyclic outcomes, primitive members and tagged/accessor fields cover meaningful transport branches. Literal reference and envelope shapes, reserved Error metadata and cycles/shared targets inside escaped objects distinguish user data from generated control markers. Worker ownership classification remains in the dedicated cleanup-reply unit.
 * @evidence contracts/testing.md#execution-ownership One discoverable same-process unit calls maintained serializer/receiver directly with authored objects and no worker, compiler, filesystem, installed consumer or foreign replacement.
 */
export function test_restorecompilererror_preserves_shared_circular_and_tagged_data(): void {
  const shared = Object.assign(new Error("native cleanup denied"), { code: "EPERM" });
  const source = Object.assign(new AggregateError([shared, new Error("independent")], "outer", { cause: shared }), { "a~/": shared, again: shared });
  const received = restoreCompilerError(serializeCompilerError(source)) as AggregateError & { "a~/": Error; again: Error };
  assert.ok(received instanceof AggregateError);
  assert.equal(received.message, "outer");
  assert.equal(received.errors[0], received.cause);
  assert.equal(received["a~/"], received.cause);
  assert.equal(received.again, received.cause);
  assert.equal((received.cause as NodeJS.ErrnoException).code, "EPERM");
  assert.deepEqual(received.errors.map((error: Error) => error.message), ["native cleanup denied", "independent"]);
  const circular = new AggregateError([], "circular");
  circular.errors.push(circular, "primitive member");
  circular.cause = circular;
  const cycle = restoreCompilerError(serializeCompilerError(circular)) as AggregateError;
  assert.equal(cycle.cause, cycle);
  assert.equal(cycle.errors[0], cycle);
  assert.equal(cycle.errors[1], "primitive member");
  const sharedMembers = new AggregateError([new Error("shared array member")], "shared array");
  sharedMembers.cause = sharedMembers.errors;
  const sharedArray = restoreCompilerError(serializeCompilerError(sharedMembers)) as AggregateError;
  assert.ok(sharedArray instanceof AggregateError);
  assert.equal(sharedArray.errors, sharedArray.cause);
  assert.ok(sharedArray.errors[0] instanceof Error);
  assert.equal(sharedArray.errors[0].message, "shared array member");
  let nested: Error = new Error("leaf");
  for (let index = 0; index < 100; index++) nested = new AggregateError([nested], `level-${index}`);
  let current = restoreCompilerError(serializeCompilerError(nested));
  for (let index = 99; index >= 0; index--) {
    assert.ok(current instanceof AggregateError);
    assert.equal(current.message, `level-${index}`);
    current = current.errors[0];
  }
  assert.equal(current.message, "leaf");
  let getterCalls = 0;
  const outcome: Record<string, unknown> = { status: 23 };
  outcome.self = outcome;
  const sparse = new Array(7);
  sparse[0] = "first";
  const exceptional = Object.assign(new Error("exceptional"), { outcome, sparse, missing: undefined, big: 7n });
  Object.defineProperty(exceptional, "unread", { enumerable: true, get: () => { getterCalls++; return "must not execute"; } });
  const result = restoreCompilerError(serializeCompilerError(exceptional)) as Error & Record<string, unknown>;
  assert.equal(getterCalls, 0);
  const restoredOutcome = result.outcome as Record<string, unknown>;
  assert.equal(restoredOutcome.self, restoredOutcome);
  assert.equal(restoredOutcome.status, 23);
  assert.equal(restoredOutcome instanceof Error, false);
  assert.equal((result.sparse as unknown[]).length, 7);
  assert.deepEqual(Object.keys(result.sparse as unknown[]), ["0"]);
  assert.deepEqual(result.missing, { $ttscValue: "undefined" });
  assert.deepEqual(result.big, { $ttscValue: "bigint", value: "7" });
  assert.deepEqual(result.unread, { $ttscValue: "accessor" });
  const metadata = Object.assign(new Error("outer metadata", { cause: new Error("inner metadata") }), { $ttscReference: "/cause", custom: 17 });
  const restoredMetadata = restoreCompilerError(serializeCompilerError(metadata)) as Error & { $ttscReference: string; custom: number };
  assert.equal(restoredMetadata.message, "outer metadata");
  assert.equal((restoredMetadata.cause as Error).message, "inner metadata");
  assert.equal(restoredMetadata.$ttscReference, "/cause");
  assert.equal(restoredMetadata.custom, 17);
  const literalReference = { $ttscReference: "" };
  const literalEnvelope = { $ttscValue: "object", $ttscProperties: literalReference };
  const selfReference: { $ttscReference?: unknown } = {};
  selfReference.$ttscReference = selfReference;
  const literalSource = Object.assign(new Error("literal metadata", { cause: literalReference }), {
    envelope: literalEnvelope, again: literalReference, selfReference,
  });
  const literalResult = restoreCompilerError(serializeCompilerError(literalSource)) as Error & Record<string, unknown>;
  assert.equal(literalResult.message, "literal metadata");
  assert.deepEqual(literalResult.cause, { $ttscReference: "" });
  assert.equal(literalResult.cause instanceof Error, false);
  assert.equal(literalResult.again, literalResult.cause);
  const restoredEnvelope = literalResult.envelope as typeof literalEnvelope;
  assert.equal(restoredEnvelope.$ttscValue, "object");
  assert.equal(restoredEnvelope.$ttscProperties, literalResult.cause);
  const restoredSelf = literalResult.selfReference as typeof selfReference;
  assert.equal(restoredSelf.$ttscReference, restoredSelf);
  const escapedChild = { value: "escaped child" };
  const escapedSource = Object.assign(new Error("escaped path"), {
    first: { $ttscReference: escapedChild }, again: escapedChild,
  });
  const escapedResult = restoreCompilerError(serializeCompilerError(escapedSource)) as Error & { first: { $ttscReference: object }; again: object };
  assert.deepEqual(escapedResult.again, { value: "escaped child" });
  assert.equal(escapedResult.first.$ttscReference, escapedResult.again);
  const nestedShared = { value: "body target" };
  const nestedLiteral = { $ttscReference: { first: nestedShared, again: nestedShared } };
  const nestedResult = restoreCompilerError(serializeCompilerError(new Error("body paths", { cause: nestedLiteral })));
  const nestedBody = nestedResult.cause as typeof nestedLiteral;
  assert.deepEqual(nestedBody.$ttscReference.first, { value: "body target" });
  assert.equal(nestedBody.$ttscReference.first, nestedBody.$ttscReference.again);
  const commonMembers: AggregateError[] = [];
  for (let index = 0; index < 40; index++) {
    const member = new AggregateError([], `shared-${index}`);
    member.errors = commonMembers;
    commonMembers.push(member);
  }
  const commonResult = restoreCompilerError(serializeCompilerError(commonMembers[0])) as AggregateError;
  assert.equal(commonResult.errors.length, 40);
  for (let index = 0; index < 40; index++) {
    assert.ok(commonResult.errors[index] instanceof AggregateError);
    assert.equal(commonResult.errors[index].message, `shared-${index}`);
    assert.equal(commonResult.errors[index].errors, commonResult.errors);
  }
}
