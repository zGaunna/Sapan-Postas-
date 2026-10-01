import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "work/evidence/**", "work/backup-*/**",
    "work/probe-*", "work/browser-playtest.js"] },
  {
    files: ["*.js", "*.mjs", "work/*.cjs"],
    plugins: { "@stylistic": stylistic },
    languageOptions: { ecmaVersion: "latest" },
    rules: {
      ...js.configs.recommended.rules,
      // Callback signatures intentionally retain arguments used by alternate callers.
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/no-tabs": "error",
      "@stylistic/no-trailing-spaces": "error",
      "@stylistic/eol-last": ["error", "always"]
    }
  },
  {
    files: ["*.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser,
      CourierRig: "readonly", MotionFX: "readonly", HarborWorld: "readonly",
      HarborSocial: "readonly", VoyageLog: "readonly", HarborMap: "readonly",
      LevelData: "readonly", SapanGame: "readonly" } }
  },
  { files: ["*.mjs", "work/*.cjs"], languageOptions: { globals: globals.node } },
  // Existing test tools use both quote styles; keep their formatting intact.
  { files: ["work/*.cjs"], languageOptions: { sourceType: "commonjs" },
    rules: { "@stylistic/quotes": "off" } },
  // page.evaluate callbacks execute in the browser, inside otherwise Node-based tools.
  { files: ["work/browser-*-check.cjs"], languageOptions: { globals: {
    ...globals.browser, __playtest: "readonly", CourierRig: "readonly",
    HarborSocial: "readonly", VoyageLog: "readonly", SapanGame: "readonly"
  } } },
  // Pin the four existing unused bindings rather than hiding new unused variables.
  { files: ["game.js"], rules: { "no-unused-vars": ["error", {
    args: "none", caughtErrors: "none", varsIgnorePattern: "^(skyline|stars)$"
  }] } },
  { files: ["work/browser-motion-check.cjs"], rules: { "no-unused-vars": ["error", {
    args: "none", caughtErrors: "none", varsIgnorePattern: "^p$"
  }] } },
  { files: ["work/check-progression.cjs"], rules: { "no-unused-vars": ["error", {
    args: "none", caughtErrors: "none", varsIgnorePattern: "^vm$"
  }] } }
];
