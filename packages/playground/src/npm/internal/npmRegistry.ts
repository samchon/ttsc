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
  const response = await fetchImpl(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
    {
      headers: {
        Accept: "application/vnd.npm.install-v1+json, application/json",
      },
      signal,
    },
  );
  if (response.status === 404 && optional) return null;
  if (!response.ok) {
    throw new Error(
      `npm registry returned ${response.status} while resolving ${packageName}.`,
    );
  }
  return (await response.json()) as INpmMetadata;
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
): Promise<ArrayBuffer> {
  const response = await fetchImpl(tarball, { signal });
  if (!response.ok) {
    throw new Error(`tarball download failed with HTTP ${response.status}.`);
  }
  return response.arrayBuffer();
}

export async function unpackNpmTarball(
  tgz: ArrayBuffer,
  signal: AbortSignal | undefined,
): Promise<IUnpackedPackage> {
  throwIfAborted(signal);
  const tar = await gunzip(tgz);
  throwIfAborted(signal);
  const decoder = new TextDecoder();
  const files: Record<string, string> = {};
  let packageJson: IPackageJson = {};
  let offset = 0;
  let longPath: string | null = null;
  let paxPath: string | null = null;

  while (offset + 512 <= tar.length) {
    throwIfAborted(signal);
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((value) => value === 0)) break;

    const type = String.fromCharCode(header[156] ?? 0);
    const size = parseOctal(header.subarray(124, 136));
    const body = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    if (type === "L") {
      longPath = trimNull(decoder.decode(body));
      continue;
    }
    if (type === "x") {
      paxPath = parsePaxPath(body);
      continue;
    }
    if (type !== "0" && type !== "\0") {
      longPath = null;
      paxPath = null;
      continue;
    }

    const rawPath =
      paxPath ?? longPath ?? readTarString(header.subarray(0, 100), decoder);
    longPath = null;
    paxPath = null;
    const rel = stripTarRoot(rawPath);
    if (!rel || !TEXT_FILE_REGEXP.test(rel)) continue;

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

  return { files, packageJson };
}

async function gunzip(input: ArrayBuffer): Promise<Uint8Array> {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error(
      "This browser cannot unpack npm tgz files because DecompressionStream is unavailable.",
    );
  }
  const stream = new Blob([input])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
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
  return (index < 0 ? text : text.slice(0, index)).trim();
}

function parseOctal(bytes: Uint8Array): number {
  const text = trimNull(new TextDecoder().decode(bytes)).trim();
  return text ? Number.parseInt(text, 8) : 0;
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

function stripTarRoot(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return "";
  if (normalized.startsWith("package/"))
    return normalized.slice("package/".length);
  const slash = normalized.indexOf("/");
  return slash < 0 ? normalized : normalized.slice(slash + 1);
}
