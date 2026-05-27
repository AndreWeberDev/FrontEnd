const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

// DB file in src/db
const dbDir = path.join(__dirname, 'src', 'db');
const dbFile = path.join(dbDir, 'database.sqlite');
let db;

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

// Enforce JWT_SECRET in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in production');
  process.exit(1);
}

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
app.use(cookieParser());

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

const usersPath = path.join(__dirname, 'src', 'data', 'users.json');
const gamesPath = path.join(__dirname, 'src', 'data', 'upcomingGames.json');

async function ensureDb() {
  try {
    await fs.mkdir(dbDir, { recursive: true });
    // open DB
    db = new sqlite3.Database(dbFile);

    // Create tables if not exist
    await runSql(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      displayName TEXT
    );`);

    await runSql(`CREATE TABLE IF NOT EXISTS upcomingGames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      link TEXT,
      img TEXT,
      subtitle TEXT
    );`);

    await runSql(`CREATE TABLE IF NOT EXISTS refreshTokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT,
      username TEXT,
      expiresAt INTEGER
    );`);

    // Seed users and games from JSON if tables empty
    const rows = await allSql('SELECT COUNT(*) as c FROM users');
    if (rows[0].c === 0) {
      const users = await readJSON(usersPath);
      const stmt = db.prepare('INSERT INTO users (username,password,role,displayName) VALUES (?,?,?,?)');
      for (const u of users) {
        const hashed = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
        stmt.run(u.username, hashed, u.role, u.displayName);
      }
      stmt.finalize();
    }

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

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const rows = await allSql('SELECT username, password, role, displayName FROM users WHERE username = ?', [username]);
    const user = rows && rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const accessToken = jwt.sign({ username: user.username, role: user.role, displayName: user.displayName }, SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ username: user.username }, SECRET, { expiresIn: '7d' });

    // Store refresh token
    const exp = Date.now() + 7 * 24 * 3600 * 1000;
    await runSql('INSERT INTO refreshTokens (token,username,expiresAt) VALUES (?,?,?)', [refreshToken, user.username, exp]);

    // Set HTTP-only cookie for refresh token
    const cookieOptions = { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' };
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true; // send cookie only over HTTPS in prod
    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.json({ token: accessToken, user: { username: user.username, role: user.role, displayName: user.displayName } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.get('/api/upcomingGames', async (req, res) => {
  try {
    const rows = await allSql('SELECT id, name, link, img, subtitle FROM upcomingGames ORDER BY id');
    res.json(rows);
  } catch (e) { res.status(500).json([]); }
});

app.post('/api/upcomingGames', async (req, res) => {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'Token ausente' });
  try {
    const payload = jwt.verify(match[1], SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

    const entry = req.body;
    await runSql('INSERT INTO upcomingGames (name,link,img,subtitle) VALUES (?,?,?,?)', [entry.name, entry.link || '', entry.img || '', entry.subtitle || '']);
    const rows = await allSql('SELECT id, name, link, img, subtitle FROM upcomingGames ORDER BY id');
    res.json({ ok: true, games: rows });
  } catch (e) {
    console.error(e);
    return res.status(401).json({ error: 'Token inválido' });
  }
});

// Refresh access token using httpOnly refresh cookie
app.post('/api/refresh', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'Sem refresh token' });
    // verify token
    const payload = jwt.verify(token, SECRET);
    // check DB
    const rows = await allSql('SELECT id FROM refreshTokens WHERE token = ?', [token]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Refresh inválido' });

    const userRows = await allSql('SELECT username, role, displayName FROM users WHERE username = ?', [payload.username]);
    const user = userRows && userRows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

    const accessToken = jwt.sign({ username: user.username, role: user.role, displayName: user.displayName }, SECRET, { expiresIn: '15m' });
    res.json({ token: accessToken, user: { username: user.username, role: user.role, displayName: user.displayName } });
  } catch (e) {
    console.error('Refresh falhou', e);
    return res.status(401).json({ error: 'Refresh inválido' });
  }
});

// Logout: remove refresh token cookie and DB entry
app.post('/api/logout', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      await runSql('DELETE FROM refreshTokens WHERE token = ?', [token]);
      res.clearCookie('refreshToken');
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao logout' });
  }
});

ensureDb().then(() => {
  app.listen(PORT, () => console.log(`Servidor iniciado em http://localhost:${PORT}`));
}).catch(e => {
  console.error('Falha ao iniciar DB', e);
  process.exit(1);
});
