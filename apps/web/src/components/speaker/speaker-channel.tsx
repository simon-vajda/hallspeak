import type { components } from '@linguacast/contract/openapi';
import { SpeakerStudio } from '@/components/speaker/speaker-studio';
import { useConnectionToast } from '@/lib/use-connection-toast';
import { useSocket } from '@/lib/use-socket';

type PublicChannelView = components['schemas']['PublicChannelView'];

export function SpeakerChannel({
  view,
  speakerCode,
}: {
  view: PublicChannelView;
  speakerCode: string;
}) {
  const { status, hasConnected, channelStatuses, listeners, socket } = useSocket({
    pin: view.event.pin,
    speakerCode,
  });
  useConnectionToast(status);

  return (
    <SpeakerStudio
      eventName={view.event.name}
      pin={view.event.pin}
      channel={view.channel}
      speakerCode={speakerCode}
      listeners={listeners[view.channel.slug] ?? 0}
      socket={socket}
      status={status}
      hasConnected={hasConnected}
      channelStatus={channelStatuses[view.channel.slug]}
    />
  );
}
