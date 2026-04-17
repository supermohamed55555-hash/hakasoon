const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Connect to SQLite DB
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error connecting to DB:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// =======================
// PHASE 1 API ENDPOINTS
// =======================

// 1. Get All Users (For testing/Login dropdown)
app.get('/api/users', (req, res) => {
    db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Get All Rooms
app.get('/api/rooms', (req, res) => {
    db.all('SELECT * FROM rooms', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3. Get All Bookings (Admin) or for specific user
app.get('/api/bookings', (req, res) => {
    const userId = req.query.user_id;
    let query = `
        SELECT b.id, u.full_name as user_name, r.name as room_name, b.booking_date, b.time_slot, b.purpose, b.status, b.admin_note 
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
    `;
    let params = [];

    if (userId) {
        query += ' WHERE b.user_id = ?';
        params.push(userId);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(port, () => {
    console.log(`Phase 1 API is running on http://localhost:${port}`);
    console.log(`Test URLs:`);
    console.log(`- http://localhost:${port}/api/users`);
    console.log(`- http://localhost:${port}/api/rooms`);
    console.log(`- http://localhost:${port}/api/bookings`);
});
