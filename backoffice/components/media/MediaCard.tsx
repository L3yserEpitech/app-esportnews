'use client';

import { Copy, File as FileIcon, Film } from 'lucide-react';
import { bytes, day } from '@/lib/format';
import { Menu } from '@/components/ui';
import type { MediaKind } from './upload';

export interface MediaItem {
  key: string;
  url: string;
  size: number;
  last_modified: string;
  kind: MediaKind;
}

export const fileName = (key: string) => key.slice(key.lastIndexOf('/') + 1);

export function MediaCard({
  item,
  fresh,
  onCopy,
  onDelete,
}: {
  item: MediaItem;
  fresh?: boolean;
  onCopy: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
}) {
  const name = fileName(item.key);
  return (
    <li className="med-carte">
      <a className="med-vignette" href={item.url} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${name} dans un nouvel onglet`}>
        {item.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" loading="lazy" decoding="async" />
        ) : item.kind === 'video' ? (
          <Film aria-hidden="true" />
        ) : (
          <FileIcon aria-hidden="true" />
        )}
        {fresh && <span className="chip vert med-neuf">Ajouté</span>}
      </a>
      <div className="med-pied">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="med-nom mono" title={name}>
            {name}
          </span>
          <span className="sous">
            {item.kind === 'video' ? 'Vidéo · ' : ''}
            {bytes(item.size)} · {day(item.last_modified)}
          </span>
        </div>
        <button type="button" className="ico-btn" aria-label={`Copier l'adresse de ${name}`} title="Copier l'adresse" onClick={() => onCopy(item)}>
          <Copy />
        </button>
        {onDelete && (
          <Menu label={`Actions pour ${name}`}>
            {(close) => (
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  close();
                  onDelete(item);
                }}
              >
                Supprimer
              </button>
            )}
          </Menu>
        )}
      </div>
    </li>
  );
}
