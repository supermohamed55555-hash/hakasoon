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
    if (!userStr) { window.location.href = '/'; return; }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'BRANCH_MANAGER') { window.location.href = '/'; return; }
    
    const mgmtDisplay = document.getElementById('mgmt-name');
    if (mgmtDisplay) mgmtDisplay.textContent = user.full_name;

    window.loadAllBookings = async () => {
        try {
            const bookings = await apiFetch('/api/bookings');
            const list = document.getElementById('manager-requests-list');
            if (!list) return;
            
            list.innerHTML = '';
            
            // Filter only what needs Manager attention
            const pending = (bookings || []).filter(b => b.status === 'PENDING_MANAGER');
            
            if (pending.length === 0) {
                list.innerHTML = '<tr><td colspan="6" style="text-align:center;">No pending authorizations in your queue.</td></tr>';
                return;
            }

            pending.forEach(b => {
                list.innerHTML += `
                    <tr>
                        <td>${b.user_name}</td>
                        <td>${b.building_name} | ${b.room_name}</td>
                        <td>${b.booking_date}</td>
                        <td>${b.time_slot}</td>
                        <td>${b.purpose || 'Official Use'}</td>
                        <td>
                            <button class="action-btn approve-btn" onclick="handleFinalApprove(${b.id})">Approve</button>
                            <button class="action-btn reject-btn" onclick="openRejectModal(${b.id})">Reject</button>
                        </td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error(e);
        }
    };

    window.handleFinalApprove = async (id) => {
        if(!confirm("Authorize final room confirmation?")) return;
        
        try {
            const res = await fetch(`/api/bookings/${id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'APPROVED', admin_note: null, role: 'BRANCH_MANAGER' })
            });
            
            if (res.ok) {
                alert("Authorization Successful: Booking Finalized.");
                loadAllBookings();
            } else {
                alert("Action failed. Please try again.");
            }
        } catch(e) { console.error(e); }
    };

    window.openRejectModal = (id) => {
        currentRejectId = id;
        const modal = document.getElementById('rejectModal');
        if (modal) {
            document.getElementById('reject-reason').value = '';
            modal.style.display = 'flex';
        }
    };

    document.getElementById('confirm-reject').onclick = async () => {
        const note = document.getElementById('reject-reason').value;
        if(!note) { alert("Please provide a reason for rejection."); return; }
        
        try {
            const res = await fetch(`/api/bookings/${currentRejectId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'REJECTED', admin_note: note, role: 'BRANCH_MANAGER' })
            });
            
            if (res.ok) {
                document.getElementById('rejectModal').style.display = 'none';
                alert("Authorization Declined.");
                loadAllBookings();
            }
        } catch(e) { console.error(e); }
    };

    loadAllBookings();
    setInterval(loadAllBookings, 15000); 

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            window.location.href = '/';
        });
    }
});
