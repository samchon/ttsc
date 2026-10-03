import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import webpack, { type Configuration, type Stats } from "webpack";

/** Run one webpack build to completion, persisting the filesystem cache. */
export async function buildOnce(config: Configuration): Promise<string> {
  const compiler = webpack(config);
  const stats = await new Promise<Stats | undefined>((resolve, reject) => {
    compiler.run((error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
  assert.ok(stats);
  assert.equal(stats.hasErrors(), false, stats.toString({ errors: true }));
  // Persistent cache entries are written on close; without it the second
  // build would not observe the first build's snapshots at all.
  await new Promise<void>((resolve, reject) => {
    compiler.close((error) => (error ? reject(error) : resolve()));
  });
  const output = config.output?.path;
  assert.ok(output);
  return fs.readFileSync(path.join(output, "bundle.js"), "utf8");
}
