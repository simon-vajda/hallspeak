import { describe, expect, it } from 'vitest';
import { listenerEventUrl } from './listener-url';

describe('listenerEventUrl', () => {
  it('points at the event page on the given origin', () => {
    expect(listenerEventUrl('https://h.example', '123456')).toBe('https://h.example/events/123456');
  });

  it('keeps a port on the origin', () => {
    expect(listenerEventUrl('http://localhost:5173', '004213')).toBe(
      'http://localhost:5173/events/004213',
    );
  });

  it('carries neither a channel segment nor a speaker code', () => {
    const url = new URL(listenerEventUrl('https://h.example', '123456'));
    expect(url.pathname.split('/').filter(Boolean)).toEqual(['events', '123456']);
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
  });
});
