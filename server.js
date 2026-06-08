const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');

// DB file in src/db
const dbDir = path.join(__dirname, 'src', 'db');
const dbFile = path.join(dbDir, 'database.sqlite');
let db;

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet());

// CORS: restrinja origens via ALLOWED_ORIGINS (comma separated). Quando vazio, permite todas.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests like curl
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Redirect HTTP -> HTTPS in production (useful behind proxies/load balancers)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (proto && proto !== 'https') {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });
}

const gamesPath = path.join(__dirname, 'src', 'data', 'upcomingGames.json');

async function ensureDb() {
  try {
    await fs.mkdir(dbDir, { recursive: true });
    // open DB
    db = new sqlite3.Database(dbFile);

    // Create tables if not exist
    await runSql(`CREATE TABLE IF NOT EXISTS upcomingGames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      link TEXT,
      img TEXT,
      subtitle TEXT
    );`);

    // Seed games from JSON if the table is empty
    const grows = await allSql('SELECT COUNT(*) as c FROM upcomingGames');
    if (grows[0].c === 0) {
      const games = await readJSON(gamesPath);
      const stmt = db.prepare('INSERT INTO upcomingGames (name,link,img,subtitle) VALUES (?,?,?,?)');
      games.forEach(g => stmt.run(g.name, g.link, g.img, g.subtitle));
      stmt.finalize();
    }
  } catch (e) {
    console.error('Erro init DB', e);
  }
}

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

function allSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

async function readJSON(p) {
  try {
    const txt = await fs.readFile(p, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return [];
  }
}

async function writeJSON(p, data) {
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/upcomingGames', async (req, res) => {
  try {
    const rows = await allSql('SELECT id, name, link, img, subtitle FROM upcomingGames ORDER BY id');
    res.json(rows);
  } catch (e) { res.status(500).json([]); }
});


ensureDb().then(() => {
  app.listen(PORT, () => console.log(`Servidor iniciado em http://localhost:${PORT}`));
}).catch(e => {
  console.error('Falha ao iniciar DB', e);
  process.exit(1);
});
