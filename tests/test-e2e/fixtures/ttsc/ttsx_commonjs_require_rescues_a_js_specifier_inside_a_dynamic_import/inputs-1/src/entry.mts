
          void (async () => {
            const loaded = await import("./config.js");
            console.log(JSON.stringify(loaded.default));
          })();
        