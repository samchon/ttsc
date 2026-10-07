import assert from "node:assert/strict";
import path from "node:path";

import { resolveSingleFileOutput } from "../../../../../packages/ttsc/src/launcher/internal/resolveSingleFileOutput";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies only a separate JSX preserve value selects positional .jsx output.
 *
 * Inline compiler options are not accepted by the pinned compiler grammar. The
 * launcher must therefore avoid treating an inline value as preserve.
 *
 * 1. Create a project with a tsx source and declaration output.
 * 2. Resolve the positional output for an inline jsx preserve spelling and require
 *    the ordinary js path.
 * 3. Resolve it for a separate jsx and preserve pair and require the jsx path.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveSingleFileOutput is called for src/view.tsx in a temp commonjs project (outDir dist, rootDir src) with passthrough [--jsx=preserve], which must yield dist/view.js, and with [--jsx, preserve], which must yield dist/view.jsx.
 * @evidence contracts/testing.md#independent-expectations The expected paths are literals derived from the fixture's tsconfig layout (src to dist) and the rule that only a separate '--jsx preserve' pair selects preserve output, since an attached '=' spelling is not read as the option value; neither value is obtained from a compiler run.
 * @evidence contracts/testing.md#distinguishing-cases Inline equals spelling differs from a separate option/value pair on the same source and configuration.
 * @evidence contracts/testing.md#execution-ownership A unit test calling resolveSingleFileOutput directly against a temp project directory; no compiler, install or native build runs.
 */
export const test_resolvesinglefileoutput_distinguishes_inline_and_separate_jsx_values =
  () => {
    const root = TestProject.physicalPath(
      TestProject.commonJsProject(
        {
          "src/view.tsx": "export const view = 1;\n",
        },
        { compilerOptions: { declaration: true } },
      ),
    );
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
