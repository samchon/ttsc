const path = require("node:path");

const tarballs = path.resolve(__dirname, "../../experimental/tarballs");
const artifacts = {
  ttsc: "ttsc.tgz",
  "@ttsc/unplugin": "unplugin.tgz",
  [`@ttsc/${process.platform}-${process.arch}`]: `ttsc-${process.platform}-${process.arch}.tgz`,
};

// pnpm's installation hook binds dependency and peer edges to the same candidate.
// A peer with the candidate's published version otherwise selects registry code.
module.exports = {
  hooks: {
    readPackage(pkg) {
      for (const [name, file] of Object.entries(artifacts)) {
        const candidate = `file:${path.join(tarballs, file).split(path.sep).join("/")}`;
        for (const field of ["dependencies", "devDependencies", "optionalDependencies"])
          if (pkg[field]?.[name]) pkg[field][name] = candidate;
        if (pkg.peerDependencies?.[name]) {
          (pkg.dependencies ??= {})[name] = candidate;
          delete pkg.peerDependencies[name];
          if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[name];
        }
      }
      return pkg;
    },
  },
};
