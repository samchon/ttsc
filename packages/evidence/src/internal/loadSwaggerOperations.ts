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
  const schemas: Record<string, unknown> = (document.components?.schemas ??
    {}) as Record<string, unknown>;
  for (const [operationPath, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const operation: OpenApi.IOperation | undefined = item[method];
      if (operation !== undefined)
        operations.push(operationOf(method, operationPath, operation, schemas));
    }
    for (const [method, operation] of Object.entries(
      item.additionalOperations ?? {},
    ))
      operations.push(operationOf(method, operationPath, operation, schemas));
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
  schemas: Record<string, unknown>,
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
    digest: canonicalDigest(withResolvedSchemas(operation, schemas)),
  };
};

/**
 * Replaces every `$ref` into `components.schemas` with the schema it names.
 *
 * The converter preserves references rather than inlining them, so an operation
 * is often no more than `{"$ref": "#/components/schemas/IMember"}` where its
 * request and response bodies should be. A digest over the operation as written
 * therefore covers the name of a contract and not the contract, and changing
 * every property of a DTO expires no review of the endpoint that carries it.
 * That is the failure this feature exists to remove, on the artifact kind whose
 * whole content lives behind a reference.
 *
 * A schema graph is routinely recursive, so a reference already open on the
 * path above is left as it was written. The result is finite, it still differs
 * whenever a reachable schema differs, and two operations reaching the same
 * cycle by different routes are told apart by the route.
 *
 * A reference this document does not declare is also left as written. It is a
 * broken document rather than a digest question, and inventing an empty schema
 * for it would make two different broken documents agree.
 */
const withResolvedSchemas = (
  value: unknown,
  schemas: Record<string, unknown>,
  open: Set<string> = new Set<string>(),
): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value))
    return value.map((element) => withResolvedSchemas(element, schemas, open));
  const entries = Object.entries(value as Record<string, unknown>);
  const reference: unknown = (value as Record<string, unknown>)["$ref"];
  if (entries.length === 1 && typeof reference === "string") {
    const name: string | undefined = schemaNameOf(reference);
    if (name === undefined || open.has(name) || !(name in schemas))
      return value;
    open.add(name);
    try {
      return withResolvedSchemas(schemas[name], schemas, open);
    } finally {
      open.delete(name);
    }
  }
  return Object.fromEntries(
    entries.map(([key, element]) => [
      key,
      withResolvedSchemas(element, schemas, open),
    ]),
  );
};

const SCHEMA_REFERENCE_PREFIX = "#/components/schemas/";

const schemaNameOf = (reference: string): string | undefined =>
  reference.startsWith(SCHEMA_REFERENCE_PREFIX)
    ? decodeURIComponent(
        reference.slice(SCHEMA_REFERENCE_PREFIX.length).replaceAll("~1", "/"),
      ).replaceAll("~0", "~")
    : undefined;

const isInventory = (
  value: ISwaggerDocumentInventory | ISwaggerDocumentProblem,
): value is ISwaggerDocumentInventory => "operations" in value;

const isProblem = (
  value: ISwaggerDocumentInventory | ISwaggerDocumentProblem,
): value is ISwaggerDocumentProblem => "message" in value;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
