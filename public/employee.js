document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) { window.location.href = '/'; return; }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'EMPLOYEE' && user.role !== 'SECRETARY') { window.location.href = '/'; return; }
    
    document.getElementById('user-name').textContent = `${user.full_name} (${user.role})`;
    
    const dateInput = document.getElementById('booking-date');
    const roomSelect = document.getElementById('room-select');
    const mpFields = document.getElementById('multi-purpose-fields');

    // Helper to calculate min date
    const setMinDate = (hours) => {
        const minDate = new Date();
        minDate.setHours(minDate.getHours() + hours);
        dateInput.min = minDate.toISOString().split('T')[0];
        if (dateInput.value && dateInput.value < dateInput.min) dateInput.value = '';
    };

    setMinDate(24);

    // Filter/Load Rooms
    try {
        const roomRes = await fetch('/api/rooms');
        const rooms = await roomRes.json();
        roomSelect.innerHTML = '<option value="">Select Room</option>';
        rooms.forEach(r => {
            if (user.role === 'SECRETARY' && r.room_type !== 'MULTI_PURPOSE') return;
            roomSelect.innerHTML += `<option value="${r.id}" data-type="${r.room_type}">${r.building_name} - ${r.room_number} (${r.room_type})</option>`;
        });
    } catch (e) { console.error(e); }

    roomSelect.addEventListener('change', () => {
        const selected = roomSelect.options[roomSelect.selectedIndex];
        const type = selected.getAttribute('data-type');
        if (type === 'MULTI_PURPOSE') {
            setMinDate(48);
            mpFields.style.display = 'block';
        } else {
            setMinDate(24);
            mpFields.style.display = 'none';
        }
    });

    // Handle form submit
    document.getElementById('booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        btn.textContent = 'Sending...';
        btn.disabled = true;

        const data = {
            user_id: user.id,
            room_id: roomSelect.value,
            booking_date: dateInput.value,
            time_slot: document.getElementById('time-slot').value,
            purpose: document.getElementById('purpose').value,
            event_manager_name: document.getElementById('em-name').value,
            event_manager_title: document.getElementById('em-title').value,
            tech_requirements: document.getElementById('tech-req').value
        };

        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (res.ok) {
                alert('✅ Official Request Submitted Successfully!');
                loadRequests();
                document.getElementById('booking-form').reset();
                mpFields.style.display = 'none';
            } else if (res.status === 409 && result.suggestions && result.suggestions.length > 0) {
                // SUGGESTION FEATURE
                let suggestionList = result.suggestions.map(s => `• ${s.building_name}: ${s.room_number}`).join('\n');
                let confirmChoice = confirm(`${result.error}\n\nWe found these alternative rooms available at the same time:\n${suggestionList}\n\nWould you like us to select the first suggestion for you?`);
                
                if (confirmChoice) {
                    roomSelect.value = result.suggestions[0].id;
                    alert("Room updated to " + result.suggestions[0].room_number + ". Please click Submit again.");
                }
            } else {
                alert(`❌ Access Denied: ${result.error || 'System error'}`);
            }
        } catch (error) { alert('❌ Connection Timeout: Please check your network.'); }
        btn.textContent = 'Submit Official Request';
        btn.disabled = false;
    });

    const loadRequests = async () => {
        try {
            const res = await fetch(`/api/bookings?user_id=${user.id}`);
            const bookings = await res.json();
            const list = document.getElementById('requests-list');
            list.innerHTML = '';
            if(bookings.length === 0) { list.innerHTML = '<tr><td colspan="5">No requests yet.</td></tr>'; return; }
            bookings.forEach(b => {
                list.innerHTML += `
                    <tr>
                        <td>${b.booking_date}</td>
                        <td>${b.time_slot}</td>
                        <td>${b.building_name} - ${b.room_name}</td>
                        <td class="status-${b.status}"><b>${b.status.replace('_',' ')}</b></td>
                        <td style="font-size: 13px;">${b.admin_note || '-'}</td>
                    </tr>
                `;
            });
        } catch (e) {}
    };

    loadRequests();
    document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('currentUser'); window.location.href='/'; };
});
