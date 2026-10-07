const config = {
    rules: { "no-console": "error" },
};
export = Object.assign(config, {
    files: ["cts.ts"],
    extends: "../exported-types/ttsc-lint.config.ts"
});
