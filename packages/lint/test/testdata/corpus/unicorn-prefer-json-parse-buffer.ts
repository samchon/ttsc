declare const buf: Buffer;
// expect: unicorn/prefer-json-parse-buffer error
const data = JSON.parse(buf.toString());
void data;
