// expect: no-empty-interface error
interface Empty {}
const e: Empty = {};
JSON.stringify(e);
