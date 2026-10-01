
        export {};
        const query = await import("./helper.js?query");
        const hash = await import("./helper.js#hash");
        console.log(JSON.stringify({
          query: new URL(query.href).search,
          hash: new URL(hash.href).hash,
        }));
      