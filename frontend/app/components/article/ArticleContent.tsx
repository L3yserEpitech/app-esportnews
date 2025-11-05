'use client';

import { useMemo } from 'react';
import styles from './ArticleContent.module.css';

interface ArticleContentProps {
  content: string;
}

export default function ArticleContent({ content }: ArticleContentProps) {
  // Nettoyer le contenu HTML
  const cleanedContent = useMemo(() => {
    return content
      .replace(/style="[^"]*"/g, '') // Supprimer les attributs style inline
      .replace(/on\w+="[^"]*"/g, ''); // Supprimer les event handlers (sécurité XSS)
  }, [content]);

  return (
    <article
      className={styles.articleContent}
      dangerouslySetInnerHTML={{ __html: cleanedContent }}
    />
  );
}