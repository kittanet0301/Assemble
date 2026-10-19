import { useEffect, useRef, useState } from 'react';
import { Focus, Minus, Plus, Navigation2, Coffee, LockKeyhole, Grid2X2 } from 'lucide-react';
import { WORLD, ROOMS, canStand, snapToGrid } from '../shared/world.js';
import { GridAvatar } from './GridAvatar';
import { OfficeScene } from './OfficeScene';
import type { Snapshot, Send } from './types';
export function OfficeMap({
  snapshot,
  send,
  zoom,
  setZoom,
  focusedId,
  onDesk,
  onRoom,
  reactions,
}: {
  snapshot: Snapshot;
  send: Send;
  zoom: number;
  setZoom: (n: number) => void;
  focusedId: string | null;
  onDesk: (id: string) => void;
  onRoom: (id: string) => void;
  reactions: Record<string, string>;
}) {
  const stage = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ w: 900, h: 700 }),
    [marker, setMarker] = useState<{ x: number; y: number } | null>(null),
    [showGrid, setShowGrid] = useState(false);
  const currentZoom = useRef(zoom);
  currentZoom.current = zoom;
  const me = snapshot.peers.find((p) => p.id === snapshot.selfId),
    focus = snapshot.peers.find((p) => p.id === focusedId);
  useEffect(() => {
    if (!stage.current) return;
    const obs = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    obs.observe(stage.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      currentZoom.current = Math.max(
        0.75,
        Math.min(2.25, currentZoom.current * Math.exp(-delta * 0.0015)),
      );
      setZoom(currentZoom.current);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [setZoom]);
  const fit = Math.min((size.w - 44) / WORLD.width, (size.h - 40) / WORLD.height),
    scale = Math.max(0.25, fit * zoom);
  const offsetX =
    focusedId && focus && zoom > 1.25
      ? Math.min(40, Math.max(size.w - WORLD.width * scale - 40, size.w / 2 - focus.x * scale))
      : (size.w - WORLD.width * scale) / 2;
  const offsetY =
    focusedId && focus && zoom > 1.25
      ? Math.min(40, Math.max(size.h - WORLD.height * scale - 40, size.h / 2 - focus.y * scale))
      : (size.h - WORLD.height * scale) / 2 - 4;
  useEffect(() => {
    const pressed = new Set<string>();
    // Physical codes keep WASD working with Thai and other keyboard layouts.
    const movementKey = (e: KeyboardEvent) =>
      ({
        KeyW: 'w',
        KeyA: 'a',
        KeyS: 's',
        KeyD: 'd',
        ArrowUp: 'arrowup',
        ArrowDown: 'arrowdown',
        ArrowLeft: 'arrowleft',
        ArrowRight: 'arrowright',
      })[e.code] ?? e.key.toLowerCase();
    const direction = () => {
      const held = (arrow: string, letter: string) =>
        Number(pressed.has(arrow) || pressed.has(letter));
      return {
        dx: held('arrowright', 'd') - held('arrowleft', 'a'),
        dy: held('arrowdown', 's') - held('arrowup', 'w'),
      };
    };
    const blocked = (e: KeyboardEvent) =>
      (e.target as HTMLElement)?.closest(
        'input,textarea,select,[contenteditable],dialog,[role="dialog"]',
      );
    const down = (e: KeyboardEvent) => {
      const key = movementKey(e);
      if (
        blocked(e) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        !['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)
      )
        return;
      e.preventDefault();
      pressed.add(key);
      send({ type: 'move', ...direction() });
    };
    const up = (e: KeyboardEvent) => {
      const key = movementKey(e);
      if (!pressed.has(key)) return;
      pressed.delete(key);
      send({ type: 'move', ...direction() });
    };
    const clear = () => {
      pressed.clear();
      send({ type: 'move', dx: 0, dy: 0 });
    };
    const interval = window.setInterval(() => {
      if (pressed.size) send({ type: 'move', ...direction() });
    }, 120);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [send]);
  useEffect(() => {
    if (!marker) return;
    const timer = window.setTimeout(() => setMarker(null), 1500);
    return () => clearTimeout(timer);
  }, [marker]);
  return (
    <div
      className="map-stage"
      ref={stage}
      aria-label="แผนผังสำนักงาน คลิกพื้นเพื่อเดิน หรือใช้ปุ่มลูกศรและ WASD"
    >
      <div className="map-corner">
        <span className="live-dot" /> พื้นที่ของทีม <span>·</span> ชั้น 01
      </div>
      <div
        className="office-world"
        style={{
          width: WORLD.width,
          height: WORLD.height,
          transform: `translate(${offsetX}px,${offsetY}px) scale(${scale})`,
        }}
        onClick={(e) => {
          if ((e.target as Element).closest('[data-interactive]') || me?.role === 'guest') return;
          const bounds = e.currentTarget.getBoundingClientRect(),
            point = snapToGrid({
              x: (e.clientX - bounds.left) / scale,
              y: (e.clientY - bounds.top) / scale,
            });
          if (canStand(point.x, point.y)) {
            setMarker(point);
            send({ type: 'walk', ...point });
          }
        }}
      >
        <OfficeScene snapshot={snapshot} onDesk={onDesk} />
        {showGrid && (
          <div
            className="pixel-map-grid"
            style={{
              left: WORLD.bounds.x,
              top: WORLD.bounds.y,
              width: WORLD.bounds.w,
              height: WORLD.bounds.h,
              backgroundSize: `${WORLD.step}px ${WORLD.step}px`,
            }}
            aria-hidden="true"
          />
        )}
        {ROOMS.map((r) => {
          const info = snapshot.rooms.find((room) => room.id === r.id);
          return (
            <button
              key={r.id}
              data-interactive="true"
              className="room-map-label"
              style={{ left: r.x + r.w / 2, top: r.y + 14 }}
              onClick={() => onRoom(r.id)}
            >
              <span className={info?.count ? 'live-dot' : 'empty-dot'} />
              {r.name}
              <span className="room-counter">
                {info?.count ?? 0}/{info?.capacity ?? 8}
              </span>
              {me?.role === 'guest' && me.roomId !== r.id && <LockKeyhole size={12} />}
            </button>
          );
        })}
        {marker && (
          <div
            className="walk-marker grid-target"
            style={{ left: marker.x, top: marker.y, width: WORLD.step, height: WORLD.step }}
          >
            <Navigation2 size={15} />
          </div>
        )}
        {snapshot.peers.map((p) => (
          <GridAvatar
            key={p.id}
            peer={p}
            serverTime={snapshot.serverTime}
            isMe={p.id === snapshot.selfId}
            focused={focusedId === p.id}
            reaction={reactions[p.id]}
          />
        ))}
      </div>
      <div className="map-legend">
        <Coffee size={14} />
        <span>ระยะทางไกล แต่ทีมยังใกล้กัน</span>
      </div>
      <div className="zoom-controls">
        <button
          aria-label="แสดงกริดช่องเดิน"
          aria-pressed={showGrid}
          title="แสดงกริดช่องเดิน"
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid2X2 size={16} />
        </button>
        <i />
        <button aria-label="ซูมออก" onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}>
          <Minus size={16} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button aria-label="ซูมเข้า" onClick={() => setZoom(Math.min(2.25, zoom + 0.25))}>
          <Plus size={16} />
        </button>
        <i />
        <button aria-label="แสดงแผนที่ทั้งหมด" onClick={() => setZoom(1)}>
          <Focus size={17} />
        </button>
      </div>
    </div>
  );
}
