// @ttsc-corpus-filename: src/pages/index.ts

// expect: nextjs/no-assign-module-variable error
const module = {};
export default module;
