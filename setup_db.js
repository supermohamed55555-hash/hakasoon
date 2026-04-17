const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('Initializing DB with better-sqlite3...');

db.exec(`
    DROP TABLE IF EXISTS bookings;
    DROP TABLE IF EXISTS rooms;
    DROP TABLE IF EXISTS buildings;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        employee_id TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE', 'BRANCH_MANAGER', 'SECRETARY')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE buildings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_rooms INTEGER,
        creation_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        building_id INTEGER,
        room_number TEXT NOT NULL,
        room_type TEXT NOT NULL CHECK (room_type IN ('LECTURE', 'MULTI_PURPOSE', 'WORKSHOP_LAB', 'LABORATORY')),
        capacity INTEGER DEFAULT 30,
        FOREIGN KEY(building_id) REFERENCES buildings(id)
    );

    CREATE TABLE bookings (
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
    );
`);

console.log('Tables created. Seeding data...');

const insertUser = db.prepare('INSERT INTO users (full_name, email, employee_id, role) VALUES (?, ?, ?, ?)');
insertUser.run('Ahmed (Admin)', 'ahmed@admin.aast.edu', '123456789', 'ADMIN');
insertUser.run('Mahmoud (Employee)', 'mahmoud@staff.aast.edu', '222222222', 'EMPLOYEE');
insertUser.run('Samy (Branch Manager)', 'samy@manager.aast.edu', '333333333', 'BRANCH_MANAGER');
insertUser.run('Mona (Secretary)', 'mona@scertary.aast.edu', '444444444', 'SECRETARY');

const insertBuilding = db.prepare('INSERT INTO buildings (name, total_rooms, creation_date) VALUES (?, ?, ?)');
insertBuilding.run('Building A', 10, '2020-01-01');
insertBuilding.run('Building B', 15, '2021-05-20');

const insertRoom = db.prepare('INSERT INTO rooms (building_id, room_number, room_type, capacity) VALUES (?, ?, ?, ?)');
insertRoom.run(1, 'A-101', 'LECTURE', 100);
insertRoom.run(2, 'B-201', 'MULTI_PURPOSE', 150);

console.log('Database Setup Complete!');
db.close();
