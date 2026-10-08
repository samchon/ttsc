const state = globalThis.__ttscPackageStars ??= { leaf: 0, source: 0 };
++state.leaf;
exports.foo = "package-foo";
exports.loadCount = () => state.leaf;
