let currentRejectId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) { window.location.href = '/'; return; }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'BRANCH_MANAGER') { window.location.href = '/'; return; }
    
    document.getElementById('user-name').textContent = user.full_name;

    window.loadAllBookings = async () => {
        try {
            const res = await fetch('/api/bookings');
            const bookings = await res.json();
            const list = document.getElementById('bookings-list');
            list.innerHTML = '';
            bookings.forEach(b => {
                let actions = '';
                if (b.status === 'PENDING_MANAGER') {
                    actions = `
                        <button class="action-btn approve-btn" onclick="handleApprove(${b.id})">Final Approve</button>
                        <button class="action-btn reject-btn" onclick="openRejectModal(${b.id})">Reject</button>
                    `;
                } else if (b.status === 'PENDING_ADMIN') {
                     actions = `<span style="font-size: 13px; color: #f39c12;">Waiting for Admin</span>`;
                }

                list.innerHTML += `
                    <tr>
                        <td>${b.booking_date}</td>
                        <td>${b.time_slot}</td>
                        <td>${b.room_name}</td>
                        <td>${b.user_name}</td>
                        <td>${b.purpose || '-'}</td>
                        <td class="status-${b.status}">${b.status.replace('_', ' ')}</td>
                        <td>${actions}</td>
                    </tr>
                `;
            });
            if(bookings.length === 0) list.innerHTML = '<tr><td colspan="7" style="text-align:center;">No pending requests found.</td></tr>';
        } catch (e) {
            console.error(e);
        }
    };

    loadAllBookings();

    window.handleApprove = async (id) => {
        if(!confirm("Give final approval to this booking?")) return;
        
        try {
            const res = await fetch(`/api/bookings/${id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'APPROVED', admin_note: null, role: 'BRANCH_MANAGER' })
            });
            const data = await res.json();
            
            if (!res.ok) {
                if (data.error === 'CONFLICT') {
                    alert(`❌ ${data.message}\n\n💡 ${data.suggestion}`);
                } else {
                    alert("❌ Error:\n" + data.error);
                }
            } else {
                alert("✅ Booking fully approved and finalized!");
                loadAllBookings();
            }
        } catch(e) {
            console.error(e);
        }
    };

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
                body: JSON.stringify({ status: 'REJECTED', admin_note: note, role: 'BRANCH_MANAGER' })
            });
            
            if (res.ok) {
                document.getElementById('rejectModal').style.display = 'none';
                alert("Final Rejection Sent.");
                loadAllBookings();
            }
        } catch(e) {
            console.error(e);
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = '/';
    });
});
