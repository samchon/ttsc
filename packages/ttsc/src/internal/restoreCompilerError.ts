/**
 * Restore compiler-error transport while retaining shared and circular data.
 *
 * The serializer supplies a finite data graph with JSON-pointer reference
 * markers. All nodes are allocated before their fields are connected, so
 * forward references and circular causes require no recursive restoration.
 * Literal-object envelopes distinguish source metadata from generated markers;
 * their bodies remain data even when they have a marker's exact field shape.
 * Tagged exceptional values and accessor descriptions remain descriptions;
 * this receiver does not execute accessors or manufacture their values.
 *
 * @evidence contracts/common.md#principled-implementation Allocating the serialized graph before linking its fields preserves shared causes and aggregate members instead of turning reference markers into unrelated errors. Exact marker shapes and identified literal bodies keep user metadata distinct from generated references. The root and Error-shaped causes or aggregate members acquire Error prototypes; ordinary outcome objects retain their data representation.
 * @evidence contracts/common.md#clear-and-simple-design One iterative discovery, allocation and linking sequence shares a source-node map and the serializer's pointer spellings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual reference targets supply error data; messages do not guess ownership or replace unresolved native outcomes. Exceptional-value and accessor tags remain explicit diagnostic data.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains finite serialized inputs, forward/circular references and preserved tagged descriptions.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Restoration handles structured data only and performs no native filesystem or process operation.
 * @evidence contracts/performance.md#efficient-algorithms Iterative discovery and field linking visit serialized nodes and fields once, with pointer text and property data contributing their actual bytes. The explicit worklist avoids call-stack growth on nested aggregates and cycles.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A source-node map preserves identities within this one received graph; it shares no failure or compiler result across requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Maps and worklists belong to this invocation; the caller owns the returned error graph and its shared or circular references. No global error history or native resource is retained.
 */
export function restoreCompilerError(value: unknown): Error {
  if (value === null || typeof value !== "object") return new Error(String(value));
  const paths = new Map<string, object>();
  const fields = new Map<object, Record<string, PropertyDescriptor>>();
  const literals = new Map<object, object>();
  const literalBodies = new Set<object>();
  const references = new Map<object, string>();
  const pending = [{ input: value, pointer: "" }];
  while (pending.length !== 0) {
    const { input, pointer } = pending.pop()!;
    paths.set(pointer, input);
    if (fields.has(input)) continue;
    const properties = Object.getOwnPropertyDescriptors(input);
    fields.set(input, properties);
    const body = properties.$ttscProperties?.value;
    const keys = Object.keys(properties);
    if (!literalBodies.has(input) && !Array.isArray(input) &&
        keys.length === 2 && properties.$ttscValue?.value === "object" &&
        body !== null && typeof body === "object" && !Array.isArray(body)) {
      literals.set(input, body);
      literalBodies.add(body);
    }
    if (!literalBodies.has(input) && !Array.isArray(input) && keys.length === 1 &&
        typeof properties.$ttscReference?.value === "string")
      references.set(input, properties.$ttscReference.value);
    for (const [name, property] of Object.entries(properties)) {
      if (!("value" in property) || property.value === null || typeof property.value !== "object") continue;
      pending.push({ input: property.value, pointer: `${pointer}/${name.replaceAll("~", "~0").replaceAll("/", "~1")}` });
    }
  }
  const target = (input: object): object => {
    const literal = literals.get(input);
    if (literal !== undefined) return literal;
    if (literalBodies.has(input) || Array.isArray(input)) return input;
    const reference = references.get(input);
    if (reference === undefined) return input;
    const referenced = paths.get(reference);
    return referenced === undefined ? input : literals.get(referenced) ?? referenced;
  };
  const errors = new Set<object>();
  const aggregateArrays = new Set<object>();
  const errorNodes = [target(value)];
  while (errorNodes.length !== 0) {
    const error = errorNodes.pop()!;
    if (errors.has(error)) continue;
    errors.add(error);
    const properties = fields.get(error)!;
    const aggregate = properties.errors?.value;
    const members = aggregate !== null && typeof aggregate === "object" ? target(aggregate) : aggregate;
    if (Array.isArray(members) && !aggregateArrays.has(members)) {
      aggregateArrays.add(members);
      for (const member of members) {
        if (member === null || typeof member !== "object") continue;
        const candidate = target(member);
        const candidateFields = fields.get(candidate);
        if (typeof candidateFields?.name?.value === "string" && typeof candidateFields?.message?.value === "string") errorNodes.push(candidate);
      }
    }
    const cause = properties.cause;
    if (cause && "value" in cause && cause.value !== null && typeof cause.value === "object") {
      const candidate = target(cause.value);
      const candidateFields = fields.get(candidate);
      if (typeof candidateFields?.name?.value === "string" && typeof candidateFields?.message?.value === "string") errorNodes.push(candidate);
    }
  }
  const restored = new Map<object, object>();
  for (const [input, properties] of fields) {
    if (target(input) !== input) continue;
    const aggregate = properties.errors?.value;
    const members = aggregate !== null && typeof aggregate === "object" ? target(aggregate) : aggregate;
    restored.set(input, errors.has(input)
      ? Array.isArray(members) ? new AggregateError([], properties.message?.value) : new Error(properties.message?.value ?? String(input))
      : Array.isArray(input) ? new Array(properties.length?.value) : {});
  }
  for (const [input, properties] of fields) {
    if (target(input) !== input) continue;
    const output = restored.get(input)!;
    for (const [name, property] of Object.entries(properties)) {
      if (Array.isArray(output) && name === "length") continue;
      const item = "value" in property ? property.value : undefined;
      Object.defineProperty(output, name, "value" in property
        ? { ...property, value: item !== null && typeof item === "object" ? restored.get(target(item)) : item }
        : property);
    }
  }
  return restored.get(target(value)) as Error;
}
