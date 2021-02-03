module.exports = {
  root: true,
  env: {
    node: true
    // Adds all ECMAScript 2020 globals and automatically sets the ecmaVersion parser option to 11.
    // es2020: true,
  },
  extends: [
    "plugin:vue/recommended",
    "@vue/standard",
    "@vue/typescript/recommended"
  ],
  rules: {
    quotes: ["error", "double"],
    semi: ["error", "always"],
    "@typescript-eslint/camelcase": "off",
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-unused-expressions": "off",
    "@typescript-eslint/no-unused-expressions": "error"
  }
};
