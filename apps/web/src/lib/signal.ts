import { createSignalSocket } from '@/signal/socket';
import { CLIENT_VERSION } from '@/version';

/**
 * The app's single socket. Lives in lib/ rather than signal/ because it binds the
 * portable factory to this build's version — signal/ must stay free of that.
 */
export const socket = createSignalSocket({ clientVersion: CLIENT_VERSION });
