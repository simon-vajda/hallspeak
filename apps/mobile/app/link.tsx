import { Host, TextInput } from '@expo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { Icon } from '@/components/icon';
import { SheetChrome } from '@/components/sheet-chrome';
import { parseListenerLink } from '@/links/parse';
import { channelHref, eventHref } from '@/links/route';
import { refusalMessage } from '@/screens/scanner-state';
import { SEED_COLOR, useColors, useTheme } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function LinkEntrySheet() {
  const colors = useColors();
  const { scheme } = useTheme();
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
      <Host
        matchContents={{ vertical: true }}
        colorScheme={scheme}
        seedColor={SEED_COLOR}
        style={[styles.field, { borderColor: colors.input }]}
      >
        <TextInput
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onChangeText={(next) => {
            setValue(next);
            setRefusal(null);
          }}
          onSubmitEditing={submit}
        />
      </Host>

      {refusal ? (
        <View style={[styles.refusal, { backgroundColor: colors.destructiveMuted }]}>
          <Icon name="warn" size={16} color={colors.destructive} />
          <Text style={[type.note, styles.refusalText, { color: colors.destructive }]}>
            {refusal}
          </Text>
        </View>
      ) : null}

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
  refusal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
  },
  refusalText: { flex: 1 },
});
