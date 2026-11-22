import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import type { Translation } from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { api } from '../lib/api'

interface RichTextEditorProps {
  markdown: string
  onChange: (markdown: string) => void
}

const translation: Translation = (key, defaultValue, interpolations = {}) => {
  if (key === 'contentArea.editableMarkdown') {
    return 'Content'
  }

  let value = defaultValue
  for (const [name, replacement] of Object.entries(interpolations)) {
    value = value.replaceAll(`{{${name}}}`, String(replacement))
  }

  return value
}

export function RichTextEditor({ markdown, onChange }: RichTextEditorProps) {
  return (
    <MDXEditor
      markdown={markdown}
      onChange={onChange}
      className="mdx-editor"
      contentEditableClassName="mdx-editor-content markdown-body"
      placeholder="Write your story. Use the toolbar for headings, lists, links, tables, and images."
      suppressHtmlProcessing
      translation={translation}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        tablePlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        imagePlugin({
          imageUploadHandler: async (file) => (await api.uploadImage(file)).url,
        }),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <Separator />
              <BoldItalicUnderlineToggles />
              <Separator />
              <BlockTypeSelect />
              <Separator />
              <ListsToggle />
              <Separator />
              <CreateLink />
              <InsertImage />
              <InsertTable />
              <InsertThematicBreak />
            </>
          ),
        }),
      ]}
    />
  )
}
