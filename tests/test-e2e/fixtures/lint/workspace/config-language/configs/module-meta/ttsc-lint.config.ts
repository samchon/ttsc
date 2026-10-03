const here: string = import.meta.url;
export default Object.assign({
    rules: { "no-console": here.startsWith("file:") ? "error" : "off" },
}, {
    files: ["module-meta.ts"],
    extends: "../mts/ttsc-lint.config.mts"
});
