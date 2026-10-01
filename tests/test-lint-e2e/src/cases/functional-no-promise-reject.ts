// expect: functional/no-promise-reject error
const rejection = Promise.reject(new Error("nope"));

JSON.stringify(rejection);
