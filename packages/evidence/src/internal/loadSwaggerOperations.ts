import type { OpenApi } from "@typia/interface";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

import { canonicalDigest } from "./canonicalDigest";
import { normalizeSwaggerDocument } from "./normalizeSwaggerDocument";

const MAX_DOCUMENT_BYTES: number = 16 * 1024 * 1024;
const REMOTE_TIMEOUT_MILLISECONDS: number = 30_000;
const METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
  "query",
] as const satisfies readonly OpenApi.Method[];

interface ISwaggerDocumentInventory {
  source: string;
  operations: ISwaggerOperation[];
  digest: string;
}

interface ISwaggerDocumentProblem {
  source: string;
  message: string;
  digest: string;
}

interface ISwaggerOperation {
  method: string;
  path: string;
  /**
   * The operation's own content, digested where it is understood.
   *
   * The native side receives identities and cannot recompute this: it never
   * sees the normalized document. Nothing inside an OpenAPI operation hosts an
   * evidence tag, so nothing is excluded, and the operation is the unit, so
   * there is no subtree to compose.
   */
  digest: string;
}

/**
 * One source read, with the identity of the bytes it came from.
 *
 * The digest is empty for a remote source. A URL has nothing the native side
 * can hash without fetching it again, so it never participates in reuse, and
 * reporting a digest for one would let it into a cache that cannot revalidate
 * it.
 */
interface IReadSource {
  text: string;
  digest: string;
}

/**
 * Loads and normalizes every configured Swagger source for the native rule.
 *
 * The native contributor is Go, while the version converter is JavaScript. This
 * function is the narrow process boundary between them: it accepts only source
 * locations and returns operation identities, each carrying a digest of the
 * operation's content taken here because this is the only side that sees the
 * document.
 *
 * @internal
 */
export const loadSwaggerOperations = async (request: {
  root: string;
  sources: string[];
}) => {
  const loaded: Array<ISwaggerDocumentInventory | ISwaggerDocumentProblem> =
    await Promise.all(
      request.sources.map(async (source) => {
        let digest: string = "";
        try {
          const read: IReadSource = await readSource(request.root, source);
          digest = read.digest;
          const input: unknown = parse(read.text);
          const document: OpenApi.IDocument = normalizeSwaggerDocument(input);
          return {
            source,
            operations: operationsOf(document),
            digest,
          } satisfies ISwaggerDocumentInventory;
        } catch (error) {
          return {
            source,
            message: errorMessage(error),
            digest,
          } satisfies ISwaggerDocumentProblem;
        }
      }),
    );
  return {
    documents: loaded.filter(isInventory),
    problems: loaded.filter(isProblem),
  };
};

const readSource = async (
  root: string,
  source: string,
): Promise<IReadSource> => {
  if (source.startsWith("http://") || source.startsWith("https://"))
    return { text: await readRemoteSource(source), digest: "" };
  if (source.includes("://"))
    throw new Error("only http: and https: URLs are supported");

  // A local document may sit anywhere on the filesystem, including above the
  // project or on an absolute path. The native decoder is what validates the
  // spelling; this side only has to resolve it the same way, which
  // `path.resolve` already does for both forms.
  const location: string = path.resolve(root, source);
  const stat: Awaited<ReturnType<typeof fs.stat>> = await fs.stat(location);
  if (!stat.isFile()) throw new Error("the local Swagger source is not a file");
  if (stat.size > MAX_DOCUMENT_BYTES)
    throw new Error(
      `the Swagger document exceeds the ${MAX_DOCUMENT_BYTES} byte limit`,
    );

  // Hashed before decoding, over the bytes as they were read. The native side
  // hashes the file's bytes too, so the two agree by construction; hashing the
  // decoded string instead would agree only for inputs where the round trip
  // happens to be exact.
  const content: Buffer = await fs.readFile(location);
  return {
    text: decodeUtf8(content),
    digest: createHash("sha256").update(content).digest("hex"),
  };
};

const readRemoteSource = async (source: string): Promise<string> => {
  const response: Response = await fetch(source, {
    signal: AbortSignal.timeout(REMOTE_TIMEOUT_MILLISECONDS),
  });
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status} ${response.statusText || "response"}`,
    );
  if (response.body === null) return "";

  const reader: ReadableStreamDefaultReader<Uint8Array> =
    response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length: number = 0;
  while (true) {
    const next: ReadableStreamReadResult<Uint8Array> = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      throw new Error(
        `the Swagger document exceeds the ${MAX_DOCUMENT_BYTES} byte limit`,
      );
    }
    chunks.push(next.value);
  }
  const content: Uint8Array = new Uint8Array(length);
  let offset: number = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decodeUtf8(content);
};

const decodeUtf8 = (content: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(content);

const operationsOf = (document: OpenApi.IDocument): ISwaggerOperation[] => {
  const operations: ISwaggerOperation[] = [];
  const components: Record<string, unknown> = (document.components ??
    {}) as Record<string, unknown>;
  for (const [operationPath, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const operation: OpenApi.IOperation | undefined = item[method];
      if (operation !== undefined)
        operations.push(
          operationOf(method, operationPath, operation, components),
        );
    }
    for (const [method, operation] of Object.entries(
      item.additionalOperations ?? {},
    ))
      operations.push(
        operationOf(method, operationPath, operation, components),
      );
  }
  operations.sort((left, right) => {
    const leftTarget: string = `${left.method}:${left.path}`;
    const rightTarget: string = `${right.method}:${right.path}`;
    return leftTarget.localeCompare(rightTarget);
  });
  for (let index: number = 1; index < operations.length; index++) {
    const previous: ISwaggerOperation = operations[index - 1]!;
    const current: ISwaggerOperation = operations[index]!;
    if (
      `${previous.method}:${previous.path}` ===
      `${current.method}:${current.path}`
    )
      throw new Error(
        `OpenAPI operation '${current.method} ${current.path}' is declared more than once`,
      );
  }
  return operations;
};

const operationOf = (
  method: string,
  operationPath: string,
  operation: OpenApi.IOperation,
  components: Record<string, unknown>,
): ISwaggerOperation => {
  if (!operationPath.startsWith("/"))
    throw new Error(
      `OpenAPI path '${operationPath}' must start with '/' to form an operation target`,
    );
  if (
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(method) === false ||
    method.includes(":")
  )
    throw new Error(
      `OpenAPI method '${method}' cannot form a '<METHOD>:<path>' target`,
    );
  return {
    method: method.toUpperCase(),
    path: operationPath,
    digest: canonicalDigest(withResolvedReferences(operation, components)),
  };
};

/**
 * Replaces every local `$ref` into `components` with what it names.
 *
 * The converter preserves references rather than inlining them, so an operation
 * is often no more than `{"$ref": "#/components/schemas/IMember"}` where its
 * request and response bodies should be. A digest over the operation as written
 * therefore covers the name of a contract and not the contract, and changing
 * every property of a DTO expires no review of the endpoint that carries it.
 * That is the failure this feature exists to remove, on the artifact kind whose
 * whole content lives behind a reference.
 *
 * Any pointer under `#/components/` is followed, not only one into `schemas`,
 * because a request body, a response, a parameter, and a header are all
 * declarable there and each is part of the operation a reviewer read. A pointer
 * anywhere else is left as written: `#/paths/...` would fold one operation's
 * content into another's and reintroduce the cross-expiry this replaces.
 *
 * Siblings of a `$ref` are kept and override what it resolves to, which is what
 * OpenAPI 3.1 says they do. A reference already open on the path above is left
 * as written, so a recursive schema terminates while two operations reaching
 * one cycle by different routes still differ. An undeclared reference is left
 * as written too: a broken document is not a digest question, and inventing an
 * empty schema for it would make two different broken documents agree.
 */
const withResolvedReferences = (
  value: unknown,
  components: Record<string, unknown>,
  open: Set<string> = new Set<string>(),
): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value))
    return value.map((element) =>
      withResolvedReferences(element, components, open),
    );
  const entries: Array<[string, unknown]> = Object.entries(
    value as Record<string, unknown>,
  );
  const reference: unknown = (value as Record<string, unknown>)["$ref"];
  if (typeof reference !== "string" || open.has(reference))
    return Object.fromEntries(
      entries.map(([key, element]) => [
        key,
        withResolvedReferences(element, components, open),
      ]),
    );
  const target: unknown = componentAt(components, reference);
  if (target === undefined)
    return Object.fromEntries(
      entries.map(([key, element]) => [
        key,
        withResolvedReferences(element, components, open),
      ]),
    );
  open.add(reference);
  try {
    const resolved: unknown = withResolvedReferences(target, components, open);
    const siblings: Array<[string, unknown]> = entries
      .filter(([key]) => key !== "$ref")
      .map(([key, element]) => [
        key,
        withResolvedReferences(element, components, open),
      ]);
    if (siblings.length === 0) return resolved;
    if (resolved === null || typeof resolved !== "object")
      return Object.fromEntries(siblings);
    return {
      ...(resolved as Record<string, unknown>),
      ...Object.fromEntries(siblings),
    };
  } finally {
    open.delete(reference);
  }
};

const COMPONENT_REFERENCE_PREFIX = "#/components/";

/** Reads one `#/components/<section>/<name>` pointer, or nothing. */
const componentAt = (
  components: Record<string, unknown>,
  reference: string,
): unknown => {
  if (!reference.startsWith(COMPONENT_REFERENCE_PREFIX)) return undefined;
  const segments: string[] = reference
    .slice(COMPONENT_REFERENCE_PREFIX.length)
    .split("/")
    .map((segment) =>
      decodeURIComponent(segment).replaceAll("~1", "/").replaceAll("~0", "~"),
    );
  let current: unknown = components;
  for (const segment of segments) {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    )
      return undefined;
    if (!(segment in (current as Record<string, unknown>))) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const isInventory = (
  value: ISwaggerDocumentInventory | ISwaggerDocumentProblem,
): value is ISwaggerDocumentInventory => "operations" in value;

const isProblem = (
  value: ISwaggerDocumentInventory | ISwaggerDocumentProblem,
): value is ISwaggerDocumentProblem => "message" in value;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
