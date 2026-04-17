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
        db.run('DROP TABLE IF EXISTS buildings');
        db.run('DROP TABLE IF EXISTS users');

        // Create Users Table
        db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            employee_id TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE', 'BRANCH_MANAGER', 'SECRETARY')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) console.error("Error creating users:", err.message); });

        // Create Buildings Table
        db.run(`CREATE TABLE buildings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            total_rooms INTEGER,
            creation_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) console.error("Error creating buildings:", err.message); });

        // Create Rooms Table
        db.run(`CREATE TABLE rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            building_id INTEGER,
            room_number TEXT NOT NULL,
            room_type TEXT NOT NULL CHECK (room_type IN ('LECTURE', 'MULTI_PURPOSE', 'WORKSHOP_LAB', 'LABORATORY')),
            capacity INTEGER DEFAULT 30,
            FOREIGN KEY(building_id) REFERENCES buildings(id)
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

        // Insert Buildings
        const stmtBuilding = db.prepare('INSERT INTO buildings (name, total_rooms, creation_date) VALUES (?, ?, ?)');
        stmtBuilding.run('Building A', 10, '2020-01-01');
        stmtBuilding.run('Building B', 15, '2021-05-20');
        stmtBuilding.finalize();

        // Insert Rooms (linked to buildings)
        const stmtRoom = db.prepare('INSERT INTO rooms (building_id, room_number, room_type, capacity) VALUES (?, ?, ?, ?)');
        stmtRoom.run(1, 'A-101', 'LECTURE', 100);
        stmtRoom.run(1, 'A-102', 'LECTURE', 40);
        stmtRoom.run(2, 'B-201', 'MULTI_PURPOSE', 150);
        stmtRoom.run(2, 'B-Lab-1', 'WORKSHOP_LAB', 25);
        stmtRoom.finalize();

        // Insert Fixed Bookings
        const stmtBooking = db.prepare('INSERT INTO bookings (user_id, room_id, booking_date, time_slot, purpose, status) VALUES (?, ?, ?, ?, ?, ?)');
        stmtBooking.run(1, 1, '2026-04-20', '10:00-12:00', 'Fixed Database Lecture', 'APPROVED');
        stmtBooking.run(1, 2, '2026-04-20', '12:00-14:00', 'Fixed Math Lecture', 'APPROVED');
        stmtBooking.finalize();

        console.log('Sample data seeded successfully.');
        console.log('Phase 1 Database Setup Complete! database.db file created.');
    });

    db.close();
}
