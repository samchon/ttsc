import assert from "node:assert/strict";

import { serializeCompilerError } from "../../../../../packages/ttsc/src/internal/serializeCompilerError";

/**
 * Describes thrown graphs without evaluating accessor values or losing causes.
 *
 * Authored stacks avoid engine-specific stack text. Shared and cyclic objects
 * require explicit reference markers, while reflection failure is distinct from
 * an empty ordinary object. These observations do not bound arbitrary Proxy
 * traps or prove worker-channel delivery.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual serializer on an AggregateError with a nested cause, an aliased cyclic graph, accessor data, exceptional scalars and a revoked Proxy; compares returned descriptions and getter count.
 * @evidence contracts/testing.md#independent-expectations Expected Error text, nested causes, pointer /a~0~1 and root pointer are authored literals under the documented Error and JSON-pointer contracts. Scalar and inspection markers are literal protocol values, not serializer-generated snapshots.
 * @evidence contracts/testing.md#distinguishing-cases Nonenumerable Error cause/errors/text survive while ordinary nonenumerable data does not. Shared references and a root cycle contrast with distinct objects; getter count zero, finite/null scalars and empty-object controls distinguish marking from omission or fabricated data.
 * @evidence contracts/testing.md#execution-ownership This named API source unit invokes the export directly with in-memory Errors, descriptors and a locally revoked Proxy. It launches no child, builds no native artifact and does not exercise compiler or worker transport.
 */
export function test_serializecompilererror_preserves_causes_references_and_exceptional_values(): void {
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  check("nonenumerable Error and aggregate causes", () => {
    const cause = new Error("inner", { cause: "origin" });
    Object.defineProperty(cause, "stack", { value: "inner-stack" });
    const error = new AggregateError([cause, "second"], "outer", { cause: "outer-origin" });
    Object.defineProperty(error, "stack", { value: "outer-stack" });
    assert.deepEqual(serializeCompilerError(error), {
      message: "outer",
      name: "AggregateError",
      stack: "outer-stack",
      cause: "outer-origin",
      errors: [
        { message: "inner", name: "Error", stack: "inner-stack", cause: "origin" },
        "second",
      ],
    });
  });
  check("shared references and escaped pointer", () => {
    const shared: { value: number; self?: unknown } = { value: 3 };
    shared.self = shared;
    const root: Record<string, unknown> = { "a~/": shared, again: shared, distinct: { value: 3 } };
    root.self = root;
    assert.deepEqual(serializeCompilerError(root), {
      "a~/": { value: 3, self: { $ttscReference: "/a~0~1" } },
      again: { $ttscReference: "/a~0~1" },
      distinct: { value: 3 },
      self: { $ttscReference: "" },
    });
  });
  check("accessors are not evaluated", () => {
    let getterCalls = 0;
    const input = Object.defineProperties({ ordinary: 4 }, {
      getter: { enumerable: true, get: () => { ++getterCalls; return "forbidden"; } },
      hidden: { enumerable: false, value: "not-outcome-data" },
    });
    assert.deepEqual(serializeCompilerError(input), {
      ordinary: 4,
      getter: { $ttscValue: "accessor" },
    });
    assert.equal(getterCalls, 0);
  });
  check("exceptional and ordinary scalar descriptions", () => {
    assert.deepEqual(serializeCompilerError({
      absent: undefined,
      large: 12n,
      nan: NaN,
      positive: Infinity,
      negative: -Infinity,
      symbol: Symbol("token"),
      callable: () => undefined,
      finite: 2,
      nil: null,
      text: "retained",
      boolean: false,
    }), {
      absent: { $ttscValue: "undefined" },
      large: { $ttscValue: "bigint", value: "12" },
      nan: { $ttscValue: "number", value: "NaN" },
      positive: { $ttscValue: "number", value: "Infinity" },
      negative: { $ttscValue: "number", value: "-Infinity" },
      symbol: { $ttscValue: "symbol", value: "Symbol(token)" },
      callable: { $ttscValue: "function" },
      finite: 2,
      nil: null,
      text: "retained",
      boolean: false,
    });
  });
  check("reflection failure is explicit", () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    assert.deepEqual(serializeCompilerError(proxy), { $ttscValue: "uninspectable-object" });
    assert.deepEqual(serializeCompilerError({}), {});
  });
  assert.equal(failures.length, 0, failures.length
    ? new AggregateError(failures, "compiler error description assertions")
    : undefined);
}
