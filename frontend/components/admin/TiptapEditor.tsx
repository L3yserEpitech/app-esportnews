"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Node } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Video as VideoIcon,
  Twitter as TwitterIcon,
} from "lucide-react";
import { adminService } from "@/lib/adminService";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

// Custom Video Node Extension
const CustomVideo = Node.create({
  name: 'customVideo',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      muted: {
        default: false,
      },
      autoplay: {
        default: false,
      },
      loop: {
        default: false,
      },
      controls: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', {
      ...HTMLAttributes,
      class: 'max-w-full h-auto rounded-lg my-4',
    }];
  },

  addCommands() {
    return {
      setVideo: (options: { src: string; muted?: boolean; autoplay?: boolean; loop?: boolean; controls?: boolean }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    } as any;
  },
});

// Custom Twitter Embed Node Extension
const TwitterEmbed = Node.create({
  name: 'twitterEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      tweetId: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-tweet-id]',
        getAttrs: (dom: HTMLElement) => ({ tweetId: dom.getAttribute('data-tweet-id') }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', {
      'data-tweet-id': HTMLAttributes.tweetId,
      class: 'twitter-embed-placeholder',
    }];
  },

  addCommands() {
    return {
      setTwitterEmbed: (tweetId: string) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: { tweetId },
        });
      },
    } as any;
  },
});

// Extrait l'ID d'un tweet depuis une URL ou un ID brut
function extractTweetId(input: string): string | null {
  const trimmed = input.trim();
  // ID brut numérique (10-20 chiffres)
  if (/^\d{10,20}$/.test(trimmed)) return trimmed;
  // URL twitter.com ou x.com
  const match = trimmed.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d{10,20})/);
  return match ? match[1] : null;
}

export function TiptapEditor({ content, onChange, placeholder }: TiptapEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [videoOptions, setVideoOptions] = useState({
    muted: false,
    autoplay: false,
    loop: false,
    controls: true,
  });
  const [twitterDialogOpen, setTwitterDialogOpen] = useState(false);
  const [tweetUrl, setTweetUrl] = useState('');
  const [tweetUrlError, setTweetUrlError] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[#F22E62] underline",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg my-4",
        },
      }),
      CustomVideo,
      TwitterEmbed,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Placeholder.configure({
        placeholder: placeholder || "Commencez à écrire...",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[300px] p-4 text-white [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-5 [&_h3]:mb-3 [&_p]:text-white [&_p]:text-base [&_strong]:font-bold [&_strong]:text-white [&_em]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-[#F22E62] [&_blockquote]:pl-4 [&_blockquote]:text-gray-300 [&_a]:text-[#F22E62] [&_a]:underline [&_img]:rounded-lg [&_img]:my-4",
      },
    },
  });

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = prompt("URL du lien:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const { url } = await adminService.uploadContentImage(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch (error) {
        console.error("Error uploading image:", error);
        alert("Erreur lors de l'upload de l'image");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const addVideo = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const { url } = await adminService.uploadContentImage(file); // Réutilise la même fonction d'upload
        setUploadedVideoUrl(url);
        setVideoDialogOpen(true);
      } catch (error) {
        console.error("Error uploading video:", error);
        alert("Erreur lors de l'upload de la vidéo");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const insertVideo = () => {
    if (!uploadedVideoUrl) return;

    (editor.chain().focus() as unknown as { setVideo: (options: { src: string; muted: boolean; autoplay: boolean; loop: boolean; controls: boolean }) => { run: () => void } }).setVideo({
      src: uploadedVideoUrl,
      muted: videoOptions.muted,
      autoplay: videoOptions.autoplay,
      loop: videoOptions.loop,
      controls: videoOptions.controls,
    }).run();

    // Reset state
    setVideoDialogOpen(false);
    setUploadedVideoUrl(null);
    setVideoOptions({
      muted: false,
      autoplay: false,
      loop: false,
      controls: true,
    });
  };

  return (
    <div className="border border-[#182859] rounded-lg bg-[#060B13]">
      {/* Toolbar */}
      <div className="border-b border-[#182859] bg-[#091626] p-2 flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive("heading", { level: 2 }) ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive("heading", { level: 3 }) ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-[#182859] mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={editor.isActive({ textAlign: 'left' }) ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={editor.isActive({ textAlign: 'center' }) ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={editor.isActive({ textAlign: 'right' }) ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={editor.isActive({ textAlign: 'justify' }) ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-[#182859] mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <Italic className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-[#182859] mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? "bg-[#182859] text-white" : "text-gray-300 hover:text-white hover:bg-[#182859]/50"}
        >
          <Quote className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-[#182859] mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addLink}
          className="text-gray-300 hover:text-white hover:bg-[#182859]/50"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addImage}
          disabled={uploading}
          className="text-gray-300 hover:text-white hover:bg-[#182859]/50"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addVideo}
          disabled={uploading}
          className="text-gray-300 hover:text-white hover:bg-[#182859]/50"
        >
          <VideoIcon className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setTweetUrl(''); setTweetUrlError(''); setTwitterDialogOpen(true); }}
          className="text-gray-300 hover:text-white hover:bg-[#182859]/50"
          title="Intégrer un tweet"
        >
          <TwitterIcon className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-[#182859] mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="text-gray-300 hover:text-white hover:bg-[#182859]/50 disabled:opacity-30"
        >
          <Undo className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="text-gray-300 hover:text-white hover:bg-[#182859]/50 disabled:opacity-30"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Video Configuration Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="bg-[#091626] border-[#182859]">
          <DialogHeader>
            <DialogTitle className="text-white">Configuration de la vidéo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {uploadedVideoUrl && (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-[#182859] mb-4">
                <video
                  src={uploadedVideoUrl}
                  className="w-full h-full"
                  controls={videoOptions.controls}
                  muted={videoOptions.muted}
                  autoPlay={videoOptions.autoplay}
                  loop={videoOptions.loop}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="muted" className="text-gray-300">Muet</Label>
              <Switch
                id="muted"
                checked={videoOptions.muted}
                onCheckedChange={(checked) =>
                  setVideoOptions({ ...videoOptions, muted: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoplay" className="text-gray-300">Lecture automatique</Label>
              <Switch
                id="autoplay"
                checked={videoOptions.autoplay}
                onCheckedChange={(checked) =>
                  setVideoOptions({ ...videoOptions, autoplay: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="loop" className="text-gray-300">En boucle</Label>
              <Switch
                id="loop"
                checked={videoOptions.loop}
                onCheckedChange={(checked) =>
                  setVideoOptions({ ...videoOptions, loop: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="controls" className="text-gray-300">Afficher les contrôles</Label>
              <Switch
                id="controls"
                checked={videoOptions.controls}
                onCheckedChange={(checked) =>
                  setVideoOptions({ ...videoOptions, controls: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVideoDialogOpen(false)}
              className="border-[#182859] text-white hover:bg-[#182859]"
            >
              Annuler
            </Button>
            <Button
              onClick={insertVideo}
              className="bg-[#F22E62] hover:bg-[#F22E62]/80"
            >
              Insérer la vidéo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Twitter Embed Dialog */}
      <Dialog open={twitterDialogOpen} onOpenChange={setTwitterDialogOpen}>
        <DialogContent className="bg-[#091626] border-[#182859]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <TwitterIcon className="h-4 w-4" />
              Intégrer un tweet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="tweet-url" className="text-gray-300">
              URL du tweet ou ID
            </Label>
            <Input
              id="tweet-url"
              value={tweetUrl}
              onChange={(e) => { setTweetUrl(e.target.value); setTweetUrlError(''); }}
              placeholder="https://x.com/user/status/123456789..."
              className="bg-[#060B13] border-[#182859] text-white placeholder:text-gray-500"
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            />
            {tweetUrlError && (
              <p className="text-[#F22E62] text-sm">{tweetUrlError}</p>
            )}
            <p className="text-gray-500 text-xs">
              Supporte les URLs twitter.com, x.com, ou un ID numérique brut.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTwitterDialogOpen(false)}
              className="border-[#182859] text-white hover:bg-[#182859]"
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                const id = extractTweetId(tweetUrl);
                if (!id) {
                  setTweetUrlError('URL invalide. Collez une URL twitter.com / x.com ou un ID numérique.');
                  return;
                }
                (editor.chain().focus() as any).setTwitterEmbed(id).run();
                setTwitterDialogOpen(false);
                setTweetUrl('');
                setTweetUrlError('');
              }}
              className="bg-[#F22E62] hover:bg-[#F22E62]/80"
            >
              Insérer le tweet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
