// expect: noControlRegex error
const r = /\x1f/;
JSON.stringify(r);
