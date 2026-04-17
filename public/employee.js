document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) { window.location.href = '/'; return; }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'EMPLOYEE') { window.location.href = '/'; return; }
    
    document.getElementById('user-name').textContent = user.full_name;
    
    // Setup Date constraint (Minimum tomorrow 24hr block)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('booking-date').min = tomorrow.toISOString().split('T')[0];

    // Load Rooms
    try {
        const roomRes = await fetch('/api/rooms');
        const rooms = await roomRes.json();
        const roomSelect = document.getElementById('room-select');
        roomSelect.innerHTML = '';
        rooms.forEach(r => {
            roomSelect.innerHTML += `<option value="${r.id}">${r.name} (${r.room_type})</option>`;
        });
    } catch (e) {
        console.error(e);
    }

    // Load User Requests
    const loadRequests = async () => {
        try {
            const res = await fetch(`/api/bookings?user_id=${user.id}`);
            const bookings = await res.json();
            const list = document.getElementById('requests-list');
            list.innerHTML = '';
            bookings.forEach(b => {
                list.innerHTML += `
                    <tr>
                        <td>${b.booking_date}</td>
                        <td>${b.time_slot}</td>
                        <td>${b.room_name}</td>
                        <td class="status-${b.status}"><b>${b.status}</b></td>
                        <td>${b.admin_note || '-'}</td>
                    </tr>
                `;
            });
            if(bookings.length === 0) list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No requests yet. Data is hidden to prevent sniping!</td></tr>';
        } catch (e) {
            console.error(e);
        }
    };
    loadRequests();

    // Submit Booking Request
    document.getElementById('booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.innerHTML = 'Sending...';
        
        const data = {
            user_id: user.id,
            room_id: document.getElementById('room-select').value,
            booking_date: document.getElementById('booking-date').value,
            time_slot: document.getElementById('time-slot').value,
            purpose: document.getElementById('purpose').value
        };

        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                alert('Request Submitted Successfully! Wait for admin approval.');
                loadRequests();
                document.getElementById('purpose').value = '';
            }
        } catch (error) {
            alert('Error submitting request');
        } finally {
            btn.innerHTML = 'Submit Request';
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = '/';
    });
});
