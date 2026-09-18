import assert from "node:assert/strict";
import path from "node:path";

import { inlineSourceMap } from "../../../../../packages/unplugin/lib/core/transform/utils/inlineSourceMap.mjs";
import { resolveTransformSourceMap } from "../../../../../packages/unplugin/lib/core/transform/utils/resolveTransformSourceMap.mjs";
import { TTSC_SOURCE_MAP_STASH } from "../../../../../packages/unplugin/lib/core/webpack/TTSC_SOURCE_MAP_STASH.mjs";
import { restoreTtscSourceMap } from "../../../../../packages/unplugin/lib/core/webpack/restoreTtscSourceMap.mjs";

/**
 * Verifies a transform's source map reaches a host only when it describes the
 * text that host holds (samchon/ttsc#1392).
 *
 * A map is a claim about the text it was generated from, and every host
 * composes it with its own map of the text it delivered. The envelope's map is
 * kept only when its entry for the module carries exactly the delivered text,
 * and each host channel then hands it on only where that still holds: webpack
 * and Rspack through the loader that runs after ttsc's, and esbuild and Bun,
 * which take no separate map, through an inline comment.
 *
 * 1. Resolve an envelope map whose own entry matches the delivered text, then one
 *    that differs, one without contents, and one that does not name the
 *    module.
 * 2. Inline a map into contents, with and without a trailing newline, and a result
 *    without one.
 * 3. Run the webpack restore loader with the host asking for maps or not, with a
 *    map already arriving, and with text other than the transform's.
 */
export async function test_source_maps_reach_the_host_only_for_the_text_they_describe(): Promise<void> {
  const file = path.resolve("/project/src/main.ts");
  const source = "export const value = goUpper('x');\n";
  const envelope = {
    mappings: "AAAA",
    names: [],
    sourceRoot: "",
    sources: ["../types.d.ts", "main.ts"],
    sourcesContent: ["export {};\n", source],
    version: 3 as const,
  };
  const absolute = (location: string): string =>
    path.resolve(location).replace(/\\/g, "/");

  assert.deepEqual(resolveTransformSourceMap(file, source, envelope), {
    file: "main.ts",
    mappings: "AAAA",
    names: [],
    sources: [absolute("/project/types.d.ts"), absolute(file)],
    sourcesContent: envelope.sourcesContent,
    version: 3,
  });
  assert.equal(
    resolveTransformSourceMap(file, `${source}// rewritten\n`, envelope),
    undefined,
    "a map of other text is not a map of the delivered text",
  );
  assert.equal(
    resolveTransformSourceMap(file, source, {
      ...envelope,
      sourcesContent: undefined,
    }),
    undefined,
    "a map that cannot be checked is dropped",
  );
  assert.equal(
    resolveTransformSourceMap(file, source, {
      ...envelope,
      sources: ["../types.d.ts", "other.ts"],
    }),
    undefined,
    "a map that does not name the module",
  );
  assert.deepEqual(
    resolveTransformSourceMap(file, source, {
      ...envelope,
      sourceRoot: "../src",
    })?.sources,
    [absolute("/project/types.d.ts"), absolute(file)],
    "sources resolve through the source root",
  );

  const map = resolveTransformSourceMap(file, source, envelope)!;
  const encoded = Buffer.from(JSON.stringify(map), "utf8").toString("base64");
  const comment = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encoded}\n`;
  assert.equal(inlineSourceMap({ code: "a;\n", map }), `a;\n${comment}`);
  assert.equal(inlineSourceMap({ code: "a;", map }), `a;\n${comment}`);
  assert.equal(inlineSourceMap({ code: "a;" }), "a;", "no map, no comment");

  const load = (
    sourceMap: boolean | undefined,
    stashed: { code: string; map?: typeof map } | undefined,
    content: string,
    arriving?: unknown,
  ): { map: unknown; stashLeft: boolean } => {
    let handed: unknown = "unset";
    const context = {
      callback: (
        _error: null,
        _content: string | Buffer,
        forwarded?: unknown,
      ) => {
        handed = forwarded;
      },
      ...(sourceMap === undefined ? {} : { sourceMap }),
    };
    if (stashed !== undefined) TTSC_SOURCE_MAP_STASH.set(context, stashed);
    restoreTtscSourceMap.call(context, content, arriving, undefined);
    return { map: handed, stashLeft: TTSC_SOURCE_MAP_STASH.has(context) };
  };
  assert.deepEqual(load(true, { code: "out;", map }, "out;"), {
    map,
    stashLeft: false,
  });
  assert.deepEqual(load(true, { code: "out;", map }, "out;", null), {
    map,
    stashLeft: false,
  });
  const arriving = { mappings: "", sources: [], version: 3 };
  assert.deepEqual(
    load(true, { code: "out;", map }, "out;", arriving),
    { map: arriving, stashLeft: false },
    "a map that already arrived is kept",
  );
  assert.deepEqual(
    load(true, { code: "out;", map }, "later;"),
    { map: undefined, stashLeft: false },
    "text a later loader changed is not what the map describes",
  );
  assert.deepEqual(
    load(false, { code: "out;", map }, "out;"),
    { map: undefined, stashLeft: false },
    "a host that asked for no maps receives none",
  );
  assert.deepEqual(load(undefined, { code: "out;", map }, "out;"), {
    map: undefined,
    stashLeft: false,
  });
  assert.deepEqual(load(true, { code: "out;" }, "out;"), {
    map: undefined,
    stashLeft: false,
  });
  assert.deepEqual(load(true, undefined, "out;"), {
    map: undefined,
    stashLeft: false,
  });
}
