import fs from "node:fs";
import path from "node:path";
import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import { PluginPackageResolution } from "./PluginPackageResolution";

/**
 * Validate contributor records before native host compilation.
 *
 * @evidence contracts/common.md#principled-implementation Ordered record checks establish unique valid names, absolute existing source directories and non-test Go source before physical identity normalization.
 * @evidence contracts/common.md#clear-and-simple-design One traversal owns contributor admission; a private directory predicate isolates buildable-source discovery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual loader now calls this unchanged guard; unit callers do not replace contributor compilation or transport assertions.
 * @evidence contracts/common.md#meaningful-documentation The headline documents admission and the return shape retains native source identities.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Native path.isAbsolute, fs.stat, readdir and resolveRealPath preserve platform path and physical-source distinctions rather than using POSIX string heuristics.
 * @evidence contracts/performance.md#efficient-algorithms Checks each contributor once with a set for names and one direct directory listing; cost is linear in records and immediate entries without recursively scanning payloads.
 * @evidence contracts/performance.md#reuse-equivalent-work Within one request the seen-name set avoids repeated name searches; filesystem admission is reobserved because callers may mutate contributor source between requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Name and result arrays exist only for this invocation and no file descriptor or global contributor cache is retained.
 */
export function validatePluginContributors(
  plugin: ITtscPlugin,
): readonly { name: string; source: string }[] | undefined {
  const contributors = plugin.contributors;
  if (contributors === undefined) return undefined;
  if (!Array.isArray(contributors)) {
    throw new Error(
      `ttsc: plugin "${plugin.name}" "contributors" must be an array of { name, source } entries`,
    );
  }
  if (contributors.length === 0) return undefined;
  const seen = new Set<string>();
  const out: { name: string; source: string }[] = [];
  for (const [index, entry] of contributors.entries()) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}] must be an object`,
      );
    }
    const { name, source } = entry as { name?: unknown; source?: unknown };
    if (typeof name !== "string" || !CONTRIBUTOR_NAME_PATTERN.test(name)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].name must match /^[a-z][a-z0-9_]*$/; ` +
          `got ${JSON.stringify(name)}`,
      );
    }
    if (seen.has(name)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}] duplicate name ${JSON.stringify(name)}`,
      );
    }
    seen.add(name);
    if (typeof source !== "string" || source.length === 0) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be a non-empty string`,
      );
    }
    if (!path.isAbsolute(source)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be an absolute path; ` +
          `got ${JSON.stringify(source)}`,
      );
    }
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be an existing directory: ${source}`,
      );
    }
    // Pre-flight check that the directory actually carries a buildable
    // contributor package. Without this, an accidentally-empty directory
    // (or a directory containing only `_test.go` files, which `go build`
    // silently skips) reaches the synthesized blank-import step and Go's
    // compile error surfaces with a scratch-tempdir path that doesn't
    // name the contributor entry. Catching it here lets us name the
    // entry the user actually authored.
    if (!hasBuildableGoSource(source)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must contain at least one non-test ".go" file: ${source}`,
      );
    }
    out.push({ name, source: PluginPackageResolution.resolveRealPath(source) });
  }
  return out;
}

const CONTRIBUTOR_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function hasBuildableGoSource(dir: string): boolean {
  // `go build` consumes `.go` files but silently ignores `_test.go`. A
  // contributor whose source dir holds only test files would compile to
  // an empty package and surface as an opaque scratch-tempdir error;
  // require at least one production `.go` file so the validator can
  // name the contributor entry instead.
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  return entries.some(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".go") &&
      !entry.name.endsWith("_test.go"),
  );
}
