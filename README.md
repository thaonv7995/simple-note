# Simple Note

A minimalist, Notion-like, zero-database web notepad. 
Fast, lightweight, and supports Markdown editing with live preview.

![Simple Note Screenshot](docs/screenshot.png)

## Features
- **WYSIWYG Markdown Editor**: Powered by Tiptap. Type markdown and see it format instantly.
- **Auto-save**: Notes are automatically saved to text files on the server.
- **Zero Database**: All notes are stored as simple `.txt` files in the `data/` folder.
- **Syntax Highlighting**: Beautiful code blocks with Dracula theme.
- **Image & Link Support**: Easily paste image URLs and they render inline.
- **No Dependencies**: Backend is written in pure Node.js (no Express needed).

---

## 🚀 Quick Installation (One-line command)

You can install, update, or remove Simple Note using our automated script. **No Node.js or PM2 required!** The script automatically downloads a Native Binary for your system (Linux or Mac) and runs it as a background service.

### 1. Install

Run this command in your terminal:

```bash
curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- install
```
This will:
1. Download the latest native executable to `~/.simple-note`.
2. Automatically start it in the background (using `systemd` on Linux, or `nohup` on Mac) on port **22099**.

You can then access your notes at: **[http://localhost:22099](http://localhost:22099)**

### 2. Update

To pull the latest changes and restart the app:

```bash
curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- update
```

### 3. Remove (Uninstall)

To completely remove the app:

```bash
curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- remove
```
*Don't worry! Before removing, the script will automatically backup your `data/` folder to your home directory, so you won't lose your notes.*

---

## Manual Setup

If you prefer to run it manually without the script:

1. Clone the repository
   ```bash
   git clone https://github.com/thaonv7995/simple-note.git
   cd simple-note
   ```
2. Install dependencies & Build
   ```bash
   npm install
   npm run build
   ```
3. Start the server
   ```bash
   PORT=22099 npm start
   ```

## Development

- Start server: `PORT=3001 npm start`
- Run tests: `npm test`
- Build frontend: `npm run build`
