'use client';

import { useEffect, useRef } from 'react';

interface ArticleContentProps {
  content: string;
}

export default function ArticleContent({ content }: ArticleContentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  background: transparent;
                  font-family: Arial, sans-serif;
                }
                h1 {
                  font-size: 2.25rem;
                  font-weight: 700;
                  margin: 1.5rem 0 1rem 0;
                  color: white;
                }
                h2 {
                  font-size: 1.875rem;
                  font-weight: 600;
                  margin: 1.5rem 0 1rem 0;
                  color: white;
                }
                h3 {
                  font-size: 1.5rem;
                  font-weight: 600;
                  margin: 1.25rem 0 0.75rem 0;
                  color: white;
                }
                p {
                  margin: 0.75rem 0;
                  line-height: 1.75;
                  color: #d1d5db;
                }
                img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 8px;
                  margin: 1rem 0;
                }
                a {
                  color: #3b82f6;
                  text-decoration: underline;
                }
              </style>
            </head>
            <body>
              ${content}
            </body>
          </html>
        `);
        doc.close();

        // Ajuster la hauteur de l'iframe dynamiquement
        const resizeIframe = () => {
          if (iframeRef.current && doc.body) {
            const height = Math.max(
              doc.body.scrollHeight,
              doc.documentElement.scrollHeight,
              doc.body.offsetHeight,
              doc.documentElement.offsetHeight
            );
            iframeRef.current.style.height = height + 'px';
          }
        };

        // Attendre le chargement des images
        const images = doc.getElementsByTagName('img');
        let loadedImages = 0;
        const totalImages = images.length;

        if (totalImages === 0) {
          resizeIframe();
        } else {
          Array.from(images).forEach((img) => {
            img.onload = () => {
              loadedImages++;
              resizeIframe();
              if (loadedImages === totalImages) {
                setTimeout(resizeIframe, 50);
              }
            };
            if (img.complete) {
              loadedImages++;
              if (loadedImages === totalImages) {
                resizeIframe();
              }
            }
          });
        }

        // Resize initial et multiple fois pour être sûr
        setTimeout(resizeIframe, 0);
        setTimeout(resizeIframe, 100);
        setTimeout(resizeIframe, 300);
        setTimeout(resizeIframe, 500);
      }
    }
  }, [content]);

  return (
    <iframe
      ref={iframeRef}
      title="Article Content"
      className="w-full border-0 overflow-hidden"
      scrolling="no"
    />
  );
}
