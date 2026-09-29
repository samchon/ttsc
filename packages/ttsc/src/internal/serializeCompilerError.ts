/**
 * Describe a thrown value without dropping Error causes or aggregate failures.
 *
 * Error name, message and stack are explicit because they are not enumerable.
 * Plain outcome objects and arrays retain enumerable string-keyed data.
 * Repeated objects use a JSON-pointer reference marker, making cycles finite
 * without duplicating shared outcome trees. Values JSON cannot express use a
 * tagged description. Accessor properties are not evaluated. Failed reflective
 * inspection, such as a revoked Proxy, is marked rather than replacing the
 * compiler's exception. Internal slots of foreign classes are not projected
 * into ordinary data.
 *
 * @evidence contracts/common.md#principled-implementation Explicit Error fields preserve exception meaning while recursively retaining cause, aggregate errors and ordinary outcome data; pointer markers distinguish repeated references and tagged values distinguish JSON-inexpressible primitives from lost fields.
 * @evidence contracts/common.md#clear-and-simple-design One traversal owns API and worker failure transport, with private property and scalar helpers; compiler status classification remains separate from serialization.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Real causal data is preserved rather than replaced with the outer message; traversal does not call foreign getters or patch Error serialization, and unsupported primitive forms are explicitly described.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the retained Error/outcome fields, finite reference representation, exceptional scalars and accessor policy with separate acknowledgments.
 * @evidence contracts/performance.md#efficient-algorithms An explicit stack visits V distinct objects and E owned fields once, with P prototype observations for inherited Error text and property/path spelling costs; O(V+E+P) structural work does not recursively expand shared subtrees or consume the JavaScript call stack.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each failure graph belongs to one outcome; sharing an earlier serialization would require immutable graph inputs that arbitrary thrown values do not guarantee.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Seen-object and work-stack state belongs to one traversal and scales with its graph; only the finite returned description escapes, and no global exception history is retained.
 */
export function serializeCompilerError(error: unknown): unknown {
  const seen = new WeakMap<object, string>();
  const pending: {
    input: object;
    output: Record<string, unknown> | unknown[];
    pointer: string;
  }[] = [];
  const describe = (value: unknown, pointer: string): unknown => {
    if (value === null || typeof value !== "object")
      return describeScalar(value);
    const previous = seen.get(value);
    if (previous !== undefined) return { $ttscReference: previous };
    seen.set(value, pointer);
    let output: Record<string, unknown> | unknown[];
    try {
      output = Array.isArray(value)
        ? new Array(Object.getOwnPropertyDescriptor(value, "length")!.value)
        : {};
    } catch {
      return { $ttscValue: "uninspectable-object" };
    }
    pending.push({ input: value, output, pointer });
    return output;
  };
  const result = describe(error, "");
  while (pending.length !== 0) {
    const { input, output, pointer } = pending.pop()!;
    let fields: Record<string, PropertyDescriptor>;
    let isError: boolean;
    try {
      fields = Object.getOwnPropertyDescriptors(input);
      isError = input instanceof Error;
      if (isError) {
        // Built-in names may be inherited; own Error data overrides them below.
        const stack = errorDataField(input as Error, "stack");
        Object.assign(output, {
          message: errorDataField(input as Error, "message") ?? "",
          name: errorDataField(input as Error, "name") ?? "Error",
          ...(stack === undefined ? {} : { stack }),
        });
      }
    } catch {
      Object.assign(output, { $ttscValue: "uninspectable-object" });
      continue;
    }
    for (const [key, descriptor] of Object.entries(fields)) {
      if (
        !descriptor.enumerable &&
        !(
          isError &&
          ["message", "name", "stack", "cause", "errors"].includes(key)
        )
      )
        continue;
      const value =
        "value" in descriptor
          ? describe(
              descriptor.value,
              `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
            )
          : { $ttscValue: "accessor" };
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    }
  }
  return result;
}

/** Read inherited Error data without evaluating a user-defined accessor. */
function errorDataField(error: Error, key: string): string | undefined {
  const visited = new WeakSet<object>();
  let current: object | null = error;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor !== undefined)
      return "value" in descriptor && typeof descriptor.value === "string"
        ? descriptor.value
        : undefined;
    current = Object.getPrototypeOf(current) as object | null;
  }
  return undefined;
}

/** Preserve JSON scalars and explicitly describe values outside that domain. */
function describeScalar(value: unknown): unknown {
  if (value === undefined) return { $ttscValue: "undefined" };
  if (typeof value === "bigint")
    return { $ttscValue: "bigint", value: String(value) };
  if (typeof value === "symbol")
    return { $ttscValue: "symbol", value: String(value) };
  if (typeof value === "function") return { $ttscValue: "function" };
  if (typeof value === "number" && !Number.isFinite(value))
    return { $ttscValue: "number", value: String(value) };
  return value;
}
