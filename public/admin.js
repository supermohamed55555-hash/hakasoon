let currentRejectId = null;

async function apiFetch(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error(`Fetch failed ${url}:`, e);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr || JSON.parse(userStr).role !== 'ADMIN') { window.location.href = '/'; return; }
    
    document.getElementById('user-name').textContent = JSON.parse(userStr).full_name;
    const today = new Date().toISOString().split('T')[0];
    const reportPicker = document.getElementById('report-date-picker');
    if(reportPicker) reportPicker.value = today;

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

    const loadNotifications = async () => {
        const data = await apiFetch('/api/notifications');
        const tray = document.getElementById('notifications-list');
        if (!tray) return;
        tray.innerHTML = '';
        if (!data || data.length === 0) {
            tray.innerHTML = '<p style="font-size: 12px; text-align: center; color: #8a96b3;">No final approvals.</p>';
        } else {
            data.forEach(n => {
                tray.innerHTML += `<div class="notif-item"><b>${n.room_number}:</b> Finalized on ${n.booking_date}</div>`;
            });
        }
    };

    const loadStats = async () => {
        const buildings = await apiFetch('/api/buildings');
        const rooms = await apiFetch('/api/rooms');
        const bookings = await apiFetch('/api/bookings');
        if (buildings) document.getElementById('stat-buildings').textContent = buildings.length;
        if (rooms) document.getElementById('stat-rooms').textContent = rooms.length;
        if (bookings) document.getElementById('stat-pending').textContent = bookings.filter(b => b.status === 'PENDING_ADMIN').length;
    };

    const loadAll = () => { loadDailySchedule(); loadPendingRequests(); loadNotifications(); loadStats(); };

    if (reportPicker) reportPicker.addEventListener('change', loadDailySchedule);

    loadAll();
    setInterval(loadNotifications, 10000); 

    window.handleApprove = async (id) => {
        const res = await fetch(`/api/bookings/${id}/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: 'PENDING_MANAGER', role: 'ADMIN' })
        });
        if(res.ok) { alert("Forwarded to Manager!"); loadAll(); }
    };

    window.openRejectModal = (id) => {
        currentRejectId = id;
        document.getElementById('rejectModal').style.display = 'flex';
    };

    document.getElementById('confirm-reject').onclick = async () => {
        const note = document.getElementById('reject-reason').value;
        const res = await fetch(`/api/bookings/${currentRejectId}/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: 'REJECTED', admin_note: note, role: 'ADMIN' })
        });
        if(res.ok) { 
            document.getElementById('rejectModal').style.display = 'none'; 
            document.getElementById('reject-reason').value = '';
            loadAll(); 
        }
    };

    document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('currentUser'); window.location.href='/'; };
});
