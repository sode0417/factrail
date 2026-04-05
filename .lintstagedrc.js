const path = require('path');

module.exports = {
  'apps/api/**/*.ts': (files) => {
    const filePaths = files.map(file => file.replace(/\\/g, '/')).join(' ');
    const commands = [];

    // ESLint (apps/api のローカルESLintを使用)
    commands.push(`pnpm -C apps/api exec eslint --config .eslintrc.js ${filePaths} --fix`);

    // Prettier (apps/api の prettier を使用)
    commands.push(`pnpm -C apps/api exec prettier --config .prettierrc --write ${filePaths}`);

    return commands;
  },
  'apps/web/**/*.{ts,tsx}': (files) => {
    const filePaths = files.map(file => file.replace(/\\/g, '/')).join(' ');

    // ESLint (apps/web のローカルESLintを使用)
    return [`pnpm -C apps/web exec eslint --config eslint.config.mjs ${filePaths}`];
  }
};
