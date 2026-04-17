let currentRejectId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) { window.location.href = '/'; return; }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'ADMIN') { window.location.href = '/'; return; }
    
    document.getElementById('user-name').textContent = user.full_name;

    window.loadAllBookings = async () => {
        try {
            const res = await fetch('/api/bookings');
            const bookings = await res.json();
            const list = document.getElementById('bookings-list');
            list.innerHTML = '';
            bookings.forEach(b => {
                let actions = '';
                if (b.status === 'PENDING') {
                    // Only show actions for pending requests
                    actions = `
                        <button class="action-btn approve-btn" onclick="handleApprove(${b.id})">Approve</button>
                        <button class="action-btn reject-btn" onclick="openRejectModal(${b.id})">Reject</button>
                    `;
                } else if (b.admin_note) {
                    actions = `<span style="font-size: 13px; color: #8a96b3;">Note: ${b.admin_note}</span>`;
                } else if (b.status === 'APPROVED' && b.purpose.includes('Fixed')) {
                    actions = `<span style="font-size: 13px; color: #00e5ff;">University Fixed Schedule</span>`;
                }

                list.innerHTML += `
                    <tr>
                        <td>${b.booking_date}</td>
                        <td>${b.time_slot}</td>
                        <td>${b.room_name}</td>
                        <td>${b.user_name}</td>
                        <td>${b.purpose || '-'}</td>
                        <td class="status-${b.status}">${b.status}</td>
                        <td>${actions}</td>
                    </tr>
                `;
            });
            if(bookings.length === 0) list.innerHTML = '<tr><td colspan="7" style="text-align:center;">No bookings found.</td></tr>';
        } catch (e) {
            console.error(e);
        }
    };

    loadAllBookings();

    // Logic for Approve
    window.handleApprove = async (id) => {
        if(!confirm("Are you sure you want to approve this booking?")) return;
        
        try {
            const res = await fetch(`/api/bookings/${id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'APPROVED', admin_note: null })
            });
            const data = await res.json();
            
            if (!res.ok) {
                // THIS IS THE CONFLICT ENGINE KICKING IN!
                alert("❌ HACKATHON CORE FEATURE:\n" + data.error); 
            } else {
                alert("✅ Booking Approved Successfully!");
                loadAllBookings();
            }
        } catch(e) {
            console.error(e);
        }
    };

    // Logic for Reject Modal
    window.openRejectModal = (id) => {
        currentRejectId = id;
        document.getElementById('reject-reason').value = '';
        document.getElementById('rejectModal').style.display = 'flex';
    };

    document.getElementById('confirm-reject').addEventListener('click', async () => {
        const note = document.getElementById('reject-reason').value;
        if(!note) { alert("Please provide a reason!"); return; }
        
        try {
            const res = await fetch(`/api/bookings/${currentRejectId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'REJECTED', admin_note: note })
            });
            
            if (res.ok) {
                document.getElementById('rejectModal').style.display = 'none';
                alert("Booking Rejected!");
                loadAllBookings();
            }
        } catch(e) {
            console.error(e);
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = '/';
    });
});
