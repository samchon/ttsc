
      import { message } from "./helper";
      const dynamic = await import("./dynamic");
      const interpolation = `${(await import("./dynamic")).dynamic}`;
      const ordinary = "from './helper'";
      const template = `import('./dynamic')`;
      const regex = /import\('\.\/helper'\)/;
      // from './helper'
      console.log(JSON.stringify({
        message,
        dynamic: dynamic.dynamic,
        interpolation,
        ordinary,
        template,
        regex: regex.source,
      }));
    