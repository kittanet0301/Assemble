import { useState } from 'react';
import { Check, LoaderCircle, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveAppearance } from '../shared/appearance.js';
import { defaultZepAppearance, isZepAppearance, ZEP_CATALOG } from '../shared/zep-appearance.js';
import { Avatar, WalkingAvatar } from './Avatar';
import { api } from './api';
import type { Appearance, User, ZepAppearance, ZepSlot } from './types';

const labels: Record<ZepSlot, string> = {
  skin: 'ผิว',
  face: 'ใบหน้า',
  clothes: 'เสื้อผ้า',
  hair: 'ทรงผม',
  glasses: 'แว่นตา',
  mask: 'หน้ากาก',
};
const slots: ZepSlot[] = ['hair', 'clothes', 'face', 'skin', 'glasses', 'mask'];
const pageSize = 24;
type Shape = { id: number; name: string; parts: { id: number; color: string | null }[] };
const catalog = ZEP_CATALOG as Record<ZepSlot, Shape[]>;

export function CharacterEditor({
  user,
  onSaved,
}: {
  user: User;
  onSaved: (appearance: Appearance) => void;
}) {
  const initial = resolveAppearance(user.appearance, user.id) as Appearance;
  const [saved, setSaved] = useState<Appearance>(initial);
  const [draft, setDraft] = useState<ZepAppearance>(() =>
    isZepAppearance(initial)
      ? (initial as ZepAppearance)
      : (defaultZepAppearance(user.id) as ZepAppearance),
  );
  const [slot, setSlot] = useState<ZepSlot>('hair'),
    [page, setPage] = useState(0);
  const [direction, setDirection] = useState('down'),
    [walking, setWalking] = useState(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const shapes = catalog[slot],
    pages = Math.max(1, Math.ceil(shapes.length / pageSize));
  const selected = shapes.find((shape) => shape.parts.some((part) => part.id === draft[slot]));
  const selectedColor = selected?.parts.find((part) => part.id === draft[slot])?.color;
  const choose = (id: number) => {
    setDraft((old) => ({ ...old, [slot]: id }));
    setNotice('');
  };
  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ appearance: ZepAppearance }>('/api/me/appearance', {
        appearance: draft,
      });
      setSaved(result.appearance);
      setDraft(result.appearance);
      onSaved(result.appearance);
      setNotice('บันทึกตัวละครแล้ว ทุกคนจะเห็นหน้าตาใหม่นี้');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="character-editor" aria-label="ปรับแต่งตัวละคร">
      <div className="character-editor-heading">
        <div>
          <h3>ปรับแต่งตัวละคร</h3>
          <p>เลือกใบหน้า ทรงผม และชุดในแบบคุณ</p>
        </div>
        <Avatar appearance={draft} size={48} />
      </div>
      <div className="character-editor-layout">
        <div className="character-preview">
          <span className="preview-label">ตัวอย่างของคุณ</span>
          <div className="character-stage">
            <WalkingAvatar appearance={draft} direction={direction} moving={walking} />
          </div>
          <div className="direction-controls" aria-label="ทิศทางตัวอย่าง">
            {[
              ['left', '←', 'ซ้าย'],
              ['up', '↑', 'หลัง'],
              ['down', '↓', 'หน้า'],
              ['right', '→', 'ขวา'],
            ].map(([id, arrow, name]) => (
              <button
                key={id}
                type="button"
                aria-label={`มองด้าน${name}`}
                aria-pressed={direction === id}
                onClick={() => setDirection(id)}
              >
                {arrow}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="preview-motion"
            aria-pressed={walking}
            onClick={() => setWalking(!walking)}
          >
            {walking ? 'หยุดเดิน' : 'ลองเดิน'}
          </button>
        </div>
        <div className="character-options">
          <div className="zep-category-tabs" aria-label="หมวดตัวละคร">
            {slots
              .filter((key) => catalog[key].length)
              .map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={labels[key]}
                  aria-pressed={slot === key}
                  onClick={() => {
                    setSlot(key);
                    setPage(0);
                  }}
                >
                  {labels[key]} <small aria-hidden="true">{catalog[key].length}</small>
                </button>
              ))}
          </div>
          <fieldset disabled={busy}>
            <legend>{labels[slot]}</legend>
            {(slot === 'glasses' || slot === 'mask') && (
              <button
                type="button"
                className="appearance-option zep-none"
                aria-pressed={draft[slot] === 0}
                onClick={() => choose(0)}
              >
                ไม่ใส่
              </button>
            )}
            <div className="zep-shape-grid">
              {shapes.slice(page * pageSize, (page + 1) * pageSize).map((shape) => {
                const chosen = shape.parts.some((part) => part.id === draft[slot]);
                const matchingColor =
                  selectedColor &&
                  shape.parts.find(
                    (part) => part.color?.toLowerCase() === selectedColor.toLowerCase(),
                  );
                const preview = chosen ? draft[slot] : (matchingColor || shape.parts[0]).id;
                const name = `${labels[slot]} ${shapes.indexOf(shape) + 1}`;
                return (
                  <button
                    type="button"
                    key={shape.id}
                    className="zep-shape"
                    aria-label={name}
                    aria-pressed={chosen}
                    onClick={() => choose(preview)}
                  >
                    <WalkingAvatar appearance={{ ...draft, [slot]: preview }} />
                    <span>{name}</span>
                    {chosen && <Check size={13} className="zep-selected" />}
                  </button>
                );
              })}
            </div>
            {pages > 1 && (
              <div className="zep-pagination">
                <button
                  type="button"
                  aria-label="ตัวเลือกหน้าก่อน"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  หน้า {page + 1} / {pages}
                </span>
                <button
                  type="button"
                  aria-label="ตัวเลือกหน้าถัดไป"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            {!!selected && selected.parts.length > 1 && (
              <div className="zep-colors">
                <span>สี{labels[slot]}</span>
                <div className="appearance-choices">
                  {selected.parts.map((part, i) => (
                    <button
                      type="button"
                      key={part.id}
                      className="appearance-option color-swatch"
                      style={{ backgroundColor: part.color ?? '#ddd' }}
                      aria-label={`สี${labels[slot]} ${i + 1}`}
                      aria-pressed={draft[slot] === part.id}
                      onClick={() => choose(part.id)}
                    >
                      {draft[slot] === part.id && <Check size={17} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="character-save-status" role="status">
        {notice ||
          (changed
            ? 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก'
            : 'หน้าตานี้ใช้กับตัวเดินและรูปโปรไฟล์ของคุณ')}
      </p>
      <div className="character-actions">
        <button
          className="secondary"
          type="button"
          disabled={!changed || busy}
          onClick={() => {
            setDraft(
              isZepAppearance(saved)
                ? (saved as ZepAppearance)
                : (defaultZepAppearance(user.id) as ZepAppearance),
            );
            setError('');
            setNotice('');
          }}
        >
          <RotateCcw size={15} />
          {isZepAppearance(saved) ? 'คืนค่าที่บันทึก' : 'คืนค่าเริ่มต้น'}
        </button>
        <button type="button" className="primary" disabled={!changed || busy} onClick={save}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}บันทึกตัวละคร
        </button>
      </div>
    </section>
  );
}
