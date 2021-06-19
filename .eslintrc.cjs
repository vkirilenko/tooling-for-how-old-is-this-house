module.exports = {
  extends: ["@kachkaev/eslint-config-react"],
  rules: {
    "import/no-default-export": "error",
  },
  overrides: [
    {
      files: ["**/*.cjs"],
      env: { node: true },
    },
    {
      files: ["src/commands/**"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["src/pages/**"],
      rules: {
        "import/no-default-export": "off",
      },
    },
  ],
};
