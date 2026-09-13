import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { RefusalBanner } from '@/components/refusal-banner';
import { SheetChrome } from '@/components/sheet-chrome';
import { channelHref, readSpeakerLinkParams, speakerStudioUrl } from '@/links/route';
import { speakerLinkCopy } from '@/screens/speaker-link-copy';
import { useColors } from '@/theme/provider';
import { type } from '@/theme/typography';

export default function SpeakerLinkSheet() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; pin: string; slug: string; code: string }>();
  const link = readSpeakerLinkParams(params.host, params.pin, params.slug, params.code);
  const copy = speakerLinkCopy(link?.host ?? '');
  const [openFailed, setOpenFailed] = useState(false);

  if (link === null) {
    return (
      <SheetChrome title={copy.refusedTitle} onDone={() => router.back()}>
        <RefusalBanner message={copy.refusedBody} />
      </SheetChrome>
    );
  }

  const openInBrowser = () => {
    setOpenFailed(false);
    // The rejection message quotes the URL, which carries the speaker code: never log it.
    Linking.openURL(speakerStudioUrl(link)).then(
      () => router.back(),
      () => setOpenFailed(true),
    );
  };

  return (
    <SheetChrome title={copy.title} onDone={() => router.back()}>
      <Text style={[type.note, { color: colors.mutedForeground }]}>{copy.body}</Text>

      {openFailed ? <RefusalBanner message={copy.openFailed} /> : null}

      <ActionButton label={copy.openAction} icon="external" onPress={openInBrowser} />
      <ActionButton
        label={copy.listenAction}
        icon="headphones"
        variant="tonal"
        onPress={() => router.replace(channelHref(link.host, link.pin, link.slug))}
      />
    </SheetChrome>
  );
}
