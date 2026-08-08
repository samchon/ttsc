import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import typia from "typia";

import type { ITtscEvidenceBenchmarkWorkspaceArtifact } from "./structures/ITtscEvidenceBenchmarkWorkspaceArtifact";

/**
 * Packs the workspace packages a measured cell must compile against.
 *
 * Upstream this benchmark resolves `ttsc` and `@ttsc/lint` from a catalog,
 * because they are external dependencies there. Here they are the workspace
 * itself, so a delivered tree that installed them from the registry would
 * report on the last published release instead of the tree under test.
 *
 * This sits beside the workspace materializer rather than inside the command
 * line so that both the launch and the feature suite that proves the launch ask
 * one module which packages are packed and how. A caller that spelled the set
 * again could agree with itself while disagreeing with what a cell installs.
 */
export namespace EvidenceBenchmarkToolchain {
  /**
   * Workspace package directories a launch packs for both arms.
   *
   * The platform package is in the list because `ttsc` loads its native Go
   * compiler from it as an optional dependency. Packing `ttsc` alone would put
   * a locally built JavaScript wrapper in front of a published compiler binary,
   * which is a pairing that exists nowhere else and measures neither side.
   */
  export const directories: readonly string[] = [
    "packages/ttsc",
    "packages/lint",
    "packages/unplugin",
    `packages/ttsc-${process.platform}-${process.arch}`,
  ];

  /**
   * Packs every package of {@link directories} into `temporary`.
   *
   * Each dependency name comes from the packed package's own manifest rather
   * than from a constant beside the directory list. A package renamed in this
   * repository would otherwise bind the workspace to a name nothing publishes,
   * and pnpm would install the registry copy of the old one without complaint.
   */
  export async function pack(
    repository: string,
    temporary: string,
  ): Promise<ITtscEvidenceBenchmarkWorkspaceArtifact[]> {
    const artifacts: ITtscEvidenceBenchmarkWorkspaceArtifact[] = [];
    for (const directory of directories) {
      const location: string = path.join(repository, ...directory.split("/"));
      if (!fs.existsSync(location) || !fs.statSync(location).isDirectory())
        throw new Error(
          `Benchmark toolchain package directory is missing: ${directory}.`,
        );
      const manifest: string = path.join(location, "package.json");
      if (!fs.existsSync(manifest))
        throw new Error(
          `Benchmark toolchain package has no manifest: ${directory}.`,
        );
      const { name } = typia.assert<{ name: string }>(
        JSON.parse(fs.readFileSync(manifest, "utf8")),
      );
      const archive: string = path.join(
        temporary,
        `${path.basename(directory)}.tgz`,
      );
      await packPackage(repository, directory, archive);
      artifacts.push({ name, archive });
    }
    return artifacts;
  }

  /**
   * Packs one workspace package of this repository into `archive`.
   *
   * @param repository Repository root the package directory is resolved
   *   against.
   * @param directory POSIX-relative package directory, such as `packages/ttsc`.
   * @param archive Absolute destination path of the produced tarball.
   */
  export async function packPackage(
    repository: string,
    directory: string,
    archive: string,
  ): Promise<void> {
    const entrypoint: string | undefined = process.env.npm_execpath;
    if (entrypoint === undefined)
      throw new Error(
        "The benchmark command line must be launched through pnpm.",
      );
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [entrypoint, "pack", "--out", archive],
        {
          cwd: path.join(repository, ...directory.split("/")),
          env: process.env,
          shell: false,
          windowsHide: true,
          stdio: "inherit",
        },
      );
      child.once("error", reject);
      child.once("close", (exitCode, signal) => {
        if (exitCode === 0 && signal === null) resolve();
        else
          reject(
            new Error(
              [
                `Package pack of ${directory} exited with`,
                `code ${String(exitCode)} and signal ${String(signal)}.`,
              ].join(" "),
            ),
          );
      });
    });
  }
}
