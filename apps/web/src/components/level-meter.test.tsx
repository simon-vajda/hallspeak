import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LevelMeter } from './level-meter';

describe('LevelMeter', () => {
  it('renders the live and peaking fill tones when unmuted', () => {
    const markup = renderToStaticMarkup(<LevelMeter analyser={null} />);

    expect(markup).toContain(
      'class="h-full w-0 rounded-full bg-live group-data-[peaking=true]:bg-destructive"',
    );
  });

  it('renders only the neutral fill tone when muted', () => {
    const markup = renderToStaticMarkup(<LevelMeter analyser={null} muted />);

    expect(markup).toContain('class="h-full w-0 rounded-full bg-muted-foreground"');
    expect(markup).not.toContain('bg-live');
    expect(markup).not.toContain('group-data-[peaking=true]:bg-destructive');
  });

  it('positions the threshold tick from the shared peak threshold', () => {
    const markup = renderToStaticMarkup(<LevelMeter analyser={null} />);

    expect(markup).toContain('style="left:95%"');
  });
});
