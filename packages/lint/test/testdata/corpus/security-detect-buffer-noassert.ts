
const buffer = Buffer.alloc(8);
buffer.readDoubleLE(0, false);
// expect: security/detect-buffer-noassert error
buffer.readDoubleLE(0, true);
