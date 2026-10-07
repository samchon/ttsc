import type { OpenApi } from "@typia/interface";
import { OpenApiConverter } from "@typia/utils";

/**
 * Normalizes schema targets without letting a version converter rebase their
 * references to an unrelated component with the same final token.
 *
 * Raw 3.1 and 3.2 schema references are lowered to private component names
 * before conversion. Each selected raw target is converted as a schema in its
 * own right, so a pointer into a tuple still selects that schema when the
 * converter changes `items` to `prefixItems`. The names stay inside this call;
 * the digest reader receives the original reference and pointer identity.
 * Missing and foreign references have no private target and cannot accidentally
 * bind to a local component. This does not fetch referenced documents.
 *
 * Only schema positions are rewritten. Example, default, const, enum and
 * extension payloads are copied without interpreting their data as schemas.
 * Existing emended documents and other versions keep the ordinary conversion
 * path. The supplied reader is the bridge's own strict component URI reader,
 * shared with its post-conversion digest resolution.
 *
 * Copies, alias targets and provenance are retained for one source conversion
 * and its operation digests, not in a process-wide cache. Reference proxies
 * share targets by decoded pointer. Nested targets are copied and converted
 * separately from the containing schema because their normalized locations can
 * differ; literal copies preserve each data occurrence. These costs, and
 * recursion depth, are not bounded by the reader's raw-byte limit. Weak
 * identity maps terminate copy/visitor cycles; they do not impose a total
 * memory quota or change the converter's own treatment of cyclic schemas.
 *
 * @internal
 */
export const normalizeSwaggerDocument = (
  input: any,
  componentAt: (
    components: Record<string, unknown>,
    reference: string,
  ) => { pointer: string; value: unknown } | undefined,
) => {
  const references = new Map<
    string,
    { reference: string; pointer?: string; key: string }
  >();
  let prepared: any = input;
  if (
    input !== null &&
    typeof input === "object" &&
    typeof input.openapi === "string" &&
    (input.openapi.startsWith("3.1") || input.openapi.startsWith("3.2")) &&
    !(input.openapi.startsWith("3.2") && input["x-typia-emended-v12"] === true)
  ) {
    const writtenPointers = new Set<string>();
    const copy = (value: any, copies = new WeakMap<object, any>()): any => {
      if (value === null || typeof value !== "object") {
        if (typeof value === "string" && value.startsWith("#"))
          try {
            writtenPointers.add(decodeURIComponent(value.slice(1)));
          } catch {
            // A malformed spelling cannot name a generated alias.
          }
        return value;
      }
      const previous = copies.get(value);
      if (previous !== undefined) return previous;
      const result: any = Array.isArray(value) ? [] : {};
      copies.set(value, result);
      for (const [key, child] of Object.entries(value))
        Object.defineProperty(result, key, {
          value: copy(child, copies),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      return result;
    };
    prepared = copy(input);
    // YAML anchors can share one object between a schema and literal data.
    // Detach every data holder before any reference is rewritten.
    const detachLiterals = swaggerSchemaVisitor(
      () => {},
      (value, holder, key) => {
        if (Object.hasOwn(holder, key)) holder[key] = copy(value);
      },
    );
    detachLiterals.document(prepared);
    const components = (prepared.components ??= {});
    const schemas = (components.schemas ??= {});
    const targets = new Map<string, string>();
    const convertedTargets = new Map<string, string>();
    let sequence = 0;
    const reference = (spelling: string): string => {
      // Keep each spelling for the literal left at a recursive boundary. Its
      // decoded pointer, rather than this private name, identifies the guard.
      const known = targets.get(spelling);
      if (known !== undefined) return known;
      const target = componentAt(input.components ?? {}, spelling);
      let key: string;
      do key = `_ttsc_schema_reference_${sequence++}`;
      while (
        Object.hasOwn(schemas, key) ||
        writtenPointers.has(`/components/schemas/${key}`)
      );
      const alias = `#/components/schemas/${key}`;
      targets.set(spelling, alias);
      const preserved = { reference: spelling, pointer: target?.pointer, key };
      references.set(alias, preserved);
      // Reserve the alias before walking its target: mutual and self references
      // become finite edges, rather than recursively expanded object copies.
      if (target !== undefined) {
        let targetKey = convertedTargets.get(target.pointer);
        if (targetKey === undefined) {
          const prefix = "/components/schemas/";
          const token = target.pointer.startsWith(prefix)
            ? target.pointer.slice(prefix.length)
            : undefined;
          const originalKey =
            token !== undefined && !token.includes("/")
              ? token.replaceAll("~1", "/").replaceAll("~0", "~")
              : undefined;
          targetKey =
            originalKey !== undefined && Object.hasOwn(schemas, originalKey)
              ? originalKey
              : key;
          convertedTargets.set(target.pointer, targetKey);
          if (targetKey === key) {
            Object.defineProperty(schemas, key, {
              value: copy(target.value),
              writable: true,
              enumerable: true,
              configurable: true,
            });
            detachLiterals.schema(schemas[key]);
          }
        }
        preserved.key = targetKey;
        if (targetKey !== key)
          Object.defineProperty(schemas, key, {
            value: {
              $ref: `#/components/schemas/${encodeURIComponent(
                targetKey.replaceAll("~", "~0").replaceAll("/", "~1"),
              )}`,
            },
            writable: true,
            enumerable: true,
            configurable: true,
          });
        // Different spellings use small reference proxies. Their equivalent
        // target is copied and normalized once under this pointer identity.
        walk.schema(schemas[targetKey]);
      }
      return alias;
    };
    const walk = swaggerSchemaVisitor(
      (value) => {
        for (const key of ["$ref", "$recursiveRef"])
          if (typeof value[key] === "string")
            value[key] = reference(value[key]);
      },
      () => {},
    );
    // Snapshot the author-written schemas. The reference walker visits each
    // newly added alias itself, so additions never invalidate this iteration.
    walk.document(prepared);
  }
  const document: OpenApi.IDocument =
    OpenApiConverter.upgradeDocument(prepared);
  const literals = new WeakMap<object, Set<string>>();
  swaggerSchemaVisitor(
    () => {},
    (_value, holder, key) => {
      if (!Object.hasOwn(holder, key)) return;
      let keys = literals.get(holder);
      if (keys === undefined) {
        keys = new Set<string>();
        literals.set(holder, keys);
      }
      keys.add(key);
    },
  ).document(document);
  return {
    document,
    isLiteral: (holder: object, key: string): boolean =>
      literals.get(holder)?.has(key) === true,
    referenceAt: (reference: string) => {
      const preserved = references.get(reference);
      if (preserved === undefined)
        return {
          reference,
          target: componentAt(
            (document.components ?? {}) as Record<string, unknown>,
            reference,
          ),
        };
      const schemas = document.components?.schemas;
      return {
        reference: preserved.reference,
        target:
          preserved.pointer !== undefined &&
          schemas !== undefined &&
          Object.hasOwn(schemas, preserved.key) &&
          schemas[preserved.key] !== undefined
            ? { pointer: preserved.pointer, value: schemas[preserved.key] }
            : undefined,
      };
    },
  };
};

/**
 * Visits schema holders once per object and reports literal holder slots.
 *
 * Literalness belongs to a position: one YAML object can also be a schema at
 * another position. Retaining holder/key pairs preserves that distinction. This
 * visitor does not rewrite data, expand references or load documents; its
 * callbacks own those operations and each walk owns its identity sets.
 */
const swaggerSchemaVisitor = (
  visitSchema: (value: any) => void,
  visitLiteral: (value: unknown, holder: any, key: string) => void,
) => {
  const visited = new WeakSet<object>();
  const extensions = (value: any, hasAdditionalOperations = false): void => {
    for (const [key, child] of Object.entries(value))
      if (
        key.startsWith("x-") &&
        !(hasAdditionalOperations && key === "x-additionalOperations")
      )
        visitLiteral(child, value, key);
  };
  const schema = (value: any): void => {
    if (value === null || typeof value !== "object" || visited.has(value))
      return;
    visited.add(value);
    visitSchema(value);
    for (const key of ["example", "examples", "default", "const", "enum"])
      visitLiteral(value[key], value, key);
    extensions(value);
    for (const key of [
      "properties",
      "patternProperties",
      "$defs",
      "definitions",
    ])
      for (const child of Object.values(value[key] ?? {})) schema(child);
    for (const key of ["oneOf", "anyOf", "allOf", "prefixItems"])
      if (Array.isArray(value[key])) value[key].forEach(schema);
    for (const key of [
      "items",
      "additionalItems",
      "additionalProperties",
      "not",
      "contains",
      "if",
      "then",
      "else",
      "propertyNames",
    ])
      if (Array.isArray(value[key])) value[key].forEach(schema);
      else schema(value[key]);
    for (const child of Object.values(value.dependentSchemas ?? {}))
      schema(child);
  };
  const examples = (value: any): void => {
    for (const example of Object.values(value ?? {}) as any[]) {
      if (example === null || typeof example !== "object") continue;
      visitLiteral(example.value, example, "value");
      extensions(example);
    }
  };
  const parameter = (value: any): void => {
    if (value === null || typeof value !== "object") return;
    schema(value.schema);
    content(value.content);
    visitLiteral(value.example, value, "example");
    examples(value.examples);
    extensions(value);
  };
  const content = (value: any): void => {
    for (const media of Object.values(value ?? {}) as any[]) {
      if (media === null || typeof media !== "object") continue;
      schema(media.schema);
      schema(media.itemSchema);
      visitLiteral(media.example, media, "example");
      examples(media.examples);
      extensions(media);
    }
  };
  const body = (value: any): void => {
    if (value === null || typeof value !== "object") return;
    content(value.content);
    for (const header of Object.values(value.headers ?? {})) parameter(header);
    extensions(value);
  };
  const paths = new WeakSet<object>();
  const pathItem = (value: any): void => {
    if (value === null || typeof value !== "object" || paths.has(value)) return;
    paths.add(value);
    extensions(value, true);
    if (Array.isArray(value.parameters)) value.parameters.forEach(parameter);
    const operations = [
      ...[
        "get",
        "put",
        "post",
        "delete",
        "options",
        "head",
        "patch",
        "trace",
        "query",
      ].map((key) => value[key]),
      ...Object.values(value.additionalOperations ?? {}),
      ...Object.values(value["x-additionalOperations"] ?? {}),
    ];
    for (const operation of operations) {
      if (operation === null || typeof operation !== "object") continue;
      if (Array.isArray(operation.parameters))
        operation.parameters.forEach(parameter);
      body(operation.requestBody);
      for (const response of Object.values(operation.responses ?? {}))
        body(response);
      for (const callback of Object.values(operation.callbacks ?? {}) as any[])
        for (const child of Object.values(callback ?? {})) pathItem(child);
      extensions(operation);
    }
  };
  return {
    schema,
    document: (value: any): void => {
      const components = value.components ?? {};
      Object.values(components.schemas ?? {}).forEach(schema);
      for (const key of ["parameters", "headers"])
        Object.values(components[key] ?? {}).forEach(parameter);
      for (const key of ["requestBodies", "responses"])
        Object.values(components[key] ?? {}).forEach(body);
      examples(components.examples);
      for (const group of [value.paths, value.webhooks, components.pathItems])
        Object.values(group ?? {}).forEach(pathItem);
    },
  };
};
