import assert from "node:assert/strict";
import path from "node:path";
import { TestProject } from "../../../../utils/src/TestProject";
import { resolveSingleFileOutput } from "../../../../../packages/ttsc/src/launcher/internal/resolveSingleFileOutput";

/**
 * Verifies only a separate JSX preserve value selects positional .jsx output.
 *
 * Inline compiler options are not accepted by the pinned compiler grammar.
 * The launcher must therefore avoid treating an inline value as preserve.
 *
 * 1. Create a project with a tsx source and declaration output.
 * 2. Resolve the positional output for an inline jsx preserve spelling and require
 *    the ordinary js path.
 * 3. Resolve it for a separate jsx and preserve pair and require the jsx path.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored positional output resolver with inline and separate JSX preserve spellings, retaining exact .js versus .jsx path assertions from the compiler boundary matrix.
 * @evidence contracts/testing.md#independent-expectations The independently authored source/config and pinned separate-value grammar determine dist/view.js and dist/view.jsx; no compiler result computes the expectation.
 * @evidence contracts/testing.md#distinguishing-cases Inline equals spelling differs from a separate option/value pair on the same source and configuration.
 * @evidence contracts/testing.md#execution-ownership This named source unit directly calls the authored resolver on a registered filesystem fixture; no installed consumer, native build or product process is created.
 */
export const test_resolvesinglefileoutput_distinguishes_inline_and_separate_jsx_values = () => {
  const root = TestProject.physicalPath(TestProject.commonJsProject({
    "src/view.tsx": "export const view = 1;\n",
  }, { compilerOptions: { declaration: true } }));
  const tsx = path.join(root, "src", "view.tsx");
  assert.equal(
    resolveSingleFileOutput({
      cwd: root,
      file: tsx,
      passthrough: ["--jsx=preserve"],
    }),
    path.join(root, "dist", "view.js"),
  );
  assert.equal(
    resolveSingleFileOutput({
      cwd: root,
      file: tsx,
      passthrough: ["--jsx", "preserve"],
    }),
    path.join(root, "dist", "view.jsx"),
  );
};
