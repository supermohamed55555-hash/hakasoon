const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDB();
    }
});

function initializeDB() {
    db.serialize(() => {
        // Drop existing tables for a fresh start during setup
        db.run('DROP TABLE IF EXISTS bookings');
        db.run('DROP TABLE IF EXISTS rooms');
        db.run('DROP TABLE IF EXISTS users');

        // Create Users Table
        db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            employee_id TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE', 'BRANCH_MANAGER', 'SECRETARY')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) console.error("Error creating users:", err.message); });

        // Create Rooms Table
        db.run(`CREATE TABLE rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            room_type TEXT NOT NULL CHECK (room_type IN ('LECTURE', 'MULTI_PURPOSE')),
            capacity INTEGER DEFAULT 30
        )`, (err) => { if (err) console.error("Error creating rooms:", err.message); });

        // Create Bookings Table
        db.run(`CREATE TABLE bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            room_id INTEGER,
            booking_date DATE NOT NULL,
            time_slot TEXT NOT NULL,
            purpose TEXT,
            status TEXT DEFAULT 'PENDING_ADMIN' CHECK (status IN ('PENDING_ADMIN', 'PENDING_MANAGER', 'APPROVED', 'REJECTED')),
            admin_note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        )`, (err) => { if (err) console.error("Error creating bookings:", err.message); });

        console.log('Tables created successfully.');
        seedData();
    });
}

function seedData() {
    db.serialize(() => {
        // Insert Users
        const stmtUser = db.prepare('INSERT INTO users (full_name, employee_id, role) VALUES (?, ?, ?)');
        stmtUser.run('Ahmed (Admin)', 'EMP-001', 'ADMIN');
        stmtUser.run('Mahmoud (Employee)', 'EMP-002', 'EMPLOYEE');
        stmtUser.run('Samy (Branch Manager)', 'EMP-003', 'BRANCH_MANAGER');
        stmtUser.run('Mona (Secretary)', 'EMP-004', 'SECRETARY');
        stmtUser.finalize();

        // Insert Rooms
        const stmtRoom = db.prepare('INSERT INTO rooms (name, room_type, capacity) VALUES (?, ?, ?)');
        stmtRoom.run('Hall A', 'LECTURE', 100);
        stmtRoom.run('Room B', 'LECTURE', 40);
        stmtRoom.run('Conference Room 1', 'MULTI_PURPOSE', 150);
        stmtRoom.finalize();

        // Insert Fixed Bookings (Approved to test conflicts later)
        const stmtBooking = db.prepare('INSERT INTO bookings (user_id, room_id, booking_date, time_slot, purpose, status) VALUES (?, ?, ?, ?, ?, ?)');
        stmtBooking.run(1, 1, '2026-04-20', '10:00-12:00', 'Fixed Database Lecture', 'APPROVED');
        stmtBooking.run(1, 2, '2026-04-20', '12:00-14:00', 'Fixed Math Lecture', 'APPROVED');
        stmtBooking.finalize();

        console.log('Sample data seeded successfully.');
        console.log('Phase 1 Database Setup Complete! database.db file created.');
    });

    db.close();
}
