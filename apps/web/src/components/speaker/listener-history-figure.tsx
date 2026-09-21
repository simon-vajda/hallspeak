import type { ListenerChartRow } from '@hallspeak/client-core/channel';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  listenerChartDomain,
  listenerChartTicks,
  listenerPeak,
  listenerPointLabel,
  listenerTickLabel,
} from './listener-history-chart';

const CHART_CONFIG = {
  count: { label: 'Listeners', color: 'var(--primary)' },
} satisfies ChartConfig;

/**
 * Split from the panel so `recharts` lands in its own chunk. The studio and every guest
 * channel page are one route, so a static import would put the charting library on the page
 * every listener loads.
 */
export default function ListenerHistoryFigure({
  rows,
  now,
}: {
  rows: ListenerChartRow[];
  now: number;
}) {
  return (
    <ChartContainer
      aria-hidden
      config={CHART_CONFIG}
      className="aspect-auto h-full w-full [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground"
    >
      {/* The edge ticks are centred on the axis ends, so the margins are what keep
          `60m ago` and `now` from being cut off. */}
      <LineChart data={rows} margin={{ top: 4, right: 22, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="at"
          type="number"
          scale="time"
          domain={listenerChartDomain(now)}
          ticks={listenerChartTicks(now)}
          tickFormatter={(value: number) => listenerTickLabel(value, now)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={0}
        />
        <YAxis
          dataKey="count"
          allowDecimals={false}
          domain={[0, Math.max(1, listenerPeak(rows))]}
          width={26}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              hideIndicator
              formatter={(value, _name, item) =>
                listenerPointLabel(Number(value), Number(item?.payload?.at ?? now))
              }
            />
          }
        />
        <Line
          dataKey="count"
          type="stepAfter"
          stroke="var(--color-count)"
          strokeWidth={2}
          dot={false}
          // The clock moves the right edge every tick; an animation would replay the
          // whole line each time instead of extending it.
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
