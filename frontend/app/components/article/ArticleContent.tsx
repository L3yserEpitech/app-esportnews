'use client';

interface ArticleContentProps {
  content: string;
}

export default function ArticleContent({ content }: ArticleContentProps) {
  // Nettoyer le contenu HTML pour éviter les styles inline conflictuels
  const cleanedContent = content
    .replace(/style="[^"]*"/g, '') // Supprimer tous les attributs style inline
    .replace(/on\w+="[^"]*"/g, ''); // Supprimer les event handlers (sécurité)

  return (
    <article
      className="bg-gradient-to-b from-[#091626]/40 to-[#060B13]/60 border border-[#182859]/40 rounded-2xl p-8 md:p-10 backdrop-blur-sm"
      style={{ isolation: 'isolate' } as React.CSSProperties}
    >
      <div
        className="prose prose-invert max-w-none
          [&>h1]:text-4xl [&>h1]:font-bold [&>h1]:text-white [&>h1]:my-6
          [&>h2]:text-3xl [&>h2]:font-semibold [&>h2]:text-white [&>h2]:my-6
          [&>h3]:text-2xl [&>h3]:font-semibold [&>h3]:text-white [&>h3]:my-4
          [&>p]:text-gray-300 [&>p]:my-4 [&>p]:leading-relaxed
          [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:text-gray-300 [&>ul]:my-4
          [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:text-gray-300 [&>ol]:my-4
          [&>li]:my-2
          [&>img]:max-w-full [&>img]:h-auto [&>img]:rounded-lg [&>img]:my-6
          [&>a]:text-blue-400 [&>a]:underline [&>a]:hover:text-blue-300
          [&>blockquote]:border-l-4 [&>blockquote]:border-pink-500 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-400 [&>blockquote]:my-4
          [&>pre]:bg-gray-900 [&>pre]:p-4 [&>pre]:rounded [&>pre]:overflow-x-auto [&>pre]:my-4
          [&>code]:bg-gray-900 [&>code]:px-2 [&>code]:py-1 [&>code]:rounded [&>code]:text-pink-400 [&>code]:font-mono
          [&_*]:!text-inherit [&_a]:!text-blue-400 [&_strong]:!font-bold [&_em]:!italic"
        dangerouslySetInnerHTML={{ __html: cleanedContent }}
      />
    </article>
  );
}
