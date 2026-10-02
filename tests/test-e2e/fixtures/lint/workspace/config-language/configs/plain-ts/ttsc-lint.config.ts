export default Object.assign({
    rules: {
        "no-var": "error",
        "no-console": "off",
    },
}, {
    files: ["plain-ts.ts"],
    extends: "../mjs/ttsc-lint.config.mjs"
});
