import { createFileRoute, Link } from '@tanstack/react-router';
import { type ReactNode, useEffect, useState } from 'react';
import { z } from 'zod';
import { $api } from '@/api/client';
import { GuestMessage, GuestMessageAction } from '@/components/guest/guest-message';
import { ListenerRoom } from '@/components/guest/listener-room';
import { SpeakerStudio } from '@/components/speaker/speaker-studio';
import { channelStatusFromHttp } from '@/lib/channel-status';
import { useConnectionToast } from '@/lib/use-connection-toast';
import { useSocket } from '@/lib/use-socket';

// One route for both the studio and the listener room, branching on `speaker_code`, so the
// speaker URL degrades into valid public URLs: drop the param to listen, drop the slug to select.
const SearchSchema = z.object({ speaker_code: z.string().optional() });

export const Route = createFileRoute('/events/$pin/$slug')({
  component: ChannelPage,
  validateSearch: SearchSchema,
});

/** Maps the handshake gate's connect_error to a message. Never a 404 — see useSocket. */
function socketMessage(code: string): string {
  if (code === 'channel_busy') return 'Someone is already speaking on this channel.';
  if (code === 'client_too_old') return 'This page is out of date. Reload it.';
  return `Connection failed: ${code}`;
}

function ChannelPage() {
  const { pin, slug } = Route.useParams();
  const { speaker_code: speakerCode } = Route.useSearch();
  const [joinFailed, setJoinFailed] = useState(false);

  const { data, isPending, error } = $api.useQuery('get', '/events/{pin}/{slug}', {
    params: {
      path: { pin, slug },
      query: speakerCode ? { speaker_code: speakerCode } : {},
    },
  });

  // The channel view carries only this channel, so the desktop switcher's list comes from the
  // selector's endpoint. Enabled behind the 200 above, or a guessed PIN would cost two 404s.
  const { data: event } = $api.useQuery(
    'get',
    '/events/{pin}',
    { params: { path: { pin } } },
    { enabled: data !== undefined },
  );

  const {
    status,
    error: socketError,
    online,
    channelStatuses,
    listeners,
    socket,
    joinChannel,
    leaveChannel,
  } = useSocket(data ? (speakerCode ? { pin, speakerCode } : { pin }) : null);

  useConnectionToast(status);

  const role = data?.role;
  const httpOnline = data?.channel.online;

  // A speaker is already in its channel room from the handshake; a listener has to ask.
  useEffect(() => {
    if (!socket || status !== 'connected' || role !== 'listener' || httpOnline === undefined)
      return;
    let cancelled = false;
    setJoinFailed(false);
    void joinChannel(slug, httpOnline).catch(() => {
      if (!cancelled) setJoinFailed(true);
    });
    return () => {
      cancelled = true;
      leaveChannel(slug);
    };
  }, [socket, status, role, httpOnline, slug, joinChannel, leaveChannel]);

  if (isPending) {
    return <GuestMessage title="Opening the channel" body="One moment." />;
  }

  // The two failure classes stay separate: this one is authorization, from the GET.
  if (error?.code === 'invalid_speaker_code') {
    return (
      <GuestMessage
        title="That speaker link is out of date"
        body="Its code has been regenerated since the link was shared. Ask the organiser for the current one — or listen in without it."
      >
        <ChannelsButton pin={pin}>Listen instead</ChannelsButton>
      </GuestMessage>
    );
  }

  if (error || !data) {
    return (
      <GuestMessage
        title="No such channel"
        body="This channel may have been renamed or switched off. The event's other channels are still there."
      >
        <ChannelsButton pin={pin}>Back to channels</ChannelsButton>
      </GuestMessage>
    );
  }

  // A failed acknowledgement has no authoritative muted bit. Do not leave the HTTP
  // liveness seed looking like an eternally pending or implicitly unmuted broadcast.
  if (data.role === 'listener' && joinFailed) {
    return (
      <GuestMessage
        title="Could not join this channel"
        body="Its status could not be confirmed. Go back to the channel list and try again."
      >
        <ChannelsButton pin={pin}>Back to channels</ChannelsButton>
      </GuestMessage>
    );
  }

  const authoritativeStatus = channelStatuses[slug];
  const currentStatus = authoritativeStatus ?? channelStatusFromHttp(data.channel.online);
  const isLive = currentStatus.online;
  const muted = currentStatus.muted;
  const message = socketError ? socketMessage(socketError) : null;

  // The server only answers `speaker` to a request that carried a code, so the second half
  // narrows the optional search param rather than adding a case: it cannot be false here.
  if (data.role === 'speaker' && speakerCode !== undefined) {
    return (
      <SpeakerStudio
        eventName={data.event.name}
        pin={data.event.pin}
        channel={data.channel}
        speakerCode={speakerCode}
        listeners={listeners[slug] ?? 0}
        socket={socket}
        status={status}
        socketError={message}
        channelStatus={authoritativeStatus}
      />
    );
  }

  return (
    <ListenerRoom
      eventName={data.event.name}
      pin={data.event.pin}
      channel={data.channel}
      channels={
        event?.channels.map((channel) => ({
          ...channel,
          online: online[channel.slug] ?? channel.online,
        })) ?? []
      }
      live={isLive}
      muted={muted}
      socket={socket}
      status={status}
      socketError={message}
    />
  );
}

/** Both dead ends on this route lead back to the same place: the event's channel list. */
function ChannelsButton({ pin, children }: { pin: string; children: ReactNode }) {
  return (
    <GuestMessageAction link={<Link to="/events/$pin" params={{ pin }} />}>
      {children}
    </GuestMessageAction>
  );
}
