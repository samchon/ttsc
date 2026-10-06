import * as shared from "./shared-lint.config.ts";

export default {
  ...shared,
  ignores: [".next/**/*.ts", "next-env.d.ts", "src/functional/**/*.ts"],
};
