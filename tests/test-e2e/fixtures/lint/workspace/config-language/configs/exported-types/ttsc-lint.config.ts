import type { ITtscLintConfig } from "@ttsc/lint";
const config = {
    rules: {
        "no-var": "error",
        "no-console": "off",
    },
} satisfies ITtscLintConfig;
export default Object.assign(config, {
    files: ["exported-types.ts"],
    extends: "../js-sibling/ttsc-lint.config.ts"
});
