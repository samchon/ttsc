import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";
import type { IPluginModuleReplaceDirectory } from "./IPluginModuleReplaceDirectory";
import { GoToolResolution } from "./GoToolResolution";
import { resolveGoCompiler } from "./resolveGoCompiler";
import { spawnGoTool } from "./spawnGoTool";

/**
 * The local directories outside a plugin's Go module that its `go.mod`
 * `replace` directives name, which `go build` reads in place.
 *
 * A `replace` whose target is a filesystem path (Go's rule: absolute, or
 * beginning with `./` or `../`) makes the build compile that directory as the
 * replaced module. One inside the module is copied and keyed with it. One
 * outside is neither, yet the build compiles it, so its sources are part of
 * what the binary is built from: the cache key digests them, the load reports
 * their state among `pluginSources`, and a watch observes them, exactly like the
 * module's own (samchon/ttsc#1506). A relative target also has to resolve from
 * the module's own directory, as it does for `go build` there, and not from the
 * scratch copy the build runs in.
 *
 * The directives are read through `go mod edit -json`, Go's own reading of
 * `go.mod`, not a copy of its grammar. Only the main module's directives count,
 * as Go ignores the `replace` directives of every other module.
 *
 * @param moduleRoot The plugin's Go module root, which holds its `go.mod`.
 * @param env The build's effective environment.
 * @param goBinary The Go tool the build runs, or `undefined` to resolve it as
 *   the build does.
 * @returns Each replacement outside the module, sorted by module path: the
 *   replaced module path and version, the target as `go.mod` spells it, and
 *   the target's absolute path.
 * @throws When `go.mod` exists and Go cannot read it, as the build would fail.
 */
export function pluginModuleReplaceDirectories(
  moduleRoot: string,
  env: NodeJS.ProcessEnv,
  goBinary?: string,
): IPluginModuleReplaceDirectory[] {
  const root = path.resolve(moduleRoot);
  let text: string;
  try {
    text = fs.readFileSync(path.join(root, "go.mod"), "utf8");
  } catch {
    return [];
  }
  // Every `replace` directive spells the word, so a file without it has none,
  // and Go need not be run to read it. A file with it is read by Go itself.
  if (!text.includes("replace")) return [];
  const go =
    goBinary ??
    GoToolResolution.resolveGoToolForBuild(
      resolveGoCompiler(env).binary,
      env,
      root,
    );
  const result = spawnGoTool(go, ["mod", "edit", "-json"], {
    cwd: root,
    encoding: "utf8",
    env: GoSourceInputs.goBuildEnv(go, undefined, env),
    windowsHide: true,
  });
  if (result.error !== undefined || result.status !== 0)
    throw new Error(
      `ttsc: reading ${path.join(root, "go.mod")} failed: ${
        result.error?.message ?? (result.stderr || result.stdout)
      }`,
    );
  const parsed = JSON.parse(result.stdout) as {
    Replace?: readonly {
      New?: { Path?: string; Version?: string };
      Old?: { Path?: string; Version?: string };
    }[];
  };
  const out: IPluginModuleReplaceDirectory[] = [];
  for (const replacement of parsed.Replace ?? []) {
    const modulePath = replacement.Old?.Path;
    const spelled = replacement.New?.Path;
    if (
      modulePath === undefined ||
      spelled === undefined ||
      replacement.New?.Version !== undefined ||
      !isFilesystemPath(spelled)
    )
      continue;
    const directory = path.resolve(root, spelled);
    const relative = path.relative(root, directory);
    if (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
      continue;
    out.push({
      directory,
      modulePath,
      spelled,
      ...(replacement.Old?.Version === undefined
        ? {}
        : { version: replacement.Old.Version }),
    });
  }
  return out.sort((left, right) =>
    left.modulePath === right.modulePath
      ? (left.version ?? "") < (right.version ?? "")
        ? -1
        : 1
      : left.modulePath < right.modulePath
        ? -1
        : 1,
  );
}

/**
 * Whether a `replace` target is a filesystem path rather than a module path:
 * absolute, or beginning with `./` or `../` (either separator on Windows).
 */
function isFilesystemPath(target: string): boolean {
  return (
    path.isAbsolute(target) ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    (process.platform === "win32" &&
      (target.startsWith(".\\") || target.startsWith("..\\")))
  );
}
