/**
 * The public event payload carries a channel's on-air flag but not when it went live, so the
 * elapsed figure the Channel screen shows has no real source. Delete this module and read the
 * real start time once the socket carries one — nothing else on that screen is invented.
 */
export const FIXTURE_ELAPSED_LABEL = 'on air for 12 minutes';
