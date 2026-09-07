import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { readHostSegment } from '@/links/route';

export default function EventScreen() {
  const { host, pin } = useLocalSearchParams<{ host: string; pin: string }>();

  return <PlaceholderScreen name="Event" detail={`${readHostSegment(host)} · ${pin}`} />;
}
