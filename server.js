const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect to SQLite DB (Better-SQLite3 is synchronous)
const dbPath = path.resolve(__dirname, 'database.db');
const db = new Database(dbPath);
console.log('Connected to the better-sqlite3 database.');

// =======================
// Login / Register
// =======================
app.post('/api/login', (req, res) => {
    try {
        const { email, employee_id } = req.body;
        const lowerEmail = email.toLowerCase();
        let role = null;
        if (lowerEmail.endsWith('@admin.aast.edu')) role = 'ADMIN';
        else if (lowerEmail.endsWith('@manager.aast.edu')) role = 'BRANCH_MANAGER';
        else if (lowerEmail.endsWith('@staff.aast.edu')) role = 'EMPLOYEE';
        else if (lowerEmail.endsWith('@scertary.aast.edu')) role = 'SECRETARY';

        if (!role) return res.status(403).json({ error: 'Unauthorized email domain.' });
        if (!employee_id || employee_id.length !== 9) return res.status(400).json({ error: 'ID must be 9 digits.' });

        let user = db.prepare('SELECT * FROM users WHERE email = ?').get(lowerEmail);
        if (user) {
            db.prepare('UPDATE users SET employee_id = ? WHERE id = ?').run(employee_id, user.id);
            user.employee_id = employee_id;
            return res.json(user);
        }
        
        const name = lowerEmail.split('@')[0].toUpperCase();
        const info = db.prepare('INSERT INTO users (full_name, email, employee_id, role) VALUES (?, ?, ?, ?)').run(name, lowerEmail, employee_id, role);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users', (req, res) => {
    const rows = db.prepare('SELECT * FROM users').all();
    res.json(rows);
});

// =======================
// Rooms & Buildings
// =======================
app.get('/api/rooms', (req, res) => {
    const rows = db.prepare(`SELECT r.*, b.name as building_name FROM rooms r JOIN buildings b ON r.building_id = b.id`).all();
    res.json(rows);
});

app.get('/api/buildings', (req, res) => {
    const rows = db.prepare('SELECT * FROM buildings').all();
    res.json(rows);
});

app.post('/api/buildings', (req, res) => {
    const { name, total_rooms, creation_date } = req.body;
    const info = db.prepare('INSERT INTO buildings (name, total_rooms, creation_date) VALUES (?, ?, ?)').run(name, total_rooms, creation_date);
    res.json({ id: info.lastInsertRowid });
});

app.post('/api/rooms', (req, res) => {
    const { building_id, room_number, room_type, capacity } = req.body;
    const info = db.prepare('INSERT INTO rooms (building_id, room_number, room_type, capacity) VALUES (?, ?, ?, ?)').run(building_id, room_number, room_type, capacity);
    res.json({ id: info.lastInsertRowid });
});

// =======================
// Bookings
// =======================
app.get('/api/bookings', (req, res) => {
    const { user_id, date } = req.query;
    let query = `SELECT b.*, u.full_name as user_name, r.room_number as room_name, bl.name as building_name FROM bookings b JOIN users u ON b.user_id = u.id JOIN rooms r ON b.room_id = r.id JOIN buildings bl ON r.building_id = bl.id`;
    let params = [];
    if (user_id) { query += ' WHERE b.user_id = ?'; params.push(user_id); }
    if (date) { query += (user_id ? ' AND ' : ' WHERE ') + 'b.booking_date = ?'; params.push(date); }
    const rows = db.prepare(query + ' ORDER BY b.created_at DESC').all(params);
    res.json(rows);
});

app.post('/api/bookings', (req, res) => {
    try {
        const { user_id, room_id, booking_date, time_slot, purpose, event_manager_name, event_manager_title, tech_requirements } = req.body;
        
        const room = db.prepare('SELECT room_type, room_number FROM rooms WHERE id = ?').get(room_id);
        const user = db.prepare('SELECT role FROM users WHERE id = ?').get(user_id);
        
        // 1. Authorization Rules
        if (user.role === 'SECRETARY' && room.room_type !== 'MULTI_PURPOSE') 
            return res.status(403).json({ error: 'SECRETARY is only authorized for Multi-Purpose facilities.' });
        
        // 2. Advance Notice Rules
        const diffDays = Math.ceil((new Date(booking_date) - new Date().setHours(0,0,0,0)) / 86400000);
        const dayLimit = room.room_type === 'MULTI_PURPOSE' ? 2 : 1;
        if (diffDays < dayLimit) 
            return res.status(400).json({ error: `Notice Policy: ${dayLimit} days required for this facility type.` });

        // 3. CONFLICT CHECK
        const existing = db.prepare(`SELECT id FROM bookings WHERE room_id = ? AND booking_date = ? AND time_slot = ? AND status != 'REJECTED'`).get(room_id, booking_date, time_slot);
        
        if (existing) {
            // SUGGESTION LOGIC: Find free rooms of the same type
            const alternatives = db.prepare(`
                SELECT r.id, r.room_number, b.name as building_name 
                FROM rooms r
                JOIN buildings b ON r.building_id = b.id
                WHERE r.room_type = ? AND r.id != ?
                AND r.id NOT IN (
                    SELECT room_id FROM bookings WHERE booking_date = ? AND time_slot = ? AND status != 'REJECTED'
                )
                LIMIT 3
            `).all(room.room_type, room_id, booking_date, time_slot);

            return res.status(409).json({ 
                error: `The room ${room.room_number} is already reserved for this slot.`,
                suggestions: alternatives 
            });
        }

        db.prepare(`INSERT INTO bookings (user_id, room_id, booking_date, time_slot, purpose, status, event_manager_name, event_manager_title, tech_requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(user_id, room_id, booking_date, time_slot, purpose, 'PENDING_ADMIN', event_manager_name, event_manager_title, tech_requirements);
        res.json({ message: 'Booking request submitted successfully.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bookings/:id/status', (req, res) => {
    const { status, admin_note } = req.body;
    db.prepare('UPDATE bookings SET status = ?, admin_note = ? WHERE id = ?').run(status, admin_note, req.params.id);
    res.json({ message: 'Updated' });
});

app.get('/api/notifications', (req, res) => {
    const rows = db.prepare(`SELECT b.id, b.purpose, b.booking_date, b.time_slot, r.room_number, u.full_name FROM bookings b JOIN rooms r ON b.room_id = r.id JOIN users u ON b.user_id = u.id WHERE b.status = 'APPROVED' ORDER BY b.created_at DESC LIMIT 5`).all();
    res.json(rows);
});

app.listen(port, () => console.log(`Server running on ${port}`));
