const here: string = __dirname;
export default Object.assign({
    rules: { "no-console": here.length > 0 ? "error" : "off" },
}, {
    files: ["commonjs-globals.ts"],
    extends: "../module-meta/ttsc-lint.config.ts"
});
