const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

app.use(express.static(__dirname));
app.use(express.json());

const DB_FILE = './database.json';
let db = { users: {} };

// قراءة قاعدة البيانات
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) { console.log("خطأ في قراءة ملف البيانات، سيتم بدء ملف جديد"); }
}

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

// رابط التسجيل
app.post('/register', (req, res) => {
    const { username, password, fullName } = req.body;
    if (!username || !password) return res.json({ success: false, message: "أكمل البيانات!" });
    if (db.users[username]) return res.json({ success: false, message: "الاسم موجود!" });
    
    db.users[username] = { password, fullName, following: [] };
    saveDB();
    res.json({ success: true });
});

// رابط الدخول
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users[username];
    if (user && user.password === password) {
        res.json({ success: true, fullName: user.fullName });
    } else {
        res.json({ success: false, message: "خطأ في الاسم أو كلمة السر" });
    }
});

let onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('go_online', (username) => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        // تحديث القائمة للجميع
        io.emit('all_users', Object.keys(db.users).map(u => ({
            username: u,
            fullName: db.users[u].fullName,
            isOnline: !!onlineUsers[u]
        })));
    });

    socket.on('send_msg', (data) => {
        const targetSocket = onlineUsers[data.to];
        if (targetSocket) {
            io.to(targetSocket).emit('new_msg', { from: socket.username, text: data.text });
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.username];
        io.emit('user_offline', socket.username);
    });
});

server.listen(3000, () => console.log('السيرفر يعمل: http://localhost:3000'));