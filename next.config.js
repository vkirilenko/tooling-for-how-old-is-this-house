const fs = require("fs");
const Path = require("path");

let wrotePackageJson = false;

module.exports = {
  redirects: () => [
    {
      source: "/",
      destination: "/poster",
      permanent: false,
    },
  ],
  // https://github.com/vercel/next.js/issues/24334#issuecomment-848260358
  webpack: (defaultConfig, opts) => {
    if (!wrotePackageJson) {
      fs.mkdirSync(Path.join(opts.dir, ".next"), { recursive: true });
      fs.writeFileSync(
        Path.join(opts.dir, ".next/package.json"),
        '{ "type": "commonjs" } ',
      );
      wrotePackageJson = true;
    }

    return defaultConfig;
  },
};
