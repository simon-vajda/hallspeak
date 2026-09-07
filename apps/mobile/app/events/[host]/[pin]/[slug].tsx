import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { readHostSegment } from '@/links/route';

export default function ChannelScreen() {
  const { host, pin, slug } = useLocalSearchParams<{ host: string; pin: string; slug: string }>();

  return (
    <PlaceholderScreen name="Channel" detail={`${readHostSegment(host)} · ${pin} · ${slug}`} />
  );
}
