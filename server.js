// server.js
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Khắc phục __dirname trong ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

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
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`[SERVER] DEADLOCK đang chạy tại cổng ${PORT}`);
});