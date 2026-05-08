const o = {
  a: 1,
  // expect: no-dupe-keys error
  a: 2,
};
JSON.stringify(o);
