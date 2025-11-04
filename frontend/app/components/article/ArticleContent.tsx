'use client';

interface ArticleContentProps {
  content: string;
}

export default function ArticleContent({ content }: ArticleContentProps) {
  return (
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
        [&>code]:bg-gray-900 [&>code]:px-2 [&>code]:py-1 [&>code]:rounded [&>code]:text-pink-400 [&>code]:font-mono"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
