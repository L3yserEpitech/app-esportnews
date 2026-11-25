'use client';

import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Modal } from '@/components/ui';
import { FORMAT_PATTERN, KEY_PATTERN, type Spot } from './spots';

export function NewSpotModal({ onClose, onCreated }: { onClose: () => void; onCreated: (spot: Spot) => void }) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [format, setFormat] = useState('');
  const [placement, setPlacement] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!KEY_PATTERN.test(key)) return setError('Identifiant : 2 à 40 caractères, minuscules, chiffres et tirets.');
    if (!label.trim()) return setError("Donnez un nom à l'emplacement.");
    if (!FORMAT_PATTERN.test(format)) return setError('Format attendu : largeur x hauteur, par exemple 300x250.');
    if (!placement.trim()) return setError("Indiquez où se trouve l'emplacement sur le site.");
    setBusy(true);
    setError('');
    try {
      onCreated(await api<Spot>('/ads/spots', { body: { key, label: label.trim(), format, placement: placement.trim() } }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Nouvel emplacement" onClose={onClose}>
      <form method="post" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <p className="faible">
          À déclarer quand l&apos;équipe du site ajoute un emplacement dans une page. Il affiche la régie tant que vous ne le remplacez pas.
        </p>
        <div className="champ">
          <label htmlFor="spot-key">
            Identifiant <span>celui du code du site</span>
          </label>
          <input
            id="spot-key"
            type="text"
            className="mono"
            placeholder="article-haut"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          />
          <span className="aide">Minuscules, chiffres et tirets. Il ne pourra plus changer.</span>
        </div>
        <div className="champ">
          <label htmlFor="spot-label">Nom</label>
          <input id="spot-label" type="text" placeholder="Haut d'article" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="spot-format">
            Format <span>largeur x hauteur, en pixels</span>
          </label>
          <input
            id="spot-format"
            type="text"
            className="mono"
            placeholder="728x90"
            maxLength={9}
            value={format}
            onChange={(e) => setFormat(e.target.value.toLowerCase().replace(/\s+/g, '').replace(/[×*]/g, 'x'))}
          />
        </div>
        <div className="champ">
          <label htmlFor="spot-placement">Emplacement sur le site</label>
          <input
            id="spot-placement"
            type="text"
            placeholder="Sous le titre d'un article (ordinateur et mobile)"
            maxLength={120}
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
          />
        </div>
        {error && (
          <p className="erreur" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-p" disabled={busy}>
            Créer l&apos;emplacement
          </button>
        </div>
      </form>
    </Modal>
  );
}
