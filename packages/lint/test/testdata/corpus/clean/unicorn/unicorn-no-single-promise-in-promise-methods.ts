// @ttsc-corpus-clean: unicorn/no-single-promise-in-promise-methods
const p = Promise.all([Promise.resolve(1), Promise.resolve(2)]);
