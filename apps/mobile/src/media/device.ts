import type { BuiltinHandlerName } from 'mediasoup-client/types';

/**
 * Named rather than detected: mediasoup-client's own detection reads a browser user agent
 * and does not reliably identify React Native. The annotation is the check — the name
 * changed across the library's 3.13 line, and a stale one fails at runtime with no compile
 * error, so `pnpm typecheck` is what catches a version that renamed it.
 */
export const HANDLER_NAME: BuiltinHandlerName = 'ReactNative106';
