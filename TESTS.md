Run smoke tests (Puppeteer)

Requirements
- Node.js (v14+)
- npm
- A local static server serving project root (e.g. `python -m http.server 8000`)

Install Puppeteer (one-time):

```powershell
npm init -y
npm install puppeteer --no-save
```

Run local server (PowerShell):

```powershell
python -m http.server 8000
```

Run the smoke test in a separate terminal (PowerShell):

```powershell
node tests\puppeteer\history-smoke.test.js
```

What the test does
- Opens `http://localhost:8000/research.html`
- Adds a new Activity (ongoing)
- Verifies the card appears in the Activity Timeline
- Toggles status to Completed
- Edits the activity title
- Deletes the activity (accepts the confirm dialog)

Notes
- If Node is not installed, follow https://nodejs.org/ to install it.
- The script is headless by default. To see the browser perform the actions, adjust `puppeteer.launch({ headless: false })` in the test file.
