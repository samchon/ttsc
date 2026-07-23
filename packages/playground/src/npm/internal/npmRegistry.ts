import { maxSatisfying, satisfies, valid, validRange } from "semver";

// Internal npm-registry helpers used by `installPlaygroundDependencies`.
// Grouped in one file because every helper is privately coupled to the tar
// + version-resolve + tarball-extract flow; splitting them per the public
// "one symbol per file" rule would make the install path harder to follow.

interface IPackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

export interface INpmVersionMetadata {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  dist?: {
    integrity?: string;
    shasum?: string;
    tarball?: string;
  };
}

export interface INpmMetadata {
  name: string;
  "dist-tags"?: Record<string, string>;
  versions: Record<string, INpmVersionMetadata | undefined>;
}

export interface IUnpackedPackage {
  files: Record<string, string>;
  packageJson: IPackageJson;
}

export interface IQueueItem {
  name: string;
  range: string;
  optional: boolean;
  requester: string;
  registryName?: string;
  requests?: IVersionRequest[];
}

export interface IVersionRequest {
  optional: boolean;
  range: string;
  requester: string;
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

declare const VALIDATED_NPM_BYTE_LIMIT: unique symbol;
type ValidatedNpmByteLimit = number & {
  readonly [VALIDATED_NPM_BYTE_LIMIT]: true;
};

const TEXT_FILE_REGEXP =
  /(^package\.json$|\.([cm]?js|jsx|[cm]?ts|tsx|json)$|\.d\.[cm]?ts$)/i;
export const DECLARATION_FILE_REGEXP = /\.d\.[cm]?ts$/i;
const RUNTIME_FILE_REGEXP = /(^package\.json$|\.([cm]?js|json)$)/i;

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  if (signal.reason !== undefined) throw signal.reason;
  throw new DOMException("The operation was aborted.", "AbortError");
}

export async function fetchNpmMetadata(
  fetchImpl: FetchLike,
  packageName: string,
  optional: boolean,
  signal: AbortSignal | undefined,
): Promise<INpmMetadata | null> {
  throwIfAborted(signal);
  const response = await fetchWithAbort(
    () =>
      fetchImpl(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
        {
          headers: {
            Accept: "application/vnd.npm.install-v1+json, application/json",
          },
          signal,
        },
      ),
    signal,
  );
  if (response.status === 404 && optional) {
    void response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error(
      `npm registry returned ${response.status} while resolving ${packageName}.`,
    );
  }
  throwIfAborted(signal);
  const metadata = (await abortable(
    () => response.json() as Promise<INpmMetadata>,
    signal,
  )) as INpmMetadata;
  throwIfAborted(signal);
  return metadata;
}

export function selectVersion(
  metadata: INpmMetadata,
  ranges: readonly string[] | string,
): string {
  const versions = metadata.versions;
  const requested = Array.isArray(ranges) ? ranges : [ranges];
  const semverRanges = requested.filter((range) => validRange(range) !== null);
  const tags = requested.filter((range) => validRange(range) === null);
  const taggedVersions = new Set<string>();
  for (const tag of tags) {
    const version = metadata["dist-tags"]?.[tag];
    if (!version || !versions[version]) {
      throw new Error(
        `No npm dist-tag ${JSON.stringify(tag)} exists for ${metadata.name}.`,
      );
    }
    taggedVersions.add(version);
  }
  if (taggedVersions.size > 1) {
    throw new Error(
      `Conflicting npm tags for ${metadata.name}: ${requested.join(", ")}.`,
    );
  }

  const candidates = Object.keys(versions).filter(
    (version) =>
      valid(version) !== null &&
      semverRanges.every((range) => satisfies(version, range)) &&
      (taggedVersions.size === 0 || taggedVersions.has(version)),
  );
  const selected = maxSatisfying(candidates, "*");
  if (selected) return selected;
  throw new Error(
    `No version of ${metadata.name} satisfies ${requested
      .map((range) => JSON.stringify(range))
      .join(", ")}.`,
  );
}

export async function downloadTarball(
  fetchImpl: FetchLike,
  tarball: string,
  signal: AbortSignal | undefined,
  maxBytes = 16 * 1024 * 1024,
): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  const byteLimit = validateNpmByteLimit(maxBytes, "compressed");
  const response = await fetchWithAbort(
    () => fetchImpl(tarball, { signal }),
    signal,
  );
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error(`tarball download failed with HTTP ${response.status}.`);
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsed = Number(declaredLength);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed > byteLimit) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error(
        `tarball exceeds the ${formatByteLimit(byteLimit)} compressed byte limit.`,
      );
    }
  }
  return collectBoundedStream(
    response.body,
    byteLimit,
    "compressed",
    signal,
    () => response.arrayBuffer(),
  );
}

/** Verify registry authentication metadata against the compressed bytes. */
export async function verifyTarball(
  tgz: ArrayBuffer,
  dist: { integrity?: string; shasum?: string },
  signal: AbortSignal | undefined,
): Promise<void> {
  throwIfAborted(signal);
  if (dist.integrity !== undefined) {
    const candidates = parseIntegrity(dist.integrity);
    const strength = Math.max(...candidates.map(({ rank }) => rank));
    const strongest = candidates.filter(
      (candidate) => candidate.rank === strength,
    );
    const actual = new Uint8Array(
      await abortable(
        () => crypto.subtle.digest(strongest[0]!.webAlgorithm, tgz),
        signal,
      ),
    );
    throwIfAborted(signal);
    if (!strongest.some(({ digest }) => equalBytes(actual, digest))) {
      throw new Error(
        `tarball integrity mismatch (${strongest[0]!.algorithm}).`,
      );
    }
    return;
  }
  if (dist.shasum !== undefined) {
    if (!/^[a-fA-F0-9]{40}$/.test(dist.shasum)) {
      throw new Error("tarball shasum is not a valid SHA-1 digest.");
    }
    const actual = new Uint8Array(
      await abortable(() => crypto.subtle.digest("SHA-1", tgz), signal),
    );
    throwIfAborted(signal);
    if (!equalBytes(actual, decodeHex(dist.shasum))) {
      throw new Error("tarball shasum mismatch (sha1).");
    }
  }
}

export async function unpackNpmTarball(
  tgz: ArrayBuffer,
  signal: AbortSignal | undefined,
  maxBytes = 64 * 1024 * 1024,
): Promise<IUnpackedPackage> {
  throwIfAborted(signal);
  const byteLimit = validateNpmByteLimit(maxBytes, "expanded");
  const tar = await gunzip(tgz, byteLimit, signal);
  throwIfAborted(signal);
  const decoder = new TextDecoder();
  const files: Record<string, string> = {};
  let packageJson: IPackageJson = {};
  let offset = 0;
  let longPath: string | null = null;
  let paxPath: string | null = null;
  let terminated = false;
  let archiveRoot: string | null = null;

  const confine = (rawPath: string): string => {
    const confined = confineTarPath(rawPath, archiveRoot);
    archiveRoot = confined.root;
    return confined.relative;
  };

  while (offset < tar.length) {
    throwIfAborted(signal);
    if (offset + 512 > tar.length) {
      throw new Error("Truncated tar header.");
    }
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((value) => value === 0)) {
      terminated = true;
      break;
    }

    const type = String.fromCharCode(header[156] ?? 0);
    const size = parseOctal(header.subarray(124, 136));
    if (size > tar.length - offset) {
      throw new Error("Tar entry body extends beyond the archive.");
    }
    const body = tar.subarray(offset, offset + size);
    const paddedSize = Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(paddedSize) || paddedSize > tar.length - offset) {
      throw new Error("Tar entry padding extends beyond the archive.");
    }
    offset += paddedSize;

    if (type === "L") {
      longPath = trimNull(decoder.decode(body));
      confine(longPath);
      continue;
    }
    if (type === "x") {
      paxPath = parsePaxPath(body);
      if (paxPath !== null) confine(paxPath);
      continue;
    }
    if (type !== "0" && type !== "\0") {
      longPath = null;
      paxPath = null;
      continue;
    }

    const rawPath = paxPath ?? longPath ?? readTarHeaderPath(header, decoder);
    longPath = null;
    paxPath = null;
    const rel = confine(rawPath);
    if (!TEXT_FILE_REGEXP.test(rel)) continue;

    const text = decoder.decode(body);
    files[rel] = text;
    if (rel === "package.json") {
      try {
        packageJson = JSON.parse(text) as IPackageJson;
      } catch {
        packageJson = {};
      }
    }
  }
  if (!terminated) throw new Error("Tar archive has no end marker.");

  return { files, packageJson };
}

async function gunzip(
  input: ArrayBuffer,
  maxBytes: ValidatedNpmByteLimit,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error(
      "This browser cannot unpack npm tgz files because DecompressionStream is unavailable.",
    );
  }
  const stream = new Blob([input])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(
    await collectBoundedStream(stream, maxBytes, "expanded", signal, async () =>
      new Response(stream).arrayBuffer(),
    ),
  );
}

export interface IMountedFiles {
  compilerFiles: Record<string, string>;
  editorLibs: Record<string, string>;
  runtimeFiles: Record<string, string>;
}

export function mountPackageFiles(
  packageName: string,
  files: Record<string, string>,
): IMountedFiles {
  const compilerFiles: Record<string, string> = {};
  const editorLibs: Record<string, string> = {};
  const runtimeFiles: Record<string, string> = {};

  for (const [rel, text] of Object.entries(files)) {
    const packageRel = `${packageName}/${rel}`;
    compilerFiles[`node_modules/${packageRel}`] = text;
    if (rel === "package.json" || DECLARATION_FILE_REGEXP.test(rel)) {
      editorLibs[`file:///node_modules/${packageRel}`] = text;
    }
    if (RUNTIME_FILE_REGEXP.test(rel)) {
      runtimeFiles[packageRel] = text;
    }
  }

  return { compilerFiles, editorLibs, runtimeFiles };
}

export function enqueuePackageDependencies(
  packageJson: {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  },
  enqueue: (item: IQueueItem) => void,
  requester: string,
): void {
  const optionalDependencies = packageJson.optionalDependencies ?? {};
  for (const [name, range] of Object.entries(packageJson.dependencies ?? {})) {
    if (!(name in optionalDependencies) && isRegistryRange(range))
      enqueue({ name, range, optional: false, requester });
  }
  for (const [name, range] of Object.entries(optionalDependencies)) {
    if (isRegistryRange(range))
      enqueue({ name, range, optional: true, requester });
  }
  for (const [name, range] of Object.entries(
    packageJson.peerDependencies ?? {},
  )) {
    const optional =
      packageJson.peerDependenciesMeta?.[name]?.optional === true;
    // Truly optional peers (peerDependenciesMeta[name].optional === true)
    // are never enqueued. Required peers MUST propagate optional: false so
    // a 404 on the registry surfaces as an install failure instead of a
    // silent skip that leaves the wasm-side compile reporting a generic
    // "Cannot find module" with no breadcrumb back to the dep installer.
    if (!optional && isRegistryRange(range))
      enqueue({ name, range, optional: false, requester });
  }
}

function isRegistryRange(range: string): boolean {
  const spec = range.trim();
  // Match npm-package-arg's file classification before its registry fallback:
  // dot/home/root/drive paths and tar archive names are source specs even
  // though their characters could also form a URI-safe dist-tag.
  if (
    /^(?:\.|~[\\/]|[\\/]|[a-zA-Z]:)/.test(spec) ||
    /\.(?:tgz|tar\.gz|tar)$/i.test(spec)
  )
    return false;
  if (spec.startsWith("npm:")) return true;
  if (validRange(spec) !== null) return true;
  // npm accepts a dist-tag only when it is a non-empty URI-component-safe
  // token. Git, hosted, URL, and local-path specs all require punctuation that
  // encodeURIComponent escapes, so they cannot fall through as fake tags.
  return spec.length > 0 && encodeURIComponent(spec) === spec;
}

export function toTypesPackageName(packageName: string): string {
  if (!packageName.startsWith("@")) return `@types/${packageName}`;
  const [scope, name] = packageName.slice(1).split("/");
  return scope && name ? `@types/${scope}__${name}` : `@types/${packageName}`;
}

function readTarString(bytes: Uint8Array, decoder: TextDecoder): string {
  return trimNull(decoder.decode(bytes));
}

function trimNull(text: string): string {
  const index = text.indexOf("\0");
  return index < 0 ? text : text.slice(0, index);
}

function parseOctal(bytes: Uint8Array): number {
  const text = trimNull(new TextDecoder().decode(bytes)).trim();
  if (text.length === 0) return 0;
  if (!/^[0-7]+$/.test(text)) throw new Error("Invalid tar entry size.");
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Tar entry size is outside the safe integer range.");
  }
  return value;
}

function parsePaxPath(bytes: Uint8Array): string | null {
  const decoder = new TextDecoder();
  let offset = 0;
  let path: string | null = null;
  while (offset < bytes.length) {
    let space = offset;
    while (space < bytes.length && bytes[space] !== 0x20) space++;
    if (space === bytes.length) throw new Error("Invalid PAX header length.");
    const lengthText = decoder.decode(bytes.subarray(offset, space));
    if (!/^[1-9][0-9]*$/.test(lengthText))
      throw new Error("Invalid PAX header length.");
    const length = Number(lengthText);
    const end = offset + length;
    if (
      !Number.isSafeInteger(length) ||
      length <= space - offset + 1 ||
      end > bytes.length ||
      bytes[end - 1] !== 0x0a
    )
      throw new Error("Invalid PAX header record.");
    const record = decoder.decode(bytes.subarray(space + 1, end - 1));
    const eq = record.indexOf("=");
    if (eq > 0 && record.slice(0, eq) === "path") path = record.slice(eq + 1);
    offset = end;
  }
  return path;
}

function readTarHeaderPath(header: Uint8Array, decoder: TextDecoder): string {
  const name = readTarString(header.subarray(0, 100), decoder);
  const prefix = readTarString(header.subarray(345, 500), decoder);
  return prefix ? `${prefix}/${name}` : name;
}

/**
 * Require an npm archive path below one safe, consistent top-level root.
 *
 * Npm normally emits `package/`, while current DefinitelyTyped tarballs use
 * roots such as `node/` and `react/`. The root spelling does not enter the
 * mounted key; consistency and safe remaining segments provide confinement.
 */
function confineTarPath(
  rawPath: string,
  archiveRoot: string | null,
): { relative: string; root: string } {
  if (
    rawPath.length === 0 ||
    rawPath.includes("\\") ||
    rawPath.startsWith("/") ||
    /^[a-zA-Z]:/.test(rawPath)
  ) {
    throw new Error(`Invalid npm tar entry path ${JSON.stringify(rawPath)}.`);
  }
  const segments = rawPath.split("/");
  if (
    segments.length < 2 ||
    segments.some(
      (segment, index) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        (index > 0 && /^[a-zA-Z]:/.test(segment)),
    )
  ) {
    throw new Error(
      `npm tar entry is outside a confined package root: ${JSON.stringify(rawPath)}.`,
    );
  }
  const root = segments[0]!;
  if (archiveRoot !== null && root !== archiveRoot) {
    throw new Error(
      `npm tar archive mixes package roots ${JSON.stringify(archiveRoot)} and ${JSON.stringify(root)}.`,
    );
  }
  return { relative: segments.slice(1).join("/"), root };
}

interface IIntegrityCandidate {
  algorithm: string;
  digest: Uint8Array;
  rank: number;
  webAlgorithm: AlgorithmIdentifier;
}

function parseIntegrity(integrity: string): IIntegrityCandidate[] {
  const tokens = integrity.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new Error("tarball integrity is empty.");
  const candidates: IIntegrityCandidate[] = [];
  for (const token of tokens) {
    const match = /^([A-Za-z0-9]+)-([A-Za-z0-9+/]+={0,2})(?:\?[!-~]+)?$/i.exec(
      token,
    );
    if (!match) {
      throw new Error("tarball integrity contains malformed metadata.");
    }
    const algorithm = match[1]!.toLowerCase();
    if (!["sha1", "sha256", "sha384", "sha512"].includes(algorithm)) {
      decodeBase64(match[2]!);
      continue;
    }
    const expectedLength =
      algorithm === "sha512"
        ? 64
        : algorithm === "sha384"
          ? 48
          : algorithm === "sha256"
            ? 32
            : 20;
    const digest = decodeBase64(match[2]!);
    if (digest.length !== expectedLength) {
      throw new Error("tarball integrity contains a malformed digest.");
    }
    candidates.push({
      algorithm,
      digest,
      rank: expectedLength,
      webAlgorithm: algorithm.replace("sha", "SHA-") as AlgorithmIdentifier,
    });
  }
  if (candidates.length === 0) {
    throw new Error("tarball integrity has no supported digest algorithm.");
  }
  return candidates;
}

function decodeBase64(value: string): Uint8Array {
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("tarball integrity contains malformed base64.");
  }
}

function decodeHex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/../g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; ++index) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

async function collectBoundedStream(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: ValidatedNpmByteLimit,
  kind: "compressed" | "expanded",
  signal: AbortSignal | undefined,
  fallback: () => Promise<ArrayBuffer>,
): Promise<ArrayBuffer> {
  if (stream === null) {
    throwIfAborted(signal);
    const bytes = await abortable(fallback, signal);
    throwIfAborted(signal);
    if (bytes.byteLength > maxBytes) {
      throw new Error(
        `tarball exceeds the ${formatByteLimit(maxBytes)} ${kind} byte limit.`,
      );
    }
    return bytes;
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let abort: (() => void) | undefined;
  const aborted =
    signal === undefined
      ? undefined
      : new Promise<never>((_resolve, reject) => {
          abort = () => {
            let error: unknown;
            try {
              throwIfAborted(signal);
              return;
            } catch (caught) {
              error = caught;
            }
            void reader.cancel(error).catch(() => undefined);
            reject(error);
          };
          signal.addEventListener("abort", abort, { once: true });
        });
  try {
    for (;;) {
      throwIfAborted(signal);
      const read = reader.read();
      const next = aborted ? await Promise.race([read, aborted]) : await read;
      throwIfAborted(signal);
      if (next.done) break;
      if (next.value.byteLength > maxBytes - length) {
        void reader.cancel().catch(() => undefined);
        throw new Error(
          `tarball exceeds the ${formatByteLimit(maxBytes)} ${kind} byte limit.`,
        );
      }
      chunks.push(next.value);
      length += next.value.byteLength;
    }
  } catch (error) {
    void reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    if (abort !== undefined) signal?.removeEventListener("abort", abort);
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer;
}

function formatByteLimit(bytes: number): string {
  return `${bytes.toLocaleString("en-US")}-byte`;
}

/** Validate one public npm archive byte budget before starting related work. */
export function validateNpmByteLimit(
  maxBytes: number,
  kind: "compressed" | "expanded",
): ValidatedNpmByteLimit {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`${kind} byte limit must be a positive safe integer.`);
  }
  return maxBytes as ValidatedNpmByteLimit;
}

/**
 * Reject promptly on abort even when an underlying browser task is not
 * cancellable.
 */
function abortable<T>(
  start: () => Promise<T>,
  signal: AbortSignal | undefined,
  disposeLateValue?: (value: T) => void,
): Promise<T> {
  throwIfAborted(signal);
  const task = start();
  if (signal === undefined) return task;
  return new Promise<T>((resolve, reject) => {
    let aborted = false;
    const abort = () => {
      if (aborted) return;
      aborted = true;
      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
      }
    };
    signal.addEventListener("abort", abort, { once: true });
    void task
      .then((value) => {
        if (signal.aborted) {
          try {
            disposeLateValue?.(value);
          } catch {
            // Disposal is best-effort and must not replace the abort reason.
          }
          abort();
          return;
        }
        resolve(value);
      }, reject)
      .finally(() => {
        signal.removeEventListener("abort", abort);
      });
    if (signal.aborted) abort();
  });
}

/** Fetch one response and cancel any body that loses the abort race. */
async function fetchWithAbort(
  start: () => Promise<Response>,
  signal: AbortSignal | undefined,
): Promise<Response> {
  const cancel = (response: Response): void => {
    void response.body?.cancel().catch(() => undefined);
  };
  const response = await abortable(start, signal, cancel);
  if (signal?.aborted) {
    cancel(response);
    throwIfAborted(signal);
  }
  return response;
}
