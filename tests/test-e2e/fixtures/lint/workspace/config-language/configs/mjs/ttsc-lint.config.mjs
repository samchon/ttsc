export default Object.assign({
    rules: { "no-var": "error" },
}, {
    files: ["mjs.ts"],
    extends: "../json/ttsc-lint.config.json"
});
