
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const basicAuth = require('basic-auth');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USER = "jjgomez2025";
const ADMIN_PASS = "Torrijos1971%";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple basic auth middleware for /admin routes
function auth(req, res, next) {
  const user = basicAuth(req);
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required.');
  }
  return next();
}

// DB init
const db = new sqlite3.Database('./db.sqlite');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    bizum_ref TEXT,
    paid INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Register attendee
app.post('/api/register', (req, res) => {
  const { name, email, phone, bizum_ref } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
  const stmt = db.prepare(`INSERT INTO attendees (name,email,phone,bizum_ref,paid) VALUES (?,?,?,?,?)`);
  stmt.run(name, email || '', phone, bizum_ref || '', 0, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
  stmt.finalize();
});

// List attendees (admin)
app.get('/api/attendees', auth, (req, res) => {
  db.all(`SELECT * FROM attendees ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Mark paid
app.post('/api/mark-paid', auth, (req, res) => {
  const { id, paid } = req.body;
  db.run(`UPDATE attendees SET paid = ? WHERE id = ?`, [paid ? 1 : 0, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Export CSV
app.get('/api/export-csv', auth, (req, res) => {
  db.all(`SELECT id,name,email,phone,bizum_ref,paid,created_at FROM attendees ORDER BY id`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const csvWriter = createObjectCsvWriter({
      path: 'attendees_export.csv',
      header: [
        {id:'id', title:'ID'},
        {id:'name', title:'Name'},
        {id:'email', title:'Email'},
        {id:'phone', title:'Phone'},
        {id:'bizum_ref', title:'BizumRef'},
        {id:'paid', title:'Paid'},
        {id:'created_at', title:'CreatedAt'}
      ]
    });
    csvWriter.writeRecords(rows).then(() => {
      res.download(path.join(__dirname, 'attendees_export.csv'));
    }).catch(err => res.status(500).json({error: err.message}));
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
