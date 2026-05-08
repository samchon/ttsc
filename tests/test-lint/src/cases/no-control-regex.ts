// expect: no-control-regex error
const r = /\x1f/;
JSON.stringify(r);
