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
        db.run('DROP TABLE IF EXISTS bookings');
        db.run('DROP TABLE IF EXISTS rooms');
        db.run('DROP TABLE IF EXISTS buildings');
        db.run('DROP TABLE IF EXISTS users');

        db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            employee_id TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE', 'BRANCH_MANAGER', 'SECRETARY')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE buildings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            total_rooms INTEGER,
            creation_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            building_id INTEGER,
            room_number TEXT NOT NULL,
            room_type TEXT NOT NULL CHECK (room_type IN ('LECTURE', 'MULTI_PURPOSE', 'WORKSHOP_LAB', 'LABORATORY')),
            capacity INTEGER DEFAULT 30,
            FOREIGN KEY(building_id) REFERENCES buildings(id)
        )`);

        db.run(`CREATE TABLE bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            room_id INTEGER,
            booking_date DATE NOT NULL,
            time_slot TEXT NOT NULL,
            purpose TEXT,
            status TEXT DEFAULT 'PENDING_ADMIN' CHECK (status IN ('PENDING_ADMIN', 'PENDING_MANAGER', 'APPROVED', 'REJECTED')),
            admin_note TEXT,
            event_manager_name TEXT,
            event_manager_title TEXT,
            tech_requirements TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        )`);

        console.log('Tables created successfully.');
        seedData();
    });
}

function seedData() {
    db.serialize(() => {
        const stmtUser = db.prepare('INSERT INTO users (full_name, email, employee_id, role) VALUES (?, ?, ?, ?)');
        stmtUser.run('Ahmed (Admin)', 'ahmed@admin.aast.edu', '123456789', 'ADMIN');
        stmtUser.run('Mahmoud (Employee)', 'mahmoud@staff.aast.edu', '222222222', 'EMPLOYEE');
        stmtUser.run('Samy (Branch Manager)', 'samy@manager.aast.edu', '333333333', 'BRANCH_MANAGER');
        stmtUser.run('Mona (Secretary)', 'mona@scertary.aast.edu', '444444444', 'SECRETARY');
        stmtUser.finalize();

        const stmtBuilding = db.prepare('INSERT INTO buildings (name, total_rooms, creation_date) VALUES (?, ?, ?)');
        stmtBuilding.run('Building A', 10, '2020-01-01');
        stmtBuilding.run('Building B', 15, '2021-05-20');
        stmtBuilding.finalize();

        const stmtRoom = db.prepare('INSERT INTO rooms (building_id, room_number, room_type, capacity) VALUES (?, ?, ?, ?)');
        stmtRoom.run(1, 'A-101', 'LECTURE', 100);
        stmtRoom.run(1, 'A-102', 'LECTURE', 40);
        stmtRoom.run(2, 'B-201', 'MULTI_PURPOSE', 150);
        stmtRoom.run(2, 'B-Lab-1', 'WORKSHOP_LAB', 25);
        stmtRoom.finalize();

        const today = new Date().toISOString().split('T')[0];
        const stmtBooking = db.prepare('INSERT INTO bookings (user_id, room_id, booking_date, time_slot, purpose, status) VALUES (?, ?, ?, ?, ?, ?)');
        stmtBooking.run(1, 1, today, '08:00-10:00', 'Fixed Database Lecture', 'APPROVED');
        stmtBooking.run(1, 2, today, '10:00-12:00', 'Fixed Math Lecture', 'APPROVED');
        stmtBooking.finalize();

        console.log('Sample data seeded successfully.');
    });
    db.close();
}
