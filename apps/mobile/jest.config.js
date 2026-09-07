const preset = require('jest-expo/jest-preset');

// jest-expo's own pattern already admits pnpm's `.pnpm/<name>@<version>` segment so the
// package name after it decides. This is that list plus `lucide-react-native`, which is
// otherwise left untransformed.
const ALLOWED = [
  '.pnpm',
  'react-native',
  '@react-native',
  '@react-native-community',
  'expo',
  '@expo',
  '@expo-google-fonts',
  'react-navigation',
  '@react-navigation',
  'lucide-react-native',
].join('|');

module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
  transform: {
    ...preset.transform,
    // lucide-react-native resolves to `.mjs` under the `react-native` condition, and the
    // preset's transform keys stop at `.tsx`, so nothing would compile those files.
    '\\.mjs$': preset.transform['\\.[jt]sx?$'],
  },
  transformIgnorePatterns: [
    `/node_modules/(?!(${ALLOWED}))`,
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
