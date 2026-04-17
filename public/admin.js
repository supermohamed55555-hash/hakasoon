let currentRejectId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr || JSON.parse(userStr).role !== 'ADMIN') { window.location.href = '/'; return; }
    
    document.getElementById('user-name').textContent = JSON.parse(userStr).full_name;

    const today = new Date().toISOString().split('T')[0];
    const reportPicker = document.getElementById('report-date-picker');
    if(reportPicker) reportPicker.value = today;

    const loadAllData = () => {
        loadDailySchedule();
        loadPendingRequests();
        loadNotifications();
        loadStats();
        loadBuildingsSelect();
    };

    window.loadDailySchedule = async () => {
        try {
            const date = document.getElementById('report-date-picker').value;
            const res = await fetch(`/api/bookings?date=${date}`);
            const bookings = await res.json();
            const list = document.getElementById('daily-schedule-list');
            list.innerHTML = '';

            const approvedOnes = (bookings || []).filter(b => b.status === 'APPROVED');
            if(approvedOnes.length === 0) {
                list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No confirmed bookings for this day.</td></tr>';
            } else {
                approvedOnes.forEach(b => {
                    list.innerHTML += `
                        <tr>
                            <td>${b.time_slot}</td>
                            <td>${b.room_name}</td>
                            <td>${b.purpose}</td>
                            <td>${b.user_name}</td>
                            <td>${b.building_name}</td>
                        </tr>
                    `;
                });
            }
        } catch(e) {}
    };

    window.loadPendingRequests = async () => {
        try {
            const res = await fetch('/api/bookings');
            const data = await res.json();
            const list = document.getElementById('pending-requests-list');
            list.innerHTML = '';
            
            const pending = (data || []).filter(b => b.status === 'PENDING_ADMIN');
            if(pending.length === 0) {
                list.innerHTML = '<tr><td colspan="6" style="text-align:center;">No pending requests.</td></tr>';
            } else {
                pending.forEach(b => {
                    list.innerHTML += `
                        <tr>
                            <td>${b.user_name}</td>
                            <td>${b.building_name}</td>
                            <td>${b.room_name}</td>
                            <td>${b.booking_date}</td>
                            <td>${b.time_slot}</td>
                            <td>
                                <button class="action-btn approve-btn" onclick="handleApprove(${b.id})">Pass</button>
                                <button class="action-btn reject-btn" onclick="openRejectModal(${b.id})">Reject</button>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch(e) {}
    };

    window.loadNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            const tray = document.getElementById('notifications-list');
            tray.innerHTML = '';
            if(!data || data.length === 0) {
                tray.innerHTML = '<p style="font-size: 11px; text-align: center; color: #8a96b3;">No final approvals.</p>';
            } else {
                data.forEach(n => {
                    tray.innerHTML += `
                        <div class="notif-item">
                            ${n.room_number} for "${n.purpose}" on <b>${n.booking_date}</b> (${n.time_slot}) by ${n.full_name}
                        </div>
                    `;
                });
            }
        } catch(e) {}
    };

    const loadStats = async () => {
        try {
            const bRes = await fetch('/api/buildings');
            const rRes = await fetch('/api/rooms');
            const bookRes = await fetch('/api/bookings');
            const buildings = await bRes.json();
            const rooms = await rRes.json();
            const bookings = await bookRes.json();
            
            document.getElementById('stat-buildings').textContent = buildings.length;
            document.getElementById('stat-rooms').textContent = rooms.length;
            document.getElementById('stat-pending').textContent = (bookings || []).filter(b => b.status === 'PENDING_ADMIN').length;
        } catch(e) {}
    };

    const loadBuildingsSelect = async () => {
        try {
            const res = await fetch('/api/buildings');
            const data = await res.json();
            const select = document.getElementById('r-building');
            if(select) {
                select.innerHTML = '<option value="">Select Building</option>';
                data.forEach(b => select.innerHTML += `<option value="${b.id}">${b.name}</option>`);
            }
        } catch(e) {}
    };

    // Date Picker event
    if(reportPicker) reportPicker.addEventListener('change', loadDailySchedule);

    // Forms
    document.getElementById('add-building-form').onsubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('/api/buildings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: document.getElementById('b-name').value,
                total_rooms: document.getElementById('b-rooms').value,
                creation_date: document.getElementById('b-date').value
            })
        });
        if(res.ok) { alert("Building Registered!"); loadStats(); loadBuildingsSelect(); e.target.reset(); }
    };

    document.getElementById('add-room-form').onsubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                building_id: document.getElementById('r-building').value,
                room_number: document.getElementById('r-number').value,
                room_type: document.getElementById('r-type').value,
                capacity: document.getElementById('r-capacity').value
            })
        });
        if(res.ok) { alert("Room Added!"); loadStats(); e.target.reset(); }
    };

    window.handleApprove = async (id) => {
        const res = await fetch(`/api/bookings/${id}/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: 'PENDING_MANAGER', role: 'ADMIN' })
        });
        if(res.ok) { alert("Forwarded!"); loadAllData(); }
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
            loadAllData(); 
        }
    };

    // Initial Load
    loadAllData();
    setInterval(loadNotifications, 10000); 

    document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('currentUser'); window.location.href='/'; };
});
