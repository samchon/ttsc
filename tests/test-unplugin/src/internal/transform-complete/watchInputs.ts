import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

/** Collect the sorted watch inputs the adapter derives for one file. */
export async function watchInputs(
  file: string,
  plugins: unknown[],
): Promise<string[]> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const watched: string[] = [];
  const result = await transformTtsc(
    file,
    fs.readFileSync(file, "utf8"),
    resolveOptions({ plugins }),
    undefined,
    undefined,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(result);
  return [...watched].sort();
}
