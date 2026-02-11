const path = require('path');

module.exports = {
  'apps/api/**/*.ts': (files) => {
    const filePaths = files.map(file => file.replace(/\\/g, '/')).join(' ');
    const commands = [];

    // ESLint (apps/api のローカルESLintを使用)
    commands.push(`npx --prefix apps/api eslint --config apps/api/.eslintrc.js ${filePaths} --fix`);

    // Prettier
    commands.push(`npx prettier --config apps/api/.prettierrc --write ${filePaths}`);

    return commands;
  },
  'apps/web/**/*.{ts,tsx}': (files) => {
    const filePaths = files.map(file => file.replace(/\\/g, '/')).join(' ');

    // ESLint (apps/web のローカルESLintを使用)
    return [`npx --prefix apps/web eslint --config apps/web/eslint.config.mjs ${filePaths}`];
  }
};
