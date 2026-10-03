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
 * can hash without fetching it again, so it never participates in the local
 * content-addressed cache. The native host separately retains successful URL
 * results for its process lifetime; a new process fetches the URL again.
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
 * URL protocols are interpreted by the URL parser, preserving the configured
 * source spelling in every returned inventory or problem. Local paths resolve
 * against the supplied root and carry their raw-byte digest; remote sources
 * carry no content-cache digest and retain normal fetch and TLS failures.
 *
 * Native configuration owns locator validation. The URL parser canonicalizes
 * protocol case without changing document paths or replacing fetch and its TLS
 * validation. Local paths retain path.resolve and raw-byte SHA256 identity;
 * normalization and operation digests remain independent of source spelling.
 *
 * One source reader separates URL transport from local byte reading. The outer
 * per-source boundary preserves original identity and collects every read or
 * normalization problem. Remote content has no local cache digest. The matching
 * configuration guide states scheme case and unsupported file URLs.
 * Local reads use one handle, acquire at most 16MiB of input plus a sentinel
 * byte, and fill bounded chunks across short reads. Every acquired-handle path
 * awaits a close attempt. A rejected close becomes a source problem with no
 * read digest and may replace an earlier read error; it does not certify
 * successful resource release. UTF-8 decoding and parsing have their own costs;
 * this byte limit is not a total process-memory quota.
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
          const normalized = normalizeSwaggerDocument(input, componentAt);
          return {
            source,
            operations: operationsOf(normalized),
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
  if (source.includes("://")) {
    const location: URL = new URL(source);
    if (location.protocol !== "http:" && location.protocol !== "https:")
      throw new Error("only http: and https: URLs are supported");
    return { text: await readRemoteSource(source), digest: "" };
  }

  // A local document may sit anywhere on the filesystem, including above the
  // project or on an absolute path. The native decoder is what validates the
  // spelling; this side only has to resolve it the same way, which
  // `path.resolve` already does for both forms.
  const location: string = path.resolve(root, source);
  const handle = await fs.open(location, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("the local Swagger source is not a file");
    if (stat.size > MAX_DOCUMENT_BYTES) throw documentSizeError();
    // The file can grow after stat. Read at most the limit plus one sentinel
    // byte from this same handle, rather than allocating its new whole size.
    const chunks: Buffer[] = [];
    let length = 0;
    let chunk = Buffer.allocUnsafe(64 * 1024);
    let used = 0;
    while (true) {
      const { bytesRead } = await handle.read(
        chunk,
        used,
        Math.min(chunk.length - used, MAX_DOCUMENT_BYTES - length + 1),
        null,
      );
      if (bytesRead === 0) {
        if (used > 0) chunks.push(chunk.subarray(0, used));
        break;
      }
      length += bytesRead;
      if (length > MAX_DOCUMENT_BYTES) throw documentSizeError();
      used += bytesRead;
      // Short reads fill the same buffer. Retaining a new 64KiB backing
      // allocation for every one-byte read would defeat the memory bound.
      if (used === chunk.length) {
        chunks.push(chunk);
        chunk = Buffer.allocUnsafe(
          Math.min(64 * 1024, MAX_DOCUMENT_BYTES - length + 1),
        );
        used = 0;
      }
    }
    const content = Buffer.concat(chunks, length);
    // Cache identity hashes exactly the accepted raw bytes. Invalid UTF-8 is
    // an unreadable source and returns no read result or content-cache digest.
    return {
      text: decodeUtf8(content),
      digest: createHash("sha256").update(content).digest("hex"),
    };
  } finally {
    await handle.close();
  }
};

const documentSizeError = (): Error =>
  new Error(`the Swagger document exceeds the ${MAX_DOCUMENT_BYTES} byte limit`);

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

const operationsOf = (
  normalized: ReturnType<typeof normalizeSwaggerDocument>,
): ISwaggerOperation[] => {
  const document = normalized.document;
  const operations: ISwaggerOperation[] = [];
  for (const [operationPath, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const operation: OpenApi.IOperation | undefined = item[method];
      if (operation !== undefined)
        operations.push(
          operationOf(method, operationPath, operation, normalized),
        );
    }
    for (const [method, operation] of Object.entries(
      item.additionalOperations ?? {},
    ))
      operations.push(
        operationOf(method, operationPath, operation, normalized),
      );
  }
  operations.sort((left, right) => {
    const leftTarget: string = `${left.method}:${left.path}`;
    const rightTarget: string = `${right.method}:${right.path}`;
    // Code-unit order, never locale order: collation treats canonically
    // equivalent spellings as equal, which can leave two identical targets
    // apart and hide the duplicate the next loop looks for.
    return leftTarget < rightTarget ? -1 : leftTarget > rightTarget ? 1 : 0;
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
  normalized: Parameters<typeof operationsOf>[0],
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
    digest: canonicalDigest(withResolvedReferences(operation, normalized)),
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
 * as written. The guard uses the decoded pointer, so percent-encoded and plain
 * spellings of the same recursive component stop at the same boundary. Two
 * operations reaching one cycle by different routes can still differ.
 * An undeclared or malformed reference is left
 * as written too: a broken document is not a digest question, and inventing an
 * empty schema for it would make two different broken documents agree.
 * Normalization retains the original pointer identity behind private schema
 * aliases, so a version converter cannot change the recursion boundary or bind
 * an unresolved reference to an unrelated component. Literal example, default,
 * const, enum and extension values are hashed as data, not dereferenced.
 */
const withResolvedReferences = (
  value: unknown,
  normalized: Parameters<typeof operationsOf>[0],
  open: Set<string> = new Set<string>(),
): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value))
    return value.map((element) =>
      withResolvedReferences(element, normalized, open),
    );
  const entries: Array<[string, unknown]> = Object.entries(
    value as Record<string, unknown>,
  );
  const reference: unknown = (value as Record<string, unknown>)["$ref"];
  const preserved =
    typeof reference === "string"
      ? normalized.referenceAt(reference)
      : undefined;
  const target = preserved?.target;
  if (target === undefined || open.has(target.pointer))
    return Object.fromEntries(
      entries.map(([key, element]) => [
        key,
        key === "$ref" && preserved !== undefined
          ? preserved.reference
          : normalized.isLiteral(value, key)
            ? literalValue(element)
            : withResolvedReferences(element, normalized, open),
      ]),
    );
  open.add(target.pointer);
  try {
    const resolved: unknown = withResolvedReferences(
      target.value,
      normalized,
      open,
    );
    const siblings: Array<[string, unknown]> = entries
      .filter(([key]) => key !== "$ref")
      .map(([key, element]) => [
        key,
        normalized.isLiteral(value, key)
          ? literalValue(element)
          : withResolvedReferences(element, normalized, open),
      ]);
    if (siblings.length === 0) return resolved;
    if (resolved === null || typeof resolved !== "object")
      return Object.fromEntries(siblings);
    return {
      ...(resolved as Record<string, unknown>),
      ...Object.fromEntries(siblings),
    };
  } finally {
    open.delete(target.pointer);
  }
};

/**
 * Copies data without interpreting `$ref`, refusing non-JSON object cycles.
 *
 * Each occurrence contributes its JSON value, even when YAML anchors share an
 * acyclic child. The active path is released in finally; the allocated value
 * lasts through hashing. This is not a total memory or depth bound.
 */
const literalValue = (
  value: unknown,
  open: Set<object> = new Set<object>(),
): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (open.has(value))
    throw new Error("a Swagger literal value contains an object cycle");
  open.add(value);
  try {
    return Array.isArray(value)
      ? value.map((element) => literalValue(element, open))
      : Object.fromEntries(
          Object.entries(value).map(([key, element]) => [
            key,
            literalValue(element, open),
          ]),
        );
  } finally {
    open.delete(value);
  }
};

const COMPONENT_REFERENCE_PREFIX = "/components/";

/**
 * Reads one local component URI fragment, or nothing.
 *
 * RFC 6901 URI decoding precedes tokenization: %2F separates pointer tokens,
 * while ~1 names a slash inside one token. Malformed URI or tilde escapes name
 * nothing; the caller preserves their original reference rather than selecting
 * a literal property with invalid pointer syntax. Tokens are decoded once and
 * remain case-sensitive, without Unicode normalization.
 *
 * Own object members and canonical unsigned array indices can be selected.
 * Inherited properties, leading-zero indices, array append and absent elements
 * cannot. The decoded pointer also identifies the recursion guard independently
 * of percent-escape spelling. Walking costs the fragment length plus its token
 * count and retains only this lookup's tokens and result.
 */
const componentAt = (
  components: Record<string, unknown>,
  reference: string,
): { pointer: string; value: unknown } | undefined => {
  if (!reference.startsWith("#")) return undefined;
  let pointer: string;
  try {
    pointer = decodeURIComponent(reference.slice(1));
  } catch {
    return undefined;
  }
  if (!pointer.startsWith(COMPONENT_REFERENCE_PREFIX)) return undefined;
  const tokens: string[] = pointer
    .slice(COMPONENT_REFERENCE_PREFIX.length)
    .split("/");
  let current: unknown = components;
  for (const token of tokens) {
    if (/~(?:[^01]|$)/u.test(token)) return undefined;
    const segment: string = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (current === null || typeof current !== "object") return undefined;
    if (Array.isArray(current) && /^(?:0|[1-9][0-9]*)$/u.test(segment) === false)
      return undefined;
    if (!Object.hasOwn(current as Record<string, unknown>, segment))
      return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current === undefined ? undefined : { pointer, value: current };
};

const isInventory = (
  value: ISwaggerDocumentInventory | ISwaggerDocumentProblem,
): value is ISwaggerDocumentInventory => "operations" in value;

const isProblem = (
  value: ISwaggerDocumentInventory | ISwaggerDocumentProblem,
): value is ISwaggerDocumentProblem => "message" in value;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
