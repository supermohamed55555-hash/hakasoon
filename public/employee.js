document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) { window.location.href = '/'; return; }
    
    const user = JSON.parse(userStr);
    const validRoles = ['EMPLOYEE', 'SECRETARY'];
    if (!validRoles.includes(user.role)) { window.location.href = '/'; return; }
    
    // Update Greeting
    const userDisplay = document.getElementById('user-name');
    if (userDisplay) userDisplay.textContent = `${user.full_name} (${user.role})`;
    
    const dateInput = document.getElementById('booking-date');
    const roomSelect = document.getElementById('room-select');
    const mpFields = document.getElementById('multi-purpose-fields');
    const submitBtn = document.getElementById('submit-btn');

    // Helper to calculate min date based on room type constraint
    const setMinDate = (hours) => {
        const minDate = new Date();
        minDate.setHours(minDate.getHours() + hours);
        if(dateInput) {
            dateInput.min = minDate.toISOString().split('T')[0];
            if (dateInput.value && dateInput.value < dateInput.min) dateInput.value = '';
        }
    };

    setMinDate(24);

    // Filter/Load Rooms
    const loadRooms = async () => {
        try {
            console.log("Loading rooms for role:", user.role);
            const res = await fetch('/api/rooms');
            if (!res.ok) throw new Error("Failed to fetch rooms");
            const rooms = await res.json();
            
            roomSelect.innerHTML = '<option value="">-- Choose a Facility --</option>';
            
            let count = 0;
            rooms.forEach(r => {
                // Secretary can only see Multi-Purpose
                if (user.role === 'SECRETARY' && r.room_type !== 'MULTI_PURPOSE') return;
                
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.dataset.type = r.room_type;
                opt.textContent = `${r.building_name} | ${r.room_number} (${r.room_type})`;
                roomSelect.appendChild(opt);
                count++;
            });
            console.log(`Loaded ${count} rooms.`);
        } catch (e) {
            console.error("Room Loading Error:", e);
            roomSelect.innerHTML = '<option value="">Error loading rooms</option>';
        }
    };

    await loadRooms();

    roomSelect.addEventListener('change', () => {
        const selected = roomSelect.options[roomSelect.selectedIndex];
        if(!selected || !selected.value) {
            mpFields.style.display = 'none';
            return;
        }
        const type = selected.dataset.type;
        if (type === 'MULTI_PURPOSE') {
            setMinDate(48);
            if(mpFields) mpFields.style.display = 'block';
        } else {
            setMinDate(24);
            if(mpFields) mpFields.style.display = 'none';
        }
    });

    // Handle form submit
    document.getElementById('booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;

        const data = {
            user_id: user.id,
            room_id: roomSelect.value,
            booking_date: dateInput.value,
            time_slot: document.getElementById('time-slot').value,
            purpose: document.getElementById('purpose').value,
            event_manager_name: document.getElementById('em-name')?.value || '',
            event_manager_title: document.getElementById('em-title')?.value || '',
            tech_requirements: document.getElementById('tech-req')?.value || ''
        };

        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (res.ok) {
                alert('✅ Request Submitted Successfully!');
                loadRequests();
                document.getElementById('booking-form').reset();
                if(mpFields) mpFields.style.display = 'none';
            } else if (res.status === 409 && result.suggestions) {
                let sList = result.suggestions.map(s => `• ${s.building_name}: ${s.room_number}`).join('\n');
                if (confirm(`${result.error}\n\nSuggested Availability:\n${sList}\n\nSwitch to the first suggestion?`)) {
                    roomSelect.value = result.suggestions[0].id;
                    alert("Room switched. Click Submit again.");
                }
            } else {
                alert(`❌ Error: ${result.error || 'Unknown error'}`);
            }
        } catch (error) { alert('❌ Server Error'); }
        submitBtn.textContent = 'Submit Official Request';
        submitBtn.disabled = false;
    });

    const loadRequests = async () => {
        const list = document.getElementById('requests-list');
        try {
            const res = await fetch(`/api/bookings?user_id=${user.id}`);
            const bookings = await res.json();
            list.innerHTML = '';
            if(!bookings || bookings.length === 0) {
                list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No history found.</td></tr>';
                return;
            }
            bookings.forEach(b => {
                list.innerHTML += `
                    <tr>
                        <td>${b.booking_date}</td>
                        <td>${b.time_slot}</td>
                        <td>${b.building_name} - ${b.room_name}</td>
                        <td><span class="status-${b.status}">${b.status.replace('_',' ')}</span></td>
                        <td style="font-size: 13px; color: #5e728d;">${b.admin_note || 'Waiting for review...'}</td>
                    </tr>
                `;
            });
        } catch (e) {
            list.innerHTML = '<tr><td colspan="5">Failed to load history.</td></tr>';
        }
    };

    loadRequests();
    
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) logoutBtn.onclick = () => { localStorage.removeItem('currentUser'); window.location.href='/'; };
});
