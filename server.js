const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path'); // THÊM DÒNG NÀY

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Cấu hình Database
const db = new Database('deadlock.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    displayName TEXT,
    rankPoints INTEGER DEFAULT 1000
  )
`);

const JWT_SECRET = 'deadlock_super_secret_key_2026';

// --- API ĐĂNG KÝ / ĐĂNG NHẬP ---
app.post('/api/register', async (req, res) => {
    const { username, password, displayName } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (username, password, displayName) VALUES (?, ?, ?)');
        const info = stmt.run(username, hashedPassword, displayName);
        
        const token = jwt.sign({ id: info.lastInsertRowid, displayName }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, displayName, rankPoints: 1000 });
    } catch (e) {
        res.status(400).json({ success: false, error: 'Tên đăng nhập đã tồn tại!' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ success: false, error: 'Sai tên đăng nhập hoặc mật khẩu!' });
    }
    const token = jwt.sign({ id: user.id, displayName: user.displayName }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, displayName: user.displayName, rankPoints: user.rankPoints });
});

// --- SOCKET.IO MULTIPLAYER ---
const players = {};
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error('Unauthorized'));
    }
});

io.on("connection", (socket) => {
    console.log(`[DEADLOCK] Người chơi kết nối: ${socket.user.displayName}`);
    players[socket.id] = { 
        id: socket.id, name: socket.user.displayName,
        x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
        crouch: false, sprint: false, alive: true,
        team: Math.floor(Math.random() * 2) 
    };

    socket.emit("currentPlayers", players);
    socket.broadcast.emit("newPlayer", players[socket.id]);

    socket.on("playerMovement", (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data);
            socket.broadcast.emit("playerMoved", players[socket.id]);
        }
    });

    socket.on("playerShot", (data) => {
        socket.broadcast.emit("playerShot", { id: socket.id, ...data });
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("playerDisconnected", socket.id);
    });
});

// --- PHỤC VỤ GIAO DIỆN GAME (FRONTEND) ---
// Trỏ tới thư mục 'dist' (nơi chứa code đã build của Vite)
app.use(express.static(path.join(__dirname, 'dist')));

// Bất kỳ request nào không phải API hay Socket sẽ trả về file index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] DEADLOCK đang chạy tại cổng ${PORT}`);
});