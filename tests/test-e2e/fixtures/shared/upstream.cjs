exports.transform = async (params) => ({ ast: { source: params.src, filename: params.filename, options: params.options, plugins: params.plugins } });
exports.getCacheKey = () => "shared-authored-upstream";
