import type { components } from '@linguacast/contract/openapi';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { GuestMessage, GuestMessageAction } from '@/components/guest/guest-message';
import { ListenerRoom } from '@/components/guest/listener-room';
import { channelStatusFromHttp } from '@/lib/channel-status';
import { publicEventQueryOptions } from '@/lib/public-queries';
import { socketMessage } from '@/lib/socket-message';
import { useConnectionToast } from '@/lib/use-connection-toast';
import { useSocket } from '@/lib/use-socket';

type PublicChannelView = components['schemas']['PublicChannelView'];

export function ListenerChannel({ view }: { view: PublicChannelView }) {
  const [joinFailed, setJoinFailed] = useState(false);
  const { data: event } = useSuspenseQuery(publicEventQueryOptions(view.event.pin));
  const { status, error, online, channelStatuses, socket, joinChannel, leaveChannel } = useSocket({
    pin: view.event.pin,
  });
  useConnectionToast(status);

  const slug = view.channel.slug;

  // A speaker is already in its channel room from the handshake; a listener has to ask.
  useEffect(() => {
    if (!socket || status !== 'connected') {
      return;
    }
    let cancelled = false;
    setJoinFailed(false);
    void joinChannel(slug, view.channel.online).catch(() => {
      if (!cancelled) {
        setJoinFailed(true);
      }
    });
    return () => {
      cancelled = true;
      leaveChannel(slug);
    };
  }, [socket, status, slug, view.channel.online, joinChannel, leaveChannel]);

  if (joinFailed) {
    return (
      <GuestMessage
        title="Could not join this channel"
        body="Its status could not be confirmed. Go back to the channel list and try again."
      >
        <GuestMessageAction link={<Link to="/events/$pin" params={{ pin: view.event.pin }} />}>
          Back to channels
        </GuestMessageAction>
      </GuestMessage>
    );
  }

  const authoritativeStatus = channelStatuses[slug];
  const currentStatus = authoritativeStatus ?? channelStatusFromHttp(view.channel.online);

  return (
    <ListenerRoom
      eventName={view.event.name}
      pin={view.event.pin}
      channel={view.channel}
      channels={event.channels.map((channel) => ({
        ...channel,
        online: online[channel.slug] ?? channel.online,
      }))}
      live={currentStatus.online}
      muted={currentStatus.muted}
      socket={socket}
      status={status}
      socketError={error ? socketMessage(error) : null}
    />
  );
}
