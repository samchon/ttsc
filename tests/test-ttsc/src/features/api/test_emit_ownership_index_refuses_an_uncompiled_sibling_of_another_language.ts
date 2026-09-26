import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../../packages/ttsc/lib/compiler/internal/EmitOwnershipIndex.js";

/**
 * Verifies an output is not claimed by an uncompiled same-stem source of
 * another language.
 *
 * A project whose `files` lists only `a.js` compiles it into `a.js` beside an
 * uncompiled `a.ts`. The index accepted `a.ts` as soon as it was the only
 * TypeScript candidate, before reading the source map that names `a.js`, so
 * ttsx executed the JavaScript file's output under the TypeScript file's path
 * (the exact-source contract of samchon/ttsc#1382). Each language pair of an
 * output extension has the same ambiguity. Without a map, the compiler's own
 * precedence still decides, as it does for a `.ts`/`.tsx` pair.
 *
 * 1. For `.ts`/`.js`, `.mts`/`.mjs`, `.cts`/`.cjs`, and `.tsx`/`.jsx` (JSX
 *    `preserve`), write both sources and one output whose map names the
 *    JavaScript source.
 * 2. Ask the index for each source.
 * 3. Assert the JavaScript source owns the output and the TypeScript one does not,
 *    and that with the map removed the TypeScript source wins by precedence.
 */
export const test_emit_ownership_index_refuses_an_uncompiled_sibling_of_another_language =
  () => {
    const base = fs.realpathSync.native(TestProject.tmpdir("ttsc-ownership-"));
    const root = path.join(base, "root");
    const emit = path.join(base, "emit");
    const write = (file: string, text: string = "//\n"): void => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    };
    const pairs: [string, string, string][] = [
      ["a.ts", "a.js", "a.js"],
      ["b.mts", "b.mjs", "b.mjs"],
      ["c.cts", "c.cjs", "c.cjs"],
      ["d.tsx", "d.jsx", "d.jsx"],
    ];
    for (const [typescript, javascript, output] of pairs) {
      write(path.join(root, typescript));
      write(path.join(root, javascript));
      write(path.join(emit, output));
      write(
        path.join(emit, `${output}.map`),
        JSON.stringify({
          version: 3,
          sources: [
            path
              .relative(emit, path.join(root, javascript))
              .split(path.sep)
              .join("/"),
          ],
          mappings: "",
        }),
      );
    }

    const index = new EmitOwnershipIndex({ emitDir: emit, rootDir: root });
    for (const [typescript, javascript, output] of pairs) {
      assert.equal(
        index.find(path.join(root, typescript)),
        null,
        `${typescript} was not compiled`,
      );
      assert.equal(
        index.find(path.join(root, javascript)),
        path.join(emit, output),
        `${javascript} owns ${output}`,
      );
    }

    for (const [, , output] of pairs)
      fs.rmSync(path.join(emit, `${output}.map`));
    const unmapped = new EmitOwnershipIndex({ emitDir: emit, rootDir: root });
    for (const [typescript, javascript, output] of pairs) {
      assert.equal(
        unmapped.find(path.join(root, typescript)),
        path.join(emit, output),
        `without a map ${typescript} wins by precedence`,
      );
      assert.equal(unmapped.find(path.join(root, javascript)), null);
    }
  };
