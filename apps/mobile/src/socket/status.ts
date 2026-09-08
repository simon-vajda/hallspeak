import { type ChannelStatus, channelStatusFromHttp } from '@linguacast/client-core/channel';

/**
 * The status to render a channel by: what the socket has read on this connection, or the
 * REST reading as a seed until it speaks. A socket that has spoken is never overridden by
 * the fetch, and a socket that dropped keeps what it last said — a lost connection is not
 * an offline channel.
 */
export function currentChannelStatus(
  authoritative: ChannelStatus | undefined,
  httpOnline: boolean | undefined,
): ChannelStatus | undefined {
  if (authoritative) {
    return authoritative;
  }

  return httpOnline === undefined ? undefined : channelStatusFromHttp(httpOnline);
}
