module.exports = {
  extends: "./tools/resident-config/optout.config.ts",
  plugins: { topology: { source: process.env.TTSC_RESIDENT_CONTRIBUTOR } },
};
