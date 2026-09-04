import { describe, expect, it } from '@jest/globals';
import type { RememberedEvent } from '../src/venues/types';
import { buildVenueList, displayHost } from '../src/venues/venue-list';

const NOW = new Date(2026, 8, 4).getTime();

function event(overrides: Partial<RememberedEvent> = {}): RememberedEvent {
  return {
    host: 'stpauls.linguacast.app',
    pin: '481209',
    name: 'Sunday Service',
    lastConnectedAt: new Date(2026, 7, 31).getTime(),
    pinned: false,
    unavailable: false,
    ...overrides,
  };
}

describe('buildVenueList', () => {
  it('carries each record name and host onto its row', () => {
    const view = buildVenueList([event()], NOW);

    expect(view.kind).toBe('sections');
    if (view.kind !== 'sections') {
      return;
    }
    const [row] = view.sections[0]?.rows ?? [];
    expect(row?.name).toBe('Sunday Service');
    expect(row?.host).toBe('stpauls.linguacast.app');
    expect(row?.pin).toBe('481209');
    expect(row?.lastConnectedLabel).toBe('Last joined 31 August');
  });

  it('reports the empty state rather than two empty sections', () => {
    expect(buildVenueList([], NOW)).toEqual({ kind: 'empty' });
  });

  it('omits the recent section when every record is pinned', () => {
    const view = buildVenueList([event({ pinned: true })], NOW);

    if (view.kind !== 'sections') {
      throw new Error('expected sections');
    }
    expect(view.sections.map((section) => section.id)).toEqual(['pinned']);
  });

  it('omits the pinned section when no record is pinned', () => {
    const view = buildVenueList([event()], NOW);

    if (view.kind !== 'sections') {
      throw new Error('expected sections');
    }
    expect(view.sections.map((section) => section.id)).toEqual(['recent']);
  });

  it('sorts pinned records above recent ones and recent ones by last connection', () => {
    const view = buildVenueList(
      [
        event({ host: 'older.example.com', name: 'Older', lastConnectedAt: 1 }),
        event({ host: 'newer.example.com', name: 'Newer', lastConnectedAt: 2 }),
        event({ host: 'pinned.example.com', name: 'Pinned', pinned: true, lastConnectedAt: 0 }),
      ],
      NOW,
    );

    if (view.kind !== 'sections') {
      throw new Error('expected sections');
    }
    expect(view.sections.map((section) => section.rows.map((row) => row.name))).toEqual([
      ['Pinned'],
      ['Newer', 'Older'],
    ]);
  });

  it('moves a record between sections when pinned without changing its copy', () => {
    const recent = buildVenueList([event()], NOW);
    const pinned = buildVenueList([event({ pinned: true })], NOW);

    if (recent.kind !== 'sections' || pinned.kind !== 'sections') {
      throw new Error('expected sections');
    }
    const before = recent.sections[0]?.rows[0];
    const after = pinned.sections[0]?.rows[0];
    expect(recent.sections[0]?.id).toBe('recent');
    expect(pinned.sections[0]?.id).toBe('pinned');
    expect(after?.name).toBe(before?.name);
    expect(after?.host).toBe(before?.host);
    expect(after?.lastConnectedLabel).toBe(before?.lastConnectedLabel);
    expect(after?.pinned).toBe(true);
  });

  it('omits the last-connected line for a record that has never connected', () => {
    const view = buildVenueList([event({ lastConnectedAt: null })], NOW);

    if (view.kind !== 'sections') {
      throw new Error('expected sections');
    }
    expect(view.sections[0]?.rows[0]?.lastConnectedLabel).toBeNull();
  });

  it('names the year only when the last connection falls outside the current one', () => {
    const view = buildVenueList([event({ lastConnectedAt: new Date(2025, 5, 11).getTime() })], NOW);

    if (view.kind !== 'sections') {
      throw new Error('expected sections');
    }
    expect(view.sections[0]?.rows[0]?.lastConnectedLabel).toBe('Last joined 11 June 2025');
  });

  it('marks an unavailable record without dropping it from the list', () => {
    const view = buildVenueList([event({ unavailable: true })], NOW);

    if (view.kind !== 'sections') {
      throw new Error('expected sections');
    }
    const row = view.sections[0]?.rows[0];
    expect(row?.unavailable).toBe(true);
    expect(row?.unavailableLabel).toBe("Didn't open last time");
    expect(row?.name).toBe('Sunday Service');
    expect(row?.host).toBe('stpauls.linguacast.app');
  });

  it('gives every row a key unique across hosts sharing a PIN', () => {
    const view = buildVenueList(
      [event({ host: 'one.example.com' }), event({ host: 'two.example.com' })],
      NOW,
    );

    if (view.kind !== 'sections') {
      throw new Error('expected sections');
    }
    const keys = view.sections.flatMap((section) => section.rows.map((row) => row.key));
    expect(new Set(keys).size).toBe(2);
  });
});

describe('displayHost', () => {
  it('keeps a non-default port and drops the scheme', () => {
    expect(displayHost('https://linguacast.example.com:8443/events/834912')).toBe(
      'linguacast.example.com:8443',
    );
  });

  it('leaves an already bare host untouched', () => {
    expect(displayHost('tolmacs.varosmajor.hu')).toBe('tolmacs.varosmajor.hu');
  });

  it('drops a path from a stored host', () => {
    expect(displayHost('linguacast.example.com/events/834912')).toBe('linguacast.example.com');
  });
});
