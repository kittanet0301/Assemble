import { renderPosition } from './world.js';

// Select a known segment instead of blending positions across a turn or teleport.
export function sampleTimeline(samples, serverTime) {
  let sample = samples[0];
  let latestStart = -Infinity;
  for (const candidate of samples) {
    const startsAt = candidate.motion?.startedAt ?? candidate.serverTime;
    // A packet can arrive after a turn began. Its segment is valid from startedAt,
    // so waiting until the packet timestamp would insert a pause at every corner.
    if (startsAt <= serverTime && startsAt >= latestStart) {
      sample = candidate;
      latestStart = startsAt;
    }
  }
  if (!sample) return null;
  return {
    ...renderPosition(sample, serverTime),
    direction: sample.direction ?? 'down',
    moving:
      !!sample.motion &&
      serverTime >= sample.motion.startedAt &&
      serverTime < sample.motion.startedAt + sample.motion.durationMs,
  };
}
