// expect: unicorn/no-single-promise-in-promise-methods error
const p = Promise.all([Promise.resolve(1)]);
