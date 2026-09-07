import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { NativeTextInput } from '@/components/native-controls';
import { RefusalBanner } from '@/components/refusal-banner';
import { SheetChrome } from '@/components/sheet-chrome';
import { parseListenerLink } from '@/links/parse';
import { channelHref, eventHref } from '@/links/route';
import { refusalMessage } from '@/screens/scanner-state';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function LinkEntrySheet() {
  const colors = useColors();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);

  const submit = () => {
    const parsed = parseListenerLink(value);

    if (!parsed.ok) {
      setRefusal(refusalMessage(parsed.reason));
      return;
    }

    const { host, pin, slug } = parsed.destination;

    router.replace(slug ? channelHref(host, pin, slug) : eventHref(host, pin));
  };

  return (
    <SheetChrome title="Enter the link" onDone={() => router.back()}>
      <Text style={[type.note, { color: colors.mutedForeground }]}>
        Paste the link from your venue. It is checked on this phone; nothing is sent until it is a
        LinguaCast event.
      </Text>

      {/* The universal TextInput is driven by native observable state rather than React's
          controlled-input model, so `value` is a starting value and onChangeText is the
          source of truth. */}
      <NativeTextInput
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        style={{ ...styles.field, borderColor: colors.input }}
        onChangeText={(next) => {
          setValue(next);
          setRefusal(null);
        }}
        onSubmitEditing={submit}
      />

      {refusal ? <RefusalBanner message={refusal} /> : null}

      <ActionButton label="Open event" icon="forward" onPress={submit} />
    </SheetChrome>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: spacing.pill,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
