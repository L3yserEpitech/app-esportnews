'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { Upload } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Modal } from '@/components/ui';
import { acceptFor, refusal, uploadWithProgress } from '@/components/media/upload';
import { SpotPreview } from './SpotPreview';
import {
  fromLocalInput,
  isHttpsUrl,
  parseFormat,
  SLOT_PATTERN,
  toLocalInput,
  type MediaType,
  type Spot,
  type SpotMode,
} from './spots';

const MODES: { value: SpotMode; label: string; help: string }[] = [
  { value: 'adsense', label: 'Régie Google · défaut', help: 'Le site affiche les annonces de la régie.' },
  { value: 'custom', label: 'Bannière personnalisée', help: 'Votre visuel et votre lien remplacent la régie.' },
  {
    value: 'off',
    label: 'Masqué',
    help: "L'emplacement n'affiche rien. La colonne droite disparaît du site si ses trois emplacements sont masqués.",
  },
];

const AD_KINDS = ['image', 'video'];

export function SpotEditor({ spot, onClose, onSaved }: { spot: Spot; onClose: () => void; onSaved: (saved: Spot) => void }) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<SpotMode>(spot.mode);
  const [mediaUrl, setMediaUrl] = useState(spot.media_url);
  const [mediaType, setMediaType] = useState<MediaType>(spot.media_type);
  const [title, setTitle] = useState(spot.title);
  const [link, setLink] = useState(spot.redirect_link);
  const [starts, setStarts] = useState(toLocalInput(spot.starts_at));
  const [ends, setEnds] = useState(toLocalInput(spot.ends_at));
  const [slot, setSlot] = useState(spot.adsense_slot);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { width, height } = parseFormat(spot.format);
  const wide = width / height >= 2;
  const uploading = progress !== null;

  const send = async (file: File) => {
    const reason = refusal(file, AD_KINDS);
    if (reason) {
      setError(reason);
      return;
    }
    setError('');
    setProgress(0);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await uploadWithProgress<{ url: string; media_type: MediaType }>('/upload/ad', form, setProgress);
      setMediaUrl(res.url);
      setMediaType(res.media_type);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  const check = (): string => {
    if (slot && !SLOT_PATTERN.test(slot)) return "L'identifiant du bloc AdSense ne contient que des chiffres.";
    if (mediaUrl && !isHttpsUrl(mediaUrl)) return "L'adresse du visuel doit commencer par https://";
    if (link && !isHttpsUrl(link)) return 'Le lien de redirection doit être une adresse complète en https://';
    if (mode === 'custom') {
      if (!mediaUrl) return 'Ajoutez le visuel de la bannière.';
      if (!link) return 'Indiquez le lien de redirection.';
    }
    if (starts && ends && new Date(ends).getTime() <= new Date(starts).getTime()) return 'La date de fin doit suivre la date de début.';
    return '';
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = check();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api<Spot>(`/ads/spots/${spot.key}`, {
        method: 'PUT',
        body: {
          mode,
          adsense_slot: slot.trim(),
          title: title.trim(),
          media_url: mediaUrl.trim(),
          media_type: mediaType,
          redirect_link: link.trim(),
          starts_at: fromLocalInput(starts),
          ends_at: fromLocalInput(ends),
        },
      });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={spot.label} onClose={onClose} wide>
      <form method="post" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <p className="faible" style={{ marginTop: -8 }}>
          <span className="mono">{spot.key}</span> · {width} × {height} · {spot.placement}
        </p>

        <fieldset className="pub-modes">
          <legend className="lab">Affichage</legend>
          {MODES.map((m) => (
            <label key={m.value} className={`pub-choix ${mode === m.value ? 'on' : ''}`}>
              <input type="radio" name={`${id}-mode`} checked={mode === m.value} onChange={() => setMode(m.value)} />
              <span>
                <b style={{ fontWeight: 500 }}>{m.label}</b>
                <span className="sous">{m.help}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === 'custom' && (
          <div className={`pub-edition ${wide ? 'large' : ''}`}>
            <div className="pub-edition-visuel">
              <SpotPreview
                format={spot.format}
                show={mediaUrl ? 'custom' : 'adsense'}
                mediaUrl={mediaUrl}
                mediaType={mediaType}
                title={title}
                maxWidth={wide ? 520 : 200}
                maxHeight={wide ? 160 : 266}
              />
              <input
                ref={fileRef}
                type="file"
                hidden
                accept={acceptFor(AD_KINDS)}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void send(file);
                }}
              />
              <button type="button" className="btn btn-s" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden="true" />
                {mediaUrl ? 'Remplacer le visuel' : 'Choisir un visuel'}
              </button>
              {uploading && (
                <div className="med-progres" role="progressbar" aria-label="Envoi du visuel" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                  <i style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
              <span className="aide" style={{ textAlign: 'center' }}>
                JPG, PNG, WebP, GIF ou MP4, 10 Mo au plus. Affiché en {width} × {height}, recadré au centre comme ci-dessus.
              </span>
            </div>

            <div className="pub-edition-champs">
              <div className="champ">
                <label htmlFor={`${id}-title`}>
                  Titre <span>lu par les lecteurs d&apos;écran</span>
                </label>
                <input id={`${id}-title`} type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="champ">
                <label htmlFor={`${id}-link`}>Lien de redirection</label>
                <input
                  id={`${id}-link`}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
                <span className="aide">S&apos;ouvre dans un nouvel onglet au clic sur la bannière.</span>
              </div>
              <div className="pub-dates">
                <div className="champ">
                  <label htmlFor={`${id}-starts`}>
                    Début <span>optionnel</span>
                  </label>
                  <input id={`${id}-starts`} type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
                </div>
                <div className="champ">
                  <label htmlFor={`${id}-ends`}>
                    Fin <span>optionnelle</span>
                  </label>
                  <input id={`${id}-ends`} type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
                </div>
              </div>
              <span className="aide">Hors de cette période, l&apos;emplacement revient tout seul à la régie.</span>
            </div>
          </div>
        )}

        <details className="pub-avance">
          <summary>Avancé</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
            <div className="champ">
              <label htmlFor={`${id}-slot`}>Identifiant du bloc AdSense</label>
              <input
                id={`${id}-slot`}
                type="text"
                inputMode="numeric"
                className="mono"
                placeholder="1234567890"
                value={slot}
                onChange={(e) => setSlot(e.target.value.trim())}
              />
              <span className="aide">Vide : le site utilise son bloc par défaut pour cet emplacement.</span>
            </div>
            {mode === 'custom' && (
              <div className="champ">
                <label htmlFor={`${id}-media`}>Adresse du visuel</label>
                <input
                  id={`${id}-media`}
                  type="url"
                  inputMode="url"
                  className="mono"
                  placeholder="https://"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value.trim())}
                />
                <div className="pub-types" role="radiogroup" aria-label="Type du visuel">
                  {(['image', 'video'] as MediaType[]).map((t) => (
                    <label key={t}>
                      <input type="radio" name={`${id}-type`} checked={mediaType === t} onChange={() => setMediaType(t)} />
                      {t === 'image' ? 'Image' : 'Vidéo'}
                    </label>
                  ))}
                </div>
                <span className="aide">Remplie par l&apos;envoi d&apos;un fichier. À modifier seulement pour un visuel déjà en ligne.</span>
              </div>
            )}
          </div>
        </details>

        {error && (
          <p className="erreur" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-p" disabled={busy || uploading}>
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}
