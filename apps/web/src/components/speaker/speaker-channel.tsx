import { useSocket } from '@linguacast/client-core/socket';
import type { components } from '@linguacast/contract/openapi';
import { useState } from 'react';
import { SpeakerStudio } from '@/components/speaker/speaker-studio';
import { connectSocket } from '@/lib/socket';

type PublicChannelView = components['schemas']['PublicChannelView'];

export function SpeakerChannel({
  view,
  speakerCode,
}: {
  view: PublicChannelView;
  speakerCode: string;
}) {
  // Generated once per mounted studio and held in memory only, so it identifies this page
  // rather than a person and survives every Socket.IO reconnect, which replays the auth
  // payload verbatim. A reload or a second tab is deliberately a different studio.
  const [studioSession] = useState(() => crypto.randomUUID());
  const {
    status,
    hasConnected,
    channelStatuses,
    listeners,
    reports,
    reportResolutions,
    reportsKnown,
    socket,
  } = useSocket(
    {
      pin: view.event.pin,
      speakerCode,
      studioSession,
    },
    connectSocket,
  );
  return (
    <SpeakerStudio
      eventName={view.event.name}
      pin={view.event.pin}
      channel={view.channel}
      speakerCode={speakerCode}
      listeners={listeners[view.channel.slug] ?? 0}
      reports={reports[view.channel.slug] ?? []}
      reportResolution={reportResolutions[view.channel.slug] ?? null}
      reportsKnown={reportsKnown}
      socket={socket}
      status={status}
      hasConnected={hasConnected}
      channelStatus={channelStatuses[view.channel.slug]}
    />
  );
}
