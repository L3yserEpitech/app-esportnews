'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import styles from './ArticleContent.module.css';

interface ArticleContentProps {
  content: string;
}

export default function ArticleContent({ content }: ArticleContentProps) {
  const sanitized = useMemo(() => {
    // Options: on interdit <style>, <link>, <script> + les attributs inline style et on*
    return DOMPurify.sanitize(content, {
      FORBID_TAGS: ['style', 'link', 'script'],
      FORBID_ATTR: ['style'],
      // Si tu veux explicitement autoriser certaines attrs communes :
      ADD_ATTR: ['class', 'href', 'target', 'rel', 'title', 'alt'],
      // Renforce la sécurité XSS
      USE_PROFILES: { html: true },
    });
  }, [content]);

  return (
    <article
      className={styles.articleContent}
      itemScope
      itemType="https://schema.org/Article"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
