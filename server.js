

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // ADDED: Serve frontend files

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

// 2. Get All Rooms (with Building Info)
app.get('/api/rooms', (req, res) => {
    const query = `
        SELECT r.*, b.name as building_name 
        FROM rooms r
        JOIN buildings b ON r.building_id = b.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2b. Get All Buildings
app.get('/api/buildings', (req, res) => {
    db.all('SELECT * FROM buildings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2c. Add New Building (Admin Only)
app.post('/api/buildings', (req, res) => {
    const { name, total_rooms, creation_date } = req.body;
    const stmt = db.prepare('INSERT INTO buildings (name, total_rooms, creation_date) VALUES (?, ?, ?)');
    stmt.run([name, total_rooms, creation_date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Building added successfully!' });
    });
    stmt.finalize();
});

// 2d. Add New Room (Admin Only)
app.post('/api/rooms', (req, res) => {
    const { building_id, room_number, room_type, capacity } = req.body;
    const stmt = db.prepare('INSERT INTO rooms (building_id, room_number, room_type, capacity) VALUES (?, ?, ?, ?)');
    stmt.run([building_id, room_number, room_type, capacity], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Room added successfully!' });
    });
    stmt.finalize();
});

// 3. Get All Bookings (with filtering by date/userId)
app.get('/api/bookings', (req, res) => {
    const { user_id, date } = req.query;
    let query = `
        SELECT b.*, u.full_name as user_name, r.room_number as room_name, bl.name as building_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        JOIN buildings bl ON r.building_id = bl.id
    `;
    let params = [];
    let clauses = [];
    
    if (user_id) { clauses.push('b.user_id = ?'); params.push(user_id); }
    if (date) { clauses.push('b.booking_date = ?'); params.push(date); }
    
    if (clauses.length > 0) query += ' WHERE ' + clauses.join(' AND ');
    query += ' ORDER BY b.created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3b. Admin Notifications (Approved by Manager)
app.get('/api/notifications', (req, res) => {
    const query = `
        SELECT b.id, b.purpose, b.booking_date, b.time_slot, r.room_number, u.full_name
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN users u ON b.user_id = u.id
        WHERE b.status = 'APPROVED'
        ORDER BY b.created_at DESC LIMIT 5
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// =======================
// PHASE 3 API ENDPOINTS
// =======================

// 4. Create a Booking (Employee/Secretary with restrictive logic and E-Form)
app.post('/api/bookings', (req, res) => {
    const { user_id, room_id, booking_date, time_slot, purpose, event_manager_name, event_manager_title, tech_requirements } = req.body;
    
    db.get('SELECT room_type FROM rooms WHERE id = ?', [room_id], (err, room) => {
        db.get('SELECT role FROM users WHERE id = ?', [user_id], (err, user) => {
            if (user.role === 'SECRETARY' && room.room_type !== 'MULTI_PURPOSE') {
                return res.status(403).json({ error: 'Secretaries can only book Multi-Purpose rooms.' });
            }

            const bookingDateObj = new Date(booking_date);
            bookingDateObj.setHours(0,0,0,0);
            const todayDateObj = new Date();
            todayDateObj.setHours(0,0,0,0);
            const diffDays = Math.ceil((bookingDateObj - todayDateObj) / (1000 * 60 * 60 * 24));
            const dayLimit = room.room_type === 'MULTI_PURPOSE' ? 2 : 1; 
            
            if (diffDays < dayLimit) {
                return res.status(400).json({ error: `${room.room_type} rooms require at least ${dayLimit} days notice.` });
            }

            const conflictQuery = `SELECT * FROM bookings WHERE room_id = ? AND booking_date = ? AND time_slot = ? AND status = 'APPROVED'`;
            db.get(conflictQuery, [room_id, booking_date, time_slot], (err, conflict) => {
                if (conflict) {
                    return res.status(400).json({ 
                        error: 'CONFLICT',
                        message: `Already reserved for "${conflict.purpose}"`
                    });
                }

                const stmt = db.prepare(`
                    INSERT INTO bookings (user_id, room_id, booking_date, time_slot, purpose, status, event_manager_name, event_manager_title, tech_requirements) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                stmt.run([user_id, room_id, booking_date, time_slot, purpose, 'PENDING_ADMIN', event_manager_name, event_manager_title, tech_requirements], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, message: 'Requested successfully! Waiting Admin approval.' });
                });
                stmt.finalize();
            });
        });
    });
});

// 5. Update Booking Status (Multi-Stage Approval)
app.post('/api/bookings/:id/status', (req, res) => {
    const { status, admin_note, role } = req.body; // Added role to the request body
    const bookingId = req.params.id;

    db.get(`SELECT * FROM bookings WHERE id = ?`, [bookingId], (err, currentBooking) => {
        if (err || !currentBooking) return res.status(404).json({ error: 'Booking not found' });

        if (status === 'APPROVED' || status === 'PENDING_MANAGER') {
            // CONFLICT CHECK for both Admin and Manager approval stages
            db.get(`SELECT b.*, u.full_name FROM bookings b JOIN users u ON b.user_id = u.id WHERE b.room_id = ? AND b.booking_date = ? AND b.time_slot = ? AND b.status = 'APPROVED' AND b.id != ?`,
                [currentBooking.room_id, currentBooking.booking_date, currentBooking.time_slot, bookingId],
                (err, row) => {
                    if (row) {
                        return res.status(400).json({
                            error: 'CONFLICT',
                            message: `Cannot approve. This room is already occupied by "${row.purpose}" (${row.time_slot}).`,
                            suggestion: 'Please reject this request and suggest an alternative room to the employee.'
                        });
                    } else {
                        proceedUpdate();
                    }
                });
        } else {
            proceedUpdate();
        }

        function proceedUpdate() {
            // Simplified logic: 
            // Admin can set to PENDING_MANAGER or REJECTED
            // Manager can set to APPROVED or REJECTED
            const stmt = db.prepare('UPDATE bookings SET status = ?, admin_note = ? WHERE id = ?');
            stmt.run([status, admin_note, bookingId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: `Status updated to ${status}` });
            });
            stmt.finalize();
        }
    });
});

app.listen(port, () => {
    console.log(`Phase 1 API is running on http://localhost:${port}`);
    console.log(`Test URLs:`);
    console.log(`- http://localhost:${port}/api/users`);
    console.log(`- http://localhost:${port}/api/rooms`);
    console.log(`- http://localhost:${port}/api/bookings`);
});
