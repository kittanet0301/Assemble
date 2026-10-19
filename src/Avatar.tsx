import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { resolveAppearance } from '../shared/appearance.js';
import type { Appearance } from './types';
import { SPRITE, spriteRow, walkFrame } from '../shared/sprites.js';
import { isZepAppearance } from '../shared/zep-appearance.js';
import { characterSheet } from './characterSheets';

function useSheet(value?: Appearance, seed = '', native = false) {
  const appearance = resolveAppearance(value, seed) as Appearance;
  const key = JSON.stringify([appearance, native]),
    [sheet, setSheet] = useState(''),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setError(false);
    setSheet('');
    characterSheet(appearance, native)
      .then((url) => {
        if (active) setSheet(url);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  return { sheet, error, zep: isZepAppearance(appearance) };
}
type Props = { size?: number; seed?: string; className?: string; appearance?: Appearance };
export function Avatar({ size = 38, seed = '', className = '', appearance }: Props) {
  const { sheet, error, zep } = useSheet(appearance, seed);
  return (
    <span
      className={`pixel-portrait ${zep ? 'zep-sheet' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      title={error ? 'โหลดภาพตัวละครไม่สำเร็จ' : undefined}
    >
      {sheet && (
        <span
          style={{
            width: 48,
            height: 48,
            backgroundImage: `url(${sheet})`,
            transform: `scale(${size / 48})`,
          }}
        />
      )}
    </span>
  );
}
export function WalkingAvatar({
  seed = '',
  moving = false,
  appearance,
  direction = 'down',
  size = 64,
  detail = 'native',
}: Props & { moving?: boolean; direction?: string; detail?: 'native' | 'hd' }) {
  const node = useRef<HTMLSpanElement>(null);
  const { sheet, error, zep } = useSheet(appearance, seed, detail === 'native');
  const row = spriteRow(direction);
  useEffect(() => {
    if (!moving) {
      node.current?.style.removeProperty('--sprite-col');
      return;
    }
    // Functional walk frames remain visible when decorative CSS animations
    // are disabled. This also powers the user's explicit walking preview.
    let frame = 0;
    const start = performance.now();
    const draw = (now: number) => {
      node.current?.style.setProperty('--sprite-col', String(walkFrame(now - start)));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      node.current?.style.removeProperty('--sprite-col');
    };
  }, [moving]);
  return (
    <span
      ref={node}
      className={`walking-avatar pixel-walker ${zep ? 'zep-sheet' : ''} ${moving ? 'preview-walking' : ''}`}
      aria-hidden="true"
      title={error ? 'โหลดภาพตัวละครไม่สำเร็จ' : undefined}
      style={
        {
          width: SPRITE.frameWidth,
          height: SPRITE.frameHeight,
          backgroundImage: sheet ? `url(${sheet})` : undefined,
          '--sprite-row': row,
          transform: size === 64 ? undefined : `scale(${size / 64})`,
        } as CSSProperties
      }
    />
  );
}
