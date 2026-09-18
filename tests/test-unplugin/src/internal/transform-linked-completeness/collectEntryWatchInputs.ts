import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { ILinkedPluginProject } from "./ILinkedPluginProject";

/**
 * Transform the entry once and collect every watch input the adapter derived.
 *
 * `aliases` forces the compile through a generated tsconfig in the system temp
 * directory, which moves the host's cwd off the project root and therefore
 * changes how every envelope section is keyed.
 */
export async function collectEntryWatchInputs(
  project: ILinkedPluginProject,
  aliases?: Record<string, string>,
): Promise<string[]> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const watched: string[] = [];
  // The watch inputs are notified whether or not the transform changed the
  // text, so the derivation is observable even for a plugin set that leaves
  // this particular entry alone; an empty list is the only state that would
  // make the scenario prove nothing.
  await transformTtsc(
    project.main,
    fs.readFileSync(project.main, "utf8"),
    resolveOptions(),
    aliases,
    undefined,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(
    watched.length !== 0,
    "the transform must derive watch inputs, or the scenario proves nothing",
  );
  return watched.map((input) => path.resolve(input));
}
