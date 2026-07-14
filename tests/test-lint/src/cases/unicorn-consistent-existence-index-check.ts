const arr = [1, 2, 3];
declare const collection: {
  findLastIndex(predicate: (value: number) => boolean): number;
};

const missing = arr.indexOf(2);
// expect: unicorn/consistent-existence-index-check error
void (missing < 0);

const present = arr.indexOf(2);
// expect: unicorn/consistent-existence-index-check error
void (present >= 0);

const last = arr.lastIndexOf(2);
// expect: unicorn/consistent-existence-index-check error
void (last > -1);

const matched = arr.findIndex((value) => value > 1);
// expect: unicorn/consistent-existence-index-check error
void (matched < 0);

const matchedLast = collection.findLastIndex((value) => value > 1);
// expect: unicorn/consistent-existence-index-check error
void (matchedLast >= 0);

// Upstream-valid forms: the sentinel comparison itself, an index that is not
// `const`, and a call that never binds an index variable.
const canonical = arr.indexOf(2);
void (canonical === -1);
void (canonical !== -1);

let mutable = arr.indexOf(2);
void (mutable < 0);
mutable = 0;

void (arr.indexOf(2) < 0);
void (arr.indexOf(2) >= 0);
