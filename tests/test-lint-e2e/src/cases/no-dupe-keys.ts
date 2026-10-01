const o = {
  a: 1,
  // expect: no-dupe-keys error
  a: 2,
};
JSON.stringify(o);

declare function key(): string;

const computed = {
  a: 1,
  // expect: no-dupe-keys error
  ["a"]: 2,
  [key()]: 3,
  [key()]: 4,
};
JSON.stringify(computed);
