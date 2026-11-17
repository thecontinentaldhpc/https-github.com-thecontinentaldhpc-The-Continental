import { useRef, useState } from 'react';
import { Bold, Eye, Heading2, Heading3, ImagePlus, Italic, Link as LinkIcon, List, ListOrdered, Pilcrow, Quote } from 'lucide-react';
import { sanitizeEditorialHtml } from '../lib/editorialRules';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  id?: string;
}

export function RichTextEditor({ value, onChange, id = 'rich-editor' }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const insertLink = () => {
    const url = window.prompt('Enter hyperlink URL (https://...):', 'https://');
    if (!url) return;
    wrapSelection(`<a href="${url}" target="_blank" rel="noopener noreferrer">`, '</a>', 'link text');
  };

  const insertImageFigure = () => {
    const url = window.prompt('Enter image URL (/uploads/... or /src/assets/...):', '/uploads/');
    if (!url) return;
    const caption = window.prompt('Enter figure caption:', '') || '';
    const snippet = `\n<figure>\n  <img src="${url}" alt="${caption.replace(/"/g, '&quot;')}" />\n  <figcaption>${caption}</figcaption>\n</figure>\n`;
    const el = textareaRef.current;
    if (!el) {
      onChange(value + snippet);
      return;
    }
    const pos = el.selectionStart;
    onChange(value.slice(0, pos) + snippet + value.slice(pos));
  };

  return (
    <div className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181818]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#1e1e1e]">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => wrapSelection('<h2>', '</h2>\n', 'Section Heading')}
            title="Heading 2"
            aria-label="Insert Heading 2"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('<h3>', '</h3>\n', 'Subheading')}
            title="Heading 3"
            aria-label="Insert Heading 3"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <Heading3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('<p>', '</p>\n', 'Paragraph text')}
            title="Paragraph"
            aria-label="Insert Paragraph"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <Pilcrow className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('<strong>', '</strong>', 'bold text')}
            title="Bold"
            aria-label="Bold"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('<em>', '</em>', 'italic text')}
            title="Italic"
            aria-label="Italic"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={insertLink}
            title="Hyperlink"
            aria-label="Insert Hyperlink"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('<blockquote>\n  ', '\n</blockquote>\n', 'Quoted statement')}
            title="Blockquote"
            aria-label="Insert Blockquote"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('<ul>\n  <li>', '</li>\n</ul>\n', 'List item')}
            title="Bullet List"
            aria-label="Insert Bullet List"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('<ol>\n  <li>', '</li>\n</ol>\n', 'Numbered item')}
            title="Numbered List"
            aria-label="Insert Numbered List"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={insertImageFigure}
            title="Image with Caption"
            aria-label="Insert Image with Caption"
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border ${
            preview
              ? 'bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 border-[#111111] dark:border-neutral-100'
              : 'bg-white dark:bg-[#181818] text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{preview ? 'Edit Source' : 'Preview Prose'}</span>
        </button>
      </div>

      {preview ? (
        <div
          className="p-5 min-h-[260px] max-h-[480px] overflow-y-auto article-prose"
          dangerouslySetInnerHTML={{ __html: sanitizeEditorialHtml(value) }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="w-full p-4 font-mono text-sm bg-white dark:bg-[#141414] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none resize-y"
          placeholder="<p>Begin your report here...</p>"
        />
      )}
    </div>
  );
}
