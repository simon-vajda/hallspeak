// `roots` reaches the workspace root because pnpm keeps every real package under
// `<repo>/node_modules/.pnpm`, outside this package's tree. Without it, jest-runtime
// refuses the first hoisted import with "outside of the scope of the test code".
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>', '<rootDir>/../..'],
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
  // A pnpm path is `node_modules/.pnpm/<name>@<version>/node_modules/<name>/…`, so the
  // stock pattern matches at the first segment and nothing under the store is ever
  // transpiled — a failure that reads as a syntax error inside a dependency. Admitting
  // `.pnpm` lets the second segment decide, which is the name the pattern is about.
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm|(?:jest-)?react-native|@react-native|expo|@expo|react-navigation|@react-navigation|@linguacast)',
  ],
};
