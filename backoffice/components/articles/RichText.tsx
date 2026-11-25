'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Image as ImageIcon, Link as LinkIcon, List, ListOrdered, Quote, Twitter, Video } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { num } from '@/lib/format';
import { Modal, Toggle, useToast } from '@/components/ui';
import { articleExtensions, countWords, extractTweetId, readingMinutes } from './extensions';

const VIDEO_OPTIONS = [
  { key: 'muted', label: 'Muet' },
  { key: 'autoplay', label: 'Lecture automatique' },
  { key: 'loop', label: 'En boucle' },
  { key: 'controls', label: 'Afficher les contrôles' },
] as const;

type VideoOptions = Record<(typeof VIDEO_OPTIONS)[number]['key'], boolean>;

const DEFAULT_VIDEO: VideoOptions = { muted: false, autoplay: false, loop: false, controls: true };

function normalizeHref(raw: string): string {
  const value = raw.trim();
  if (!value || /^(https?:|mailto:|tel:|\/|#)/i.test(value)) return value;
  return `https://${value}`;
}

// The body of an article: formatting toolbar and Tiptap document. `initial` is
// read once; remount (change `key`) to load another document.
export function RichText({
  initial,
  editable,
  slug,
  onReady,
  onChange,
}: {
  initial: string;
  editable: boolean;
  slug: string;
  // The document as the editor writes it back before any edit: stored HTML
  // rarely comes out byte for byte.
  onReady: (html: string) => void;
  onChange: (html: string) => void;
}) {
  const toast = useToast();
  const extensions = useMemo(() => articleExtensions('Rédigez votre article ici…'), []);
  const [words, setWords] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [video, setVideo] = useState<{ url: string; options: VideoOptions } | null>(null);
  const [tweetOpen, setTweetOpen] = useState(false);
  const [tweetUrl, setTweetUrl] = useState('');
  const [tweetError, setTweetError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const handlers = useRef({ onReady, onChange });
  handlers.current = { onReady, onChange };
  const editorProps = useMemo(
    () => ({ attributes: { class: 'corps', role: 'textbox', 'aria-multiline': 'true', 'aria-label': "Contenu de l'article" } }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initial,
    editable,
    editorProps,
    onCreate: ({ editor: created }) => {
      setWords(countWords(created.getText()));
      handlers.current.onReady(created.getHTML());
    },
    onUpdate: ({ editor: updated }) => {
      setWords(countWords(updated.getText()));
      handlers.current.onChange(updated.getHTML());
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            h2: current.isActive('heading', { level: 2 }),
            h3: current.isActive('heading', { level: 3 }),
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            link: current.isActive('link'),
            quote: current.isActive('blockquote'),
            bullets: current.isActive('bulletList'),
            numbers: current.isActive('orderedList'),
          }
        : null,
  });

  const upload = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('slug', slug);
      const res = await api<{ url: string }>('/upload/article-content', { form });
      return res.url;
    } catch (e) {
      toast.fail(errorMessage(e));
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onImage = async (file: File | undefined) => {
    if (!file || !editor) return;
    const url = await upload(file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const onVideo = async (file: File | undefined) => {
    if (!file) return;
    const url = await upload(file);
    if (url) setVideo({ url, options: DEFAULT_VIDEO });
  };

  const insertVideo = () => {
    if (!video || !editor) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: 'customVideo', attrs: { src: video.url, ...video.options } })
      .run();
    setVideo(null);
  };

  const openLink = () => {
    if (!editor) return;
    setLinkUrl((editor.getAttributes('link').href as string | undefined) || '');
    setLinkOpen(true);
  };

  const applyLink = (e: FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const href = normalizeHref(linkUrl);
    const chain = editor.chain().focus().extendMarkRange('link');
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    setLinkOpen(false);
  };

  const insertTweet = (e: FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      setTweetError('Adresse invalide. Collez un lien twitter.com ou x.com, ou le numéro du tweet.');
      return;
    }
    editor.chain().focus().insertContent({ type: 'twitterEmbed', attrs: { tweetId } }).run();
    setTweetOpen(false);
  };

  const off = !editor || !editable;
  const minutes = readingMinutes(words);

  return (
    <div className="carte">
      <div className="outil" role="toolbar" aria-label="Mise en forme">
        <button
          type="button"
          aria-label="Titre de section"
          aria-pressed={Boolean(active?.h2)}
          className={active?.h2 ? 'on' : ''}
          disabled={off}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          aria-label="Sous-titre"
          aria-pressed={Boolean(active?.h3)}
          className={active?.h3 ? 'on' : ''}
          disabled={off}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>
        <span className="sep" />
        <button
          type="button"
          aria-label="Gras"
          aria-pressed={Boolean(active?.bold)}
          className={active?.bold ? 'on' : ''}
          style={{ fontWeight: 800 }}
          disabled={off}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          type="button"
          aria-label="Italique"
          aria-pressed={Boolean(active?.italic)}
          className={active?.italic ? 'on' : ''}
          style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
          disabled={off}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button type="button" aria-label="Lien" aria-pressed={Boolean(active?.link)} className={active?.link ? 'on' : ''} disabled={off} onClick={openLink}>
          <LinkIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Citation"
          aria-pressed={Boolean(active?.quote)}
          className={active?.quote ? 'on' : ''}
          disabled={off}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote aria-hidden="true" />
        </button>
        <span className="sep" />
        <button type="button" aria-label="Image" disabled={off || uploading} onClick={() => imageInput.current?.click()}>
          <ImageIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Vidéo" disabled={off || uploading} onClick={() => videoInput.current?.click()}>
          <Video aria-hidden="true" />
        </button>
        <span className="sep" />
        <button
          type="button"
          aria-label="Liste à puces"
          aria-pressed={Boolean(active?.bullets)}
          className={active?.bullets ? 'on' : ''}
          disabled={off}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Liste numérotée"
          aria-pressed={Boolean(active?.numbers)}
          className={active?.numbers ? 'on' : ''}
          disabled={off}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Intégrer un tweet"
          disabled={off}
          onClick={() => {
            setTweetUrl('');
            setTweetError('');
            setTweetOpen(true);
          }}
        >
          <Twitter aria-hidden="true" />
        </button>
        <span className="faible" style={{ marginLeft: 'auto', fontSize: 12, paddingRight: 6 }} aria-live="off">
          {uploading
            ? 'Envoi du fichier…'
            : `${num(words)} ${words > 1 ? 'mots' : 'mot'}${minutes ? ` · ${num(minutes)} min de lecture` : ''}`}
        </span>
      </div>
      <EditorContent editor={editor} />
      <input
        ref={imageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        hidden
        onChange={(e) => {
          void onImage(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(e) => {
          void onVideo(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {linkOpen && (
        <Modal title="Lien" onClose={() => setLinkOpen(false)}>
          <form onSubmit={applyLink} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="champ">
              <label htmlFor="rt-link">Adresse</label>
              <input id="rt-link" type="text" inputMode="url" placeholder="https://" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
              <span className="aide">Laissez vide pour retirer le lien. Le lien s&apos;ouvre dans un nouvel onglet sur le site.</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-s" onClick={() => setLinkOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-p">
                {linkUrl.trim() ? 'Appliquer' : 'Retirer le lien'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {video && (
        <Modal
          title="Réglages de la vidéo"
          onClose={() => setVideo(null)}
          footer={
            <>
              <button type="button" className="btn btn-s" onClick={() => setVideo(null)}>
                Annuler
              </button>
              <button type="button" className="btn btn-p" onClick={insertVideo}>
                Insérer la vidéo
              </button>
            </>
          }
        >
          <video
            src={video.url}
            controls={video.options.controls}
            muted={video.options.muted}
            loop={video.options.loop}
            style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: 240 }}
          />
          {VIDEO_OPTIONS.map((option) => (
            <div key={option.key} className="ligne">
              <span>{option.label}</span>
              <Toggle
                label={option.label}
                checked={video.options[option.key]}
                onChange={(next) => setVideo({ url: video.url, options: { ...video.options, [option.key]: next } })}
              />
            </div>
          ))}
        </Modal>
      )}

      {tweetOpen && (
        <Modal title="Intégrer un tweet" onClose={() => setTweetOpen(false)}>
          <form onSubmit={insertTweet} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="champ">
              <label htmlFor="rt-tweet">Adresse du tweet ou numéro</label>
              <input
                id="rt-tweet"
                type="text"
                placeholder="https://x.com/…/status/…"
                value={tweetUrl}
                onChange={(e) => {
                  setTweetUrl(e.target.value);
                  setTweetError('');
                }}
              />
              {tweetError && (
                <span className="erreur" role="alert">
                  {tweetError}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-s" onClick={() => setTweetOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-p">
                Insérer le tweet
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
