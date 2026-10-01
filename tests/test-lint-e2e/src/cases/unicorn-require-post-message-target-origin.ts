declare const win: Window;
// expect: unicorn/require-post-message-target-origin error
win.postMessage({ kind: "ping" });
