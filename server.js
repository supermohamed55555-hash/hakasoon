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

// =======================
// PHASE 3 API ENDPOINTS
// =======================

// 4. Create a Booking (Employee Blind Request with Conflict Check)
app.post('/api/bookings', (req, res) => {
    const { user_id, room_id, booking_date, time_slot, purpose } = req.body;
    
    // Check for existing APPROVED bookings that conflict
    const conflictQuery = `
        SELECT b.*, u.full_name as owner_name 
        FROM bookings b 
        JOIN users u ON b.user_id = u.id 
        WHERE b.room_id = ? AND b.booking_date = ? AND b.time_slot = ? AND b.status = 'APPROVED'
    `;
    
    db.get(conflictQuery, [room_id, booking_date, time_slot], (err, conflict) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (conflict) {
            return res.status(400).json({ 
                error: 'CONFLICT',
                message: `This room is already reserved for "${conflict.purpose}" during the ${conflict.time_slot} slot.`,
                suggestion: 'Please try selecting a different time slot or another room.'
            });
        }

        // If no conflict, proceed
        const stmt = db.prepare('INSERT INTO bookings (user_id, room_id, booking_date, time_slot, purpose, status) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run([user_id, room_id, booking_date, time_slot, purpose, 'PENDING_ADMIN'], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'Booking requested successfully! Waiting for Admin approval.' });
        });
        stmt.finalize();
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
            stmt.run([status, admin_note, bookingId], function(err) {
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
