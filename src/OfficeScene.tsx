import { OFFICE_SCENE } from '../shared/office-scene.js';
import type { Snapshot } from './types';
import './office-scene.css';

type Prop = {
  id: string;
  image: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sortY: number;
  deskId?: string;
};
const objects = OFFICE_SCENE.props as Prop[];

export function OfficeScene({
  snapshot,
  onDesk,
}: {
  snapshot: Snapshot;
  onDesk: (id: string) => void;
}) {
  return (
    <>
      <img
        className="pixel-office-base"
        src={OFFICE_SCENE.base}
        width={OFFICE_SCENE.width}
        height={OFFICE_SCENE.height}
        alt=""
        draggable={false}
      />
      {objects.map((prop) => {
        const style = {
          left: prop.x,
          top: prop.y,
          width: prop.w,
          height: prop.h,
          zIndex: prop.sortY,
        };
        const image = (
          <img
            src={prop.image}
            alt=""
            draggable={false}
            style={{ width: prop.w + 2, height: prop.h + 2 }}
          />
        );
        if (!prop.deskId)
          return (
            <div
              key={prop.id}
              className="pixel-scene-prop"
              style={style}
              data-scene-object={prop.id}
              aria-hidden="true"
            >
              {image}
            </div>
          );
        const deskId = prop.deskId,
          owner = snapshot.directory.find((member) => member.seat === deskId);
        const mine = owner?.id === snapshot.selfId;
        return (
          <button
            key={prop.id}
            type="button"
            data-interactive="true"
            data-scene-object={prop.id}
            className={`pixel-scene-prop pixel-scene-desk ${mine ? 'my-desk' : ''}`}
            style={style}
            aria-label={`ที่นั่ง ${deskId}${owner ? ` ของ ${owner.name}` : ' ว่าง'}`}
            title={owner ? `${owner.name} · ที่นั่ง ${deskId}` : `เลือกที่นั่ง ${deskId}`}
            onClick={(event) => {
              event.stopPropagation();
              onDesk(deskId);
            }}
          >
            {image}
            <span className="pixel-desk-label">{owner?.name || `DESK ${deskId}`}</span>
          </button>
        );
      })}
    </>
  );
}
