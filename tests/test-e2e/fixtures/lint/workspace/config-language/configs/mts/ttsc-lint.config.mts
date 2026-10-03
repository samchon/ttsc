export default Object.assign({
    rules: { "no-var": "error" },
}, {
    files: ["mts.ts"],
    extends: "../cts/ttsc-lint.config.cts"
});
