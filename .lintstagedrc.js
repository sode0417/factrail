const path = require('path');

module.exports = {
  'apps/api/**/*.ts': (files) => {
    const filePaths = files.map(file => file.replace(/\\/g, '/')).join(' ');
    const commands = [];

    // ESLint
    commands.push(`npx eslint --config apps/api/.eslintrc.js ${filePaths} --fix`);

    // Prettier
    commands.push(`npx prettier --config apps/api/.prettierrc --write ${filePaths}`);

    return commands;
  },
  'apps/web/**/*.{ts,tsx}': (files) => {
    const filePaths = files.map(file => file.replace(/\\/g, '/')).join(' ');

    // ESLint
    return [`npx eslint --config apps/web/eslint.config.mjs ${filePaths}`];
  }
};
