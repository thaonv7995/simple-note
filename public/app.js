import { Editor, nodeInputRule, markInputRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

const CustomImage = Image.extend({
  addInputRules() {
    return [
      nodeInputRule({
        find: /!\[(.*?)\]\((.+?)\)$/,
        type: this.type,
        getAttributes: match => {
          const [, alt, src] = match;
          return { src, alt };
        },
      }),
    ];
  },
});

const CustomLink = Link.extend({
  addInputRules() {
    return [
      markInputRule({
        find: /(?<!!)\[(.*?)\]\((.+?)\)$/,
        type: this.type,
        getAttributes: match => {
          const [, , href] = match;
          return { href };
        },
      }),
    ];
  },
});

const saveStatus = document.querySelector("#save-status");
const saveStatusText = document.querySelector("#save-status-text");
const noteId = window.location.pathname.split("/").filter(Boolean).at(-1);
const endpoint = `/api/notes/${encodeURIComponent(noteId)}`;

document.body.addEventListener("click", (e) => {
  if (e.target.closest('a, button, input')) return;
  if (editor && (e.target.closest('.paper') || e.target.closest('.shell'))) {
    if (!editor.isFocused) {
      editor.commands.focus('end');
    }
  }
});

let savedContent = "";
let isSaving = false;
let saveAgain = false;
let lastUpdatedAt = null;
let editor;

function showStatus(message, state) {
  saveStatus.dataset.state = state;
  saveStatus.title = message;
  saveStatusText.textContent = message;
}

function savedTime(isoTime) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoTime));
}

async function loadNote() {
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load note");

    const data = await response.json();
    savedContent = data.content || "";
    lastUpdatedAt = data.updatedAt;
    document.title = `Simple Note · ${noteId.slice(0, 6)}`;
    showStatus("Đã mở", "hidden");

    initEditor(savedContent);
  } catch (err) {
    showStatus("Không thể mở note", "error");
  }
}

async function saveNote() {
  if (!editor) return false;
  const content = editor.storage.markdown.getMarkdown();

  if (content === savedContent) return true;

  if (isSaving) {
    saveAgain = true;
    return false;
  }

  isSaving = true;
  showStatus("Đang lưu…", "loading");

  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, updatedAt: lastUpdatedAt })
    });

    const data = await response.json();
    if (response.status === 409) {
      showStatus("Lỗi: Đã có người sửa note này! Copy nháp và tải lại trang.", "error");
      return false;
    }
    if (!response.ok) throw new Error("Could not save note");
    
    savedContent = content;
    lastUpdatedAt = data.updatedAt;

    const isEditing = editor.isFocused;
    showStatus(`Đã lưu ${savedTime(data.updatedAt)}`, isEditing ? "hidden" : "saved");
    return true;
  } catch (err) {
    console.error(err);
    showStatus("Lưu thất bại — click ra ngoài để thử lại", "error");
    return false;
  } finally {
    isSaving = false;
    if (saveAgain) {
      saveAgain = false;
      await saveNote();
    }
  }
}

function initEditor(initialContent) {
  editor = new Editor({
    element: document.querySelector('#editor'),
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'javascript',
      }),
      CustomImage,
      CustomLink.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
      }),
      Markdown,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'markdown-preview',
        spellcheck: 'true',
        'aria-label': 'Trang ghi chú',
      },
    },
    onUpdate() {
      const content = editor.storage.markdown.getMarkdown();
      const isSaved = content === savedContent;
      showStatus(isSaved ? "Đã lưu" : "Chưa lưu", "hidden");
    },
    onFocus() {
      showStatus("Đang viết", "hidden");
    },
    onBlur() {
      saveNote();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveNote();
  }
});

window.addEventListener("pagehide", () => {
  if (!editor) return;
  const content = editor.storage.markdown.getMarkdown();
  if (content === savedContent) return;
  const body = new Blob([JSON.stringify({ content })], {
    type: "application/json"
  });
  navigator.sendBeacon(endpoint, body);
});

loadNote();
