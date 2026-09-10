import { channelStatusFromHttp } from '@linguacast/client-core/channel';
import { socketMessage, useSocket } from '@linguacast/client-core/socket';
import type { components } from '@linguacast/contract/openapi';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { GuestMessage, GuestMessageAction } from '@/components/guest/guest-message';
import { ListenerRoom } from '@/components/guest/listener-room';
import { connectSocket } from '@/lib/socket';

type PublicChannelView = components['schemas']['PublicChannelView'];

export function ListenerChannel({ view }: { view: PublicChannelView }) {
  const [joinFailed, setJoinFailed] = useState(false);
  const { status, error, hasConnected, channelStatuses, socket, joinChannel, leaveChannel } =
    useSocket({ pin: view.event.pin }, connectSocket);
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
      key={slug}
      eventName={view.event.name}
      pin={view.event.pin}
      channel={view.channel}
      live={currentStatus.online}
      muted={currentStatus.muted}
      closeReason={currentStatus.reason}
      socket={socket}
      status={status}
      hasConnected={hasConnected}
      socketError={error ? socketMessage(error) : null}
    />
  );
}
