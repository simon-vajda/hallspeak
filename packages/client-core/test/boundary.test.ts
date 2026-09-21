import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The package is the platform-free tier: what it holds must compile for a browser, for
// React Native, and for a bare Node test alike. Modelled on
// docs/solutions/architecture-patterns/guard-a-layer-boundary-with-a-self-testing-import-scan.md
const FORBIDDEN_PACKAGES = [
  /^react-native$/,
  /^react-native\//,
  /^@react-native\//,
  /^react-native-/,
  /^expo$/,
  /^expo-/,
  /^expo\//,
  /^@expo\//,
  /^mediasoup-client$/,
  /^mediasoup-client\//,
];

// Written out rather than matched loosely: `navigator` as a property name or a local
// binding is not a platform reference, and only a bare read of the global is.
const FORBIDDEN_GLOBALS = ['window', 'document', 'navigator', 'localStorage'];

const SRC_ROOT = path.resolve(import.meta.dirname, '..', 'src');

function stripComments(source: string): string {
  return source.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const SPECIFIER =
  /^\s*import\s*['"]([^'"]+)['"]|^\s*(?:import|export)\b[^;'"()=]*?\bfrom\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

function specifiersOf(source: string): string[] {
  return [...stripComments(source).matchAll(SPECIFIER)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '',
  );
}

function forbiddenImport(specifier: string): string | undefined {
  return FORBIDDEN_PACKAGES.some((p) => p.test(specifier))
    ? 'imports a platform package'
    : undefined;
}

/**
 * A bare global read: not preceded by a dot, a `?.`, or the property-name colon of an
 * object literal, and not immediately followed by a colon that would make it a key.
 */
function forbiddenGlobals(source: string): string[] {
  const stripped = stripComments(source);
  return FORBIDDEN_GLOBALS.filter((name) =>
    new RegExp(String.raw`(?<![.\w$?]\s*)\b${name}\b(?!\s*[:\w])`).test(stripped),
  );
}

describe('client-core imports no platform', () => {
  const files = readdirSync(SRC_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

  it('finds files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(SRC_ROOT, file), file]))('%s', (name, file) => {
    const source = readFileSync(file, 'utf8');

    for (const specifier of specifiersOf(source)) {
      const violation = forbiddenImport(specifier);

      expect(violation, `src/${name} ${violation}: '${specifier}'`).toBeUndefined();
    }

    expect(forbiddenGlobals(source), `src/${name} reads a platform global`).toEqual([]);
  });
});

// Without these, an edit that broke the matcher outright would leave every file passing.
describe('the guard itself', () => {
  it.each([
    ["import { RTCPeerConnection } from 'react-native-webrtc';", 'react-native-webrtc'],
    ["import { AppState } from 'react-native';", 'react-native'],
    ["import * as SQLite from 'expo-sqlite/kv-store';", 'expo-sqlite/kv-store'],
    ["import { Host } from '@expo/ui/swift-ui';", '@expo/ui/swift-ui'],
    ["import { Device } from 'mediasoup-client';", 'mediasoup-client'],
    ["const rn = require('react-native');", 'react-native'],
    ["export const x = () => import('expo-camera');", 'expo-camera'],
  ])('rejects %j', (source, specifier) => {
    expect(specifiersOf(source)).toContain(specifier);
    expect(forbiddenImport(specifier)).toBeDefined();
  });

  it.each([
    ["import { io } from 'socket.io-client';", 'socket.io-client'],
    ["import { useEffect } from 'react';", 'react'],
    ["import { unwrap } from '@hallspeak/contract/socket';", '@hallspeak/contract/socket'],
    ["import { gradeStats } from './stats';", './stats'],
  ])('allows %j', (source, specifier) => {
    expect(specifiersOf(source)).toContain(specifier);
    expect(forbiddenImport(specifier)).toBeUndefined();
  });

  it.each([
    'const w = window.innerWidth;',
    'document.title = title;',
    'if (navigator.mediaDevices) {}',
    'localStorage.getItem(key);',
  ])('rejects the global in %j', (source) => {
    expect(forbiddenGlobals(source)).not.toEqual([]);
  });

  it.each(['const opts = { window: 5 };', 'return state.window + 1;', 'element?.document;'])(
    'allows %j',
    (source) => {
      expect(forbiddenGlobals(source)).toEqual([]);
    },
  );
});
