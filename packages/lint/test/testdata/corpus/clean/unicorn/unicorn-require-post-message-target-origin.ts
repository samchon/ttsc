// @ttsc-corpus-clean: unicorn/require-post-message-target-origin
declare const win: Window; win.postMessage({ kind: "ping" }, "https://example.com");
