import type { ITtscLintConfig } from "@ttsc/lint";

/** The backend package runs the shared workspace rules. */
export default {
  extends: "../../config/lint.config.ts",
  // Prisma owns this generated client, and `include` selects it with the rest
  // of `src`.
  ignores: ["src/prisma/**/*.ts"],
} satisfies ITtscLintConfig;
