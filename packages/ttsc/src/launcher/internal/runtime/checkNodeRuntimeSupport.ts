import { TTSX_MINIMUM_NODE_VERSION } from "./TTSX_MINIMUM_NODE_VERSION";

/**
 * Report why the running (or a candidate) Node.js version cannot execute the
 * ttsx source runtime, or `null` when it passes this minimum-version check.
 * Returning an actionable message — rather than letting the child die with an
 * internal `TypeError` on the missing `registerHooks`, or Node 18 rejecting
 * `--disable-warning` with exit 9 — is what turns an opaque internal failure
 * into a clear version diagnostic.
 *
 * A runtime that only imitates Node is refused as well. Bun and Deno report a
 * Node version in `process.versions.node` for compatibility, which passed this
 * check, and neither implements `module.registerHooks`: a preload then died on
 * the missing function, and the launcher's child, run by the same runtime,
 * executed the entry through that runtime's own TypeScript support instead of
 * the checked emit, silently dropping the project's transform plugins.
 *
 * A null answer passes only this runtime-identity and minimum-API version
 * check. Hook installation separately requires the actual public loader
 * capabilities; a release above the floor can still be unsupported there.
 *
 * @param version - The Node version the runtime reports.
 * @param versions - The runtime's `process.versions`, which names Bun or Deno
 *   when one of them imitates Node.
 *
 * @evidence contracts/common.md#principled-implementation Known non-Node runtime markers are rejected before major/minor/patch comparison with the minimum API floor; unknown version syntax alone does not prove incompatibility. Null does not certify the separate public-hook capability gate.
 * @evidence contracts/common.md#clear-and-simple-design Version parsing and tuple comparison are private helpers under one diagnostic decision; loader behavior probes remain a separate capability owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The minimum release and Bun/Deno markers describe actual supported runtime boundaries, not fixture versions, and no runtime method is replaced to emulate missing hooks.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain checked emit/plugin consequences and the separate capability gate, while parameter docs distinguish reported version from runtime identity markers.
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
        `${name} executes TypeScript itself and has no module.registerHooks, ` +
        `so ttsx could neither install its runtime nor run the checked emit ` +
        `with the project's plugins applied. Run it with Node.js instead, for ` +
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
    `module.stripTypeScriptTypes (Node 22.13.0), neither of which exists on ` +
    `earlier releases. Upgrade Node.js to 22.15.0+ (or the current LTS), or ` +
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
