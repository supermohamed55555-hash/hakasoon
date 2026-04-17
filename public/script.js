document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('academic-email');
    const idInput = document.getElementById('employee-id');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.toLowerCase();
        const empId = idInput.value;

        // 1. Frontend Validation: Domain Check
        const validDomains = [
            '@scertary.aast.edu',
            '@admin.aast.edu',
            '@manager.aast.edu',
            '@staff.aast.edu'
        ];

        const hasValidDomain = validDomains.some(domain => email.endsWith(domain));
        
        // 2. Frontend Validation: ID Length Check
        if (empId.length !== 9) {
            showError("❌ Error: Academic ID must be exactly 9 digits.");
            return;
        }

        if (!hasValidDomain) {
            showError("❌ Access Denied: Unauthorized email domain.");
            return;
        }

        try {
            // 3. Backend Verification
            const response = await fetch('/api/users');
            const users = await response.json();
            
            const user = users.find(u => u.email === email && u.employee_id === empId);
            
            if (user) {
                // Determine destination based on role
                let destination = '/';
                if (user.role === 'ADMIN') destination = 'admin.html';
                else if (user.role === 'BRANCH_MANAGER') destination = 'manager.html';
                else if (user.role === 'EMPLOYEE' || user.role === 'SECRETARY') destination = 'employee.html';

                localStorage.setItem('currentUser', JSON.stringify(user));
                window.location.href = destination;
            } else {
                showError("❌ Error: Credentials not found in central database.");
            }
        } catch (error) {
            showError("❌ System Offline: Connection failed.");
        }
    });

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.className = 'error-visible';
        setTimeout(() => {
            errorMessage.className = 'error-hidden';
        }, 4000);
    }
});
