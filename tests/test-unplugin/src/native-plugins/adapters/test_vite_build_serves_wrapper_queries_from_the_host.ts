import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const viteBuild: (config: object) => Promise<unknown> =
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite").build;

/**
 * Verifies a Vite build answers `?raw` and `?url` imports of a transformed
 * source from the host, next to the transformed module itself
 * (samchon/ttsc#1394).
 *
 * The adapter stripped every query and substituted the compiled program for the
 * module, so `import text from "./main.ts?raw"` received transformed TypeScript
 * instead of the file's text, and `?url` lost its asset URL.
 *
 * 1. Import one source plainly, as `?raw`, and as `?url` from an entry the
 *    transform leaves alone.
 * 2. Build with the ttsc adapter.
 * 3. Assert the raw import holds the file's untransformed text, the URL import an
 *    asset URL, and the plain import the transformed value.
 */
export async function test_vite_build_serves_wrapper_queries_from_the_host(): Promise<void> {
  const root = fs.realpathSync.native(TestUnpluginProject.createProject());
  const entry = path.join(root, "src", "entry.ts");
  fs.writeFileSync(
    entry,
    [
      'import raw from "./main.ts?raw";',
      'import url from "./main.ts?url";',
      'import { value } from "./main.ts";',
      "(globalThis as Record<string, unknown>).wrapped = { raw, url, value };",
      "",
    ].join("\n"),
  );
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const output: any = await viteBuild({
    build: {
      assetsInlineLimit: 0,
      minify: false,
      rollupOptions: { input: entry },
      write: false,
    },
    configFile: false,
    logLevel: "silent",
    plugins: [unpluginVite()],
    root,
  });
  const chunks = Array.isArray(output)
    ? output.flatMap((result: any) => result.output)
    : output.output;
  const code = TestUnpluginProject.collectRollupOutputCode(chunks);
  assert.ok(
    /const raw = (["'])export const value: string = goUpper\(\\?"plugin\\?"\);/.test(
      code,
    ),
    `the ?raw import must hold the file's own text: ${code.slice(0, 800)}`,
  );
  assert.match(code, /PLUGIN/, "the plain import is transformed");
  assert.ok(
    chunks.some(
      (chunk: any) =>
        chunk.type === "asset" && /main-.*\.ts$/.test(chunk.fileName),
    ),
    "the ?url import emits the file as an asset",
  );
}
