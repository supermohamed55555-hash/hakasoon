let currentRejectId = null;

// Global fetch helper for debugging
async function apiFetch(url) {
    try {
        console.log(`Fetching: ${url}`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error(`Fetch failed for ${url}:`, e);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Admin Dashboard Initializing...");
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) { window.location.href = '/'; return; }
    const user = JSON.parse(userStr);
    if (user.role !== 'ADMIN') { window.location.href = '/'; return; }

    document.getElementById('user-name').textContent = user.full_name;

    const today = new Date().toISOString().split('T')[0];
    const reportPicker = document.getElementById('report-date-picker');
    if (reportPicker) reportPicker.value = today;

    // Load Buildings into Selection Dropdown
    const loadBuildingsSelect = async () => {
        const buildings = await apiFetch('/api/buildings');
        const select = document.getElementById('r-building');
        if (select && buildings) {
            console.log("Buildings loaded into select:", buildings.length);
            select.innerHTML = '<option value="">Select Building</option>';
            buildings.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = b.name;
                select.appendChild(opt);
            });
        }
    };

    // Load Schedule Report
    const loadDailySchedule = async () => {
        const date = document.getElementById('report-date-picker').value;
        const bookings = await apiFetch(`/api/bookings?date=${date}`);
        const list = document.getElementById('daily-schedule-list');
        if (!list) return;
        list.innerHTML = '';
        const approved = (bookings || []).filter(b => b.status === 'APPROVED');
        if (!approved.length) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No confirmed bookings for this day.</td></tr>';
        } else {
            approved.forEach(b => {
                list.innerHTML += `<tr><td>${b.time_slot}</td><td>${b.room_name}</td><td>${b.purpose}</td><td>${b.user_name}</td><td>${b.building_name}</td></tr>`;
            });
        }
    };

    // Load Pending Approval Requests
    const loadPendingRequests = async () => {
        const bookings = await apiFetch('/api/bookings');
        const list = document.getElementById('pending-requests-list');
        if (!list) return;
        list.innerHTML = '';
        const pending = (bookings || []).filter(b => b.status === 'PENDING_ADMIN');
        if (!pending.length) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center;">No pending requests.</td></tr>';
        } else {
            pending.forEach(b => {
                list.innerHTML += `
                    <tr>
                        <td>${b.user_name}</td><td>${b.building_name}</td><td>${b.room_name}</td>
                        <td>${b.booking_date}</td><td>${b.time_slot}</td>
                        <td>
                            <button class="action-btn approve-btn" onclick="handleApprove(${b.id})">Pass</button>
                            <button class="action-btn reject-btn" onclick="openRejectModal(${b.id})">Reject</button>
                        </td>
                    </tr>
                `;
            });
        }
    };

    // Load Finalized Notifications
    const loadNotifications = async () => {
        const data = await apiFetch('/api/notifications');
        const tray = document.getElementById('notifications-list');
        if (!tray) return;
        tray.innerHTML = '';
        if (!data || data.length === 0) {
            tray.innerHTML = '<p style="font-size: 11px; text-align: center; color: #8a96b3;">No final approvals.</p>';
        } else {
            data.forEach(n => {
                tray.innerHTML += `<div class="notif-item">${n.room_number} for "${n.purpose}" on <b>${n.booking_date}</b> by ${n.full_name}</div>`;
            });
        }
    };

    // Update Statistical Counters
    const loadStats = async () => {
        const buildings = await apiFetch('/api/buildings');
        const rooms = await apiFetch('/api/rooms');
        const bookings = await apiFetch('/api/bookings');

        if (buildings && document.getElementById('stat-buildings')) document.getElementById('stat-buildings').textContent = buildings.length;
        if (rooms && document.getElementById('stat-rooms')) document.getElementById('stat-rooms').textContent = rooms.length;
        if (bookings && document.getElementById('stat-pending'))
            document.getElementById('stat-pending').textContent = bookings.filter(b => b.status === 'PENDING_ADMIN').length;
    };

    const loadAll = () => {
        loadDailySchedule();
        loadPendingRequests();
        loadNotifications();
        loadStats();
        loadBuildingsSelect();
    };

    if (reportPicker) reportPicker.addEventListener('change', loadDailySchedule);

    // Initial Execute
    loadAll();
    setInterval(loadNotifications, 10000);

    // Forms
    document.getElementById('add-building-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('b-name').value,
            total_rooms: document.getElementById('b-rooms').value,
            creation_date: document.getElementById('b-date').value
        };
        const res = await fetch('/api/buildings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            alert("Building Registered!");
            e.target.reset();
            loadAll();
        }
    };

    document.getElementById('add-room-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            building_id: document.getElementById('r-building').value,
            room_number: document.getElementById('r-number').value,
            room_type: document.getElementById('r-type').value,
            capacity: document.getElementById('r-capacity').value
        };
        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            alert("Room Added!");
            e.target.reset();
            loadAll();
        }
    };

    window.handleApprove = async (id) => {
        const res = await fetch(`/api/bookings/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PENDING_MANAGER', role: 'ADMIN' })
        });
        if (res.ok) { alert("Forwarded to Manager!"); loadAll(); }
    };

    window.openRejectModal = (id) => {
        currentRejectId = id;
        document.getElementById('rejectModal').style.display = 'flex';
    };

    document.getElementById('confirm-reject').onclick = async () => {
        const note = document.getElementById('reject-reason').value;
        const res = await fetch(`/api/bookings/${currentRejectId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'REJECTED', admin_note: note, role: 'ADMIN' })
        });
        if (res.ok) {
            document.getElementById('rejectModal').style.display = 'none';
            document.getElementById('reject-reason').value = '';
            loadAll();
        }
    };

    document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('currentUser'); window.location.href = '/'; };
});
