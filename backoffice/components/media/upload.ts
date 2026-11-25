import { BACKEND_URL, ApiError, uploadTicket } from '@/lib/api';

// Mirrors utils.MaxFileSize and utils.AllowedFileTypes of the backend, to
// refuse a file before sending it.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif';
export const VIDEO_ACCEPT = '.mp4';

export type MediaKind = 'image' | 'video' | 'other';

export function kindOfName(name: string): MediaKind {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (IMAGE_ACCEPT.split(',').includes(ext)) return 'image';
  if (VIDEO_ACCEPT.split(',').includes(ext)) return 'video';
  return 'other';
}

export function acceptFor(kinds: string[]): string {
  return [kinds.includes('image') ? IMAGE_ACCEPT : '', kinds.includes('video') ? VIDEO_ACCEPT : ''].filter(Boolean).join(',');
}

// Why a file can't go to a folder taking these kinds, or '' when it can.
export function refusal(file: File, kinds: string[]): string {
  const kind = kindOfName(file.name);
  if (kind === 'other') return 'Format non accepté : JPG, PNG, WebP, GIF ou MP4';
  if (!kinds.includes(kind)) return kind === 'video' ? 'Ce dossier ne reçoit pas de vidéo' : "Ce dossier ne reçoit pas d'image";
  if (file.size > MAX_UPLOAD_BYTES) return 'Fichier trop lourd : 10 Mo au plus';
  return '';
}

// fetch() can't report upload progress: this one goes through XMLHttpRequest.
// Files go straight to the backend with an upload ticket (see lib/api.ts).
export async function uploadWithProgress<T>(path: string, form: FormData, onProgress: (ratio: number) => void): Promise<T> {
  const ticket = await uploadTicket();
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BACKEND_URL}/api/bo${path}`);
    xhr.setRequestHeader('Authorization', `Upload ${ticket}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Serveur injoignable. Vérifiez votre connexion.'));
    xhr.onload = () => {
      let data: { error?: string; code?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Not JSON: the status decides.
      }
      if (xhr.status >= 200 && xhr.status < 300 && data) {
        resolve(data as T);
        return;
      }
      const fallback = xhr.status === 413 ? 'Fichier trop lourd pour le serveur.' : "L'envoi a échoué.";
      reject(new ApiError(xhr.status, data?.code || `http_${xhr.status}`, data?.error || fallback));
    };
    xhr.send(form);
  });
}
