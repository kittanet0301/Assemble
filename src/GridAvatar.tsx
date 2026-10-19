import { useEffect, useLayoutEffect, useRef } from 'react';
import { STATUSES } from '../shared/world.js';
import { sampleTimeline } from '../shared/motion.js';
import { WalkingAvatar } from './Avatar';
import type { Peer } from './types';
import { spriteRow, walkFrame } from '../shared/sprites.js';

type Sample = Peer & { serverTime: number; receivedAt: number };
export function GridAvatar({
  peer,
  serverTime,
  isMe,
  focused,
  reaction,
}: {
  peer: Peer;
  serverTime: number;
  isMe: boolean;
  focused: boolean;
  reaction?: string;
}) {
  const node = useRef<HTMLDivElement>(null),
    history = useRef<Sample[]>([]);
  const initialPosition = useRef({ x: peer.x, y: peer.y });
  useLayoutEffect(() => {
    const sample = { ...peer, serverTime, receivedAt: performance.now() };
    if (history.current.at(-1)?.serverTime === serverTime)
      history.current[history.current.length - 1] = sample;
    else history.current.push(sample);
    if (history.current.length > 16) history.current.shift();
  }, [peer, serverTime]);
  useEffect(() => {
    let frame = 0;
    const draw = (now: number) => {
      const latest = history.current.at(-1);
      if (latest && node.current) {
        // Buffer one network interval. Rendering stays continuous at screen refresh rate.
        const position = sampleTimeline(
          history.current,
          latest.serverTime + now - latest.receivedAt - 80,
        );
        if (position) {
          node.current.style.transform = `translate3d(${position.x}px,${position.y}px,0) translate(-50%,-90%)`;
          node.current.style.zIndex = String(Math.round(position.y));
          node.current.classList.toggle('is-stepping', position.moving);
          node.current.style.setProperty('--map-row', String(spriteRow(position.direction)));
          node.current.style.setProperty(
            '--sprite-col',
            String(position.moving ? walkFrame(now) : 0),
          );
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      ref={node}
      className={`map-person ${isMe ? 'is-me' : ''} ${focused ? 'is-focused' : ''}`}
      data-grid-x={peer.x}
      data-grid-y={peer.y}
      data-player-id={peer.id}
      style={{
        transform: `translate3d(${initialPosition.current.x}px,${initialPosition.current.y}px,0) translate(-50%,-90%)`,
        zIndex: Math.round(initialPosition.current.y),
      }}
    >
      {reaction && <div className="floating-reaction">{reaction}</div>}
      <div className="person-name">
        <i style={{ background: STATUSES[peer.status]?.color }} />
        {peer.name}
        {isMe && <span>คุณ</span>}
      </div>
      <WalkingAvatar appearance={peer.appearance} seed={peer.id} direction={peer.direction} />
      {peer.status === 'focus' && <span className="person-status">🎧</span>}
    </div>
  );
}
