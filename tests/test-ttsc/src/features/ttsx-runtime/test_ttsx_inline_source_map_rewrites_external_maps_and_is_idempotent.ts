import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inlineServedSourceMap } from "../../../../../packages/ttsc/lib/launcher/internal/servedSourceMap.js";

/**
 * Verifies the serve-time source-map inliner rewrites an external map into an
 * absolutized `data:` URI and is idempotent (issue #353).
 *
 * The inliner is the choke point every served emit passes through, so its own
 * contract is pinned directly here rather than only through spawned runs: it
 * reads the sibling `.map`, replaces `sources` with the real absolute `file://`
 * URL, drops `sourceRoot`, and re-encodes — and re-running it on
 * already-inlined text (as the shared cross-process dependency cache can) must
 * reproduce the same bytes. A CRLF-terminated emit must rewrite the same way.
 *
 * 1. Write a `lib.js` + sibling `lib.js.map` (relative `sources`, a `sourceRoot`)
 *    and inline it; assert the trailer is a single `data:` URI whose decoded
 *    map lists the real absolute source and carries no `sourceRoot`.
 * 2. Feed the output back through a fresh emit key; assert the bytes are equal.
 * 3. Inline a CRLF-terminated emit; assert it too becomes a `data:` trailer.
 */
export const test_ttsx_inline_source_map_rewrites_external_maps_and_is_idempotent =
  () => {
    const dir = TestProject.tmpdir("ttsx-inline-map-");
    const sourceFile = path.join(dir, "src", "lib.ts");
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
    fs.writeFileSync(sourceFile, "export const x = 1;\n");

    const map = JSON.stringify({
      version: 3,
      file: "lib.js",
      sourceRoot: "",
      sources: ["../src/lib.ts"],
      names: [],
      mappings: "AAAA",
    });
    const emittedFile = path.join(dir, "lib.js");
    fs.writeFileSync(`${emittedFile}.map`, map);

    const served = "exports.x = 1;\n//# sourceMappingURL=lib.js.map";
    const out = inlineServedSourceMap(served, emittedFile, sourceFile);

    assert.equal(
      trailerCount(out),
      1,
      "the rewrite must leave exactly one sourceMappingURL trailer",
    );
    const decoded = decodeInlineMap(out);
    assert.deepEqual(
      decoded.sources,
      [pathToFileURL(sourceFile).href],
      "sources must become the real absolute file URL",
    );
    assert.ok(
      !("sourceRoot" in decoded),
      "sourceRoot must be dropped once sources are absolute",
    );
    assert.ok(
      out.startsWith("exports.x = 1;\n//# sourceMappingURL=data:"),
      "the emitted body must be preserved before the inlined trailer",
    );

    // Idempotent: a second pass over already-inlined text (fresh cache key)
    // reproduces the same bytes.
    const again = inlineServedSourceMap(
      out,
      path.join(dir, "lib-again.js"),
      sourceFile,
    );
    assert.equal(
      again,
      out,
      "re-inlining already-inlined text must be a no-op",
    );

    // CRLF emit: the trailer still matches and rewrites.
    const crlfEmitted = path.join(dir, "crlf.js");
    fs.writeFileSync(`${crlfEmitted}.map`, map);
    const crlfServed = "exports.x = 1;\r\n//# sourceMappingURL=crlf.js.map";
    const crlfOut = inlineServedSourceMap(crlfServed, crlfEmitted, sourceFile);
    assert.equal(
      trailerCount(crlfOut),
      1,
      "a CRLF-terminated emit must rewrite to one data: trailer",
    );
    assert.ok(
      crlfOut.startsWith("exports.x = 1;\r\n//# sourceMappingURL=data:"),
      "the CRLF body and line ending must be preserved",
    );
  };

function trailerCount(text: string): number {
  return (text.match(/sourceMappingURL=data:/g) ?? []).length;
}

function decodeInlineMap(text: string): Record<string, unknown> {
  const match = text.match(
    /sourceMappingURL=data:application\/json;[^,]*,(.+)$/,
  );
  assert.ok(match, "output must carry a base64 data URI");
  return JSON.parse(Buffer.from(match[1]!, "base64").toString("utf8"));
}
