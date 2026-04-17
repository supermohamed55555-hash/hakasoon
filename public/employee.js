document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) { window.location.href = '/'; return; }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'EMPLOYEE' && user.role !== 'SECRETARY') { window.location.href = '/'; return; }
    
    document.getElementById('user-name').textContent = `${user.full_name} (${user.role})`;
    
    const dateInput = document.getElementById('booking-date');
    const roomSelect = document.getElementById('room-select');
    let allRooms = [];

    // Helper to calculate min date
    const setMinDate = (hours) => {
        const minDate = new Date();
        minDate.setHours(minDate.getHours() + hours);
        dateInput.min = minDate.toISOString().split('T')[0];
        // Reset date if it's now invalid
        if (dateInput.value && dateInput.value < dateInput.min) {
            dateInput.value = '';
        }
    };

    // Default min date (24h)
    setMinDate(24);

    // Filter/Load Rooms
    try {
        const roomRes = await fetch('/api/rooms');
        allRooms = await roomRes.json();
        
        roomSelect.innerHTML = '';
        allRooms.forEach(r => {
            // Logic: Secretary can ONLY see MULTI_PURPOSE
            if (user.role === 'SECRETARY' && r.room_type !== 'MULTI_PURPOSE') return;
            roomSelect.innerHTML += `<option value="${r.id}" data-type="${r.room_type}">${r.building_name} - ${r.room_number} (${r.room_type})</option>`;
        });
    } catch (e) {
        console.error(e);
    }

    // Room choice affects date limit
    roomSelect.addEventListener('change', () => {
        const selectedOption = roomSelect.options[roomSelect.selectedIndex];
        const type = selectedOption.getAttribute('data-type');
        
        if (type === 'MULTI_PURPOSE') {
            setMinDate(48); // 48h limit
            console.log("Setting 48h limit for Multi-Purpose");
        } else {
            setMinDate(24); // 24h limit
        }
    });

    // Load User Requests
    const loadRequests = async () => {
        try {
            const res = await fetch(`/api/bookings?user_id=${user.id}`);
            const bookings = await res.json();
            const list = document.getElementById('requests-list');
            list.innerHTML = '';
            bookings.forEach(b => {
                let statusLabel = b.status.replace('_', ' ');
                list.innerHTML += `
                    <tr>
                        <td>${b.booking_date}</td>
                        <td>${b.time_slot}</td>
                        <td>${b.room_name}</td>
                        <td class="status-${b.status}"><b>${statusLabel}</b></td>
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
            const result = await res.json();
            
            if (res.ok) {
                alert('✅ Success: ' + result.message);
                loadRequests();
                document.getElementById('purpose').value = '';
            } else if (result.error === 'CONFLICT') {
                alert(`❌ ${result.message}\n\n💡 ${result.suggestion}`);
            } else {
                alert('❌ Error: ' + (result.error || 'Submission failed'));
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
