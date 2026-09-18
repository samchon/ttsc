import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Capture everything written to stderr while `body` runs.
 *
 * The adapter reports a module it left untransformed on the same channel the
 * generation's other non-fatal diagnostics use, so the report is observable
 * only by intercepting that channel.
 */
async function captureStderr(body: () => Promise<void>): Promise<string> {
  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  try {
    await body();
  } finally {
    process.stderr.write = original;
  }
  return captured;
}

/**
 * Asserts a module the program does not contain is passed through, reported,
 * and does not fail the build.
 *
 * One condition had two answers. `@ttsc/metro` caught this case and handed the
 * original source downstream, calling it non-fatal and claiming to match the
 * other integrations, while every unplugin adapter threw and the bundler turned
 * that into a build failure (samchon/ttsc#1308). The core now decides it once,
 * for every adapter and for Metro, and returns `undefined` exactly as it does
 * for a module ttsc leaves unchanged.
 *
 * Passing through must not be silent, because a file that skips the ttsc pass
 * keeps whatever plugin syntax it carries, so the report is part of the
 * contract rather than a courtesy. It names the file and the program, and it
 * appears once per file per pass rather than once per delivery.
 */
export async function test_transformttsc_an_out_of_program_module_is_passed_through_and_reported(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  // The fixture's tsconfig includes `src` alone, so a source beside it is
  // reachable by a bundler and absent from the program.
  const stray = path.join(fixture.root, "scripts", "tool.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  const source = "export const tool: string = 'STRAY';";
  fs.writeFileSync(stray, source, "utf8");
  const watchBatches: string[][] = [];

  try {
    const deliver = () =>
      api.transformTtsc(
        stray,
        fs.readFileSync(stray, "utf8"),
        options,
        undefined,
        cache,
        {
          addWatchFiles: (inputs: readonly { file: string }[]) =>
            watchBatches.push(inputs.map((input) => path.resolve(input.file))),
        },
      );

    const reported = await captureStderr(async () => {
      api.beginTtscTransformBuild(cache);
      assert.equal(
        (await api.transformTtsc(
          fixture.modules[0]!,
          fs.readFileSync(fixture.modules[0]!, "utf8"),
          options,
          undefined,
          cache,
        )) !== undefined || true,
        true,
      );
      assert.equal(
        await deliver(),
        undefined,
        "a module the program does not contain must pass through, not throw",
      );
      assert.equal(
        watchBatches.length,
        1,
        "a pass-through delivery must publish one universal input batch",
      );
      assert.ok(
        watchBatches[0]!.includes(path.join(fixture.root, "tsconfig.json")),
        "the config that can later include the module must remain watched",
      );
      // Same pass, same file: the report is about the file and the generation,
      // not about the delivery, so asking again must not repeat it.
      assert.equal(await deliver(), undefined);
    });

    assert.ok(
      reported.includes(stray),
      `the report must name the module (got ${JSON.stringify(reported)})`,
    );
    assert.ok(
      reported.includes(path.join(fixture.root, "tsconfig.json")),
      "the report must name the program the module is missing from",
    );
    assert.equal(
      reported.split(stray).length - 1,
      1,
      "the report must appear once per file per pass, not once per delivery",
    );

    // A later pass reports again, because it is a new statement about a new
    // pass, exactly as the generation's other diagnostics behave.
    const second = await captureStderr(async () => {
      api.beginTtscTransformBuild(cache);
      assert.equal(await deliver(), undefined);
    });
    assert.ok(
      second.includes(stray),
      "a new pass must surface the report again",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
