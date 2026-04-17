document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('academic-email');
    const idInput = document.getElementById('employee-id');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.toLowerCase();
        const empId = idInput.value;

        // Front-end ID Length Check
        if (empId.length !== 9) {
            showError("❌ Error: Academic ID must be exactly 9 digits.");
            return;
        }

        try {
            // Call the dynamic login/auto-register API
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, employee_id: empId })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Success: Redirect based on role
                let destination = '/';
                if (result.role === 'ADMIN') destination = 'admin.html';
                else if (result.role === 'BRANCH_MANAGER') destination = 'manager.html';
                else if (result.role === 'EMPLOYEE' || result.role === 'SECRETARY') destination = 'employee.html';

                localStorage.setItem('currentUser', JSON.stringify(result));
                window.location.href = destination;
            } else {
                showError(`❌ ${result.error || 'Access Denied'}`);
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
