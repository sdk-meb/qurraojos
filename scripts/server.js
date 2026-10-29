const https = require('https');
const fs = require('fs');
const path = require('path');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Resolve SSL files from project root
const projectRoot = path.join(__dirname, '..');
const sslDir = path.join(projectRoot, 'ssl');

app.prepare().then(() => {
  const options = {
    key: fs.readFileSync(path.join(sslDir, 'localhost.key')),
    cert: fs.readFileSync(path.join(sslDir, 'localhost.crt'))
  };

  https.createServer(options, async (req, res) => {
    await handle(req, res);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('✅ Ready on https://localhost:3000');
  });
});

