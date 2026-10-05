import { TTSX_MINIMUM_NODE_VERSION } from "./TTSX_MINIMUM_NODE_VERSION";

/**
 * Report why the running (or a candidate) Node.js version cannot execute the
 * ttsx source runtime, or `null` when it passes this minimum-version check.
 * Returning an actionable message — rather than letting the child die with an
 * internal `TypeError` on the missing `registerHooks`, or Node 18 rejecting
 * `--disable-warning` with exit 9 — is what turns an opaque internal failure
 * into a clear version diagnostic.
 *
 * Bun/Deno identity markers select the Node-only support policy even when they
 * also report a compatible-looking Node version. This decision does not probe
 * their current APIs or certify every other runtime as Node; the separate
 * loader capability boundary remains responsible for actual hooks.
 *
 * A null answer passes only this runtime-identity and minimum-API version
 * check. Hook installation separately requires the actual public loader
 * capabilities; a release above the floor can still be unsupported there.
 *
 * @param version - The Node version the runtime reports.
 * @param versions - The runtime's `process.versions`, which names Bun or Deno
 *   when one of them imitates Node.
 * @evidence contracts/common.md#principled-implementation Known non-Node runtime markers are rejected before major/minor/patch comparison with the minimum API floor; unknown version syntax alone does not prove incompatibility. Null does not certify the separate public-hook capability gate.
 * @evidence contracts/common.md#clear-and-simple-design Version parsing and tuple comparison are private helpers under one diagnostic decision; loader behavior probes remain a separate capability owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The minimum release and Bun/Deno markers describe actual supported runtime boundaries, not fixture versions, and no runtime method is replaced to emulate missing hooks.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain checked emit/plugin consequences and the separate capability gate, while parameter docs distinguish reported version from runtime identity markers.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This diagnostic keeps no request history or native handle; supplied records remain caller-owned and the returned text belongs to its consumer.
 * @evidence contracts/performance.md#efficient-algorithms Two marker fields precede trimmed version parsing and at most three numeric comparisons. Text scanning/conversion and diagnostic construction scale with supplied strings; the fixed tuple does not make all text processing constant time.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call compares current supplied identity/version fields; it owns no compilation or native capability memo to reuse.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Reads version strings (process.versions by default) and compares numeric parts; it has no path or platform branch.
 */
export function checkNodeRuntimeSupport(
  version: string,
  versions: Readonly<Record<string, string | undefined>> = process.versions,
): string | null {
  for (const [key, name] of NON_NODE_RUNTIMES) {
    const imitator = versions[key];
    if (typeof imitator === "string") {
      return (
        `ttsx runs on Node.js, but this process is ${name} ${imitator}. ` +
        `The ttsx checked-emit/plugin runtime supports Node.js rather than ${name}; ` +
        `a reported compatibility version does not establish the supported hook boundary ` +
        `or checked-emit execution. Run it with Node.js instead, for ` +
        `example \`npx ttsx\` (\`bunx ttsx\` also uses Node.js unless ` +
        `\`--bun\` is given).`
      );
    }
  }
  const parts = parseNodeVersion(version);
  if (parts === null) {
    // An unrecognizable version string is not proof of an unsupported runtime;
    // let execution proceed rather than block on a parsing quirk.
    return null;
  }
  if (compareVersionParts(parts, TTSX_MINIMUM_NODE_PARTS) >= 0) {
    return null;
  }
  return (
    `ttsx requires Node.js ${TTSX_MINIMUM_NODE_VERSION} or later, but this ` +
    `process is Node.js ${version}. The source runtime installs synchronous ` +
    `module hooks (module.registerHooks, Node 22.15.0) and strips types with ` +
    `module.stripTypeScriptTypes (Node 22.13.0). The required synchronous hooks ` +
    `are unavailable below this floor. Upgrade Node.js to 22.15.0+ (or the current LTS), or ` +
    `compile the project with \`ttsc\` and run the emitted JavaScript directly.`
  );
}

const TTSX_MINIMUM_NODE_PARTS: readonly [number, number, number] = [22, 15, 0];

/** `process.versions` keys of runtimes that report a Node version too. */
const NON_NODE_RUNTIMES: readonly (readonly [string, string])[] = [
  ["bun", "Bun"],
  ["deno", "Deno"],
];

function parseNodeVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (match === null) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersionParts(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  for (let index = 0; index < 3; index += 1) {
    if (a[index]! !== b[index]!) {
      return a[index]! < b[index]! ? -1 : 1;
    }
  }
  return 0;
}
