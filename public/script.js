document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const employeeIdInput = document.getElementById('employee-id');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const empId = employeeIdInput.value.trim();
        
        // Hide error message initially
        errorMessage.className = 'error-hidden';
        
        try {
            // Fetch users from our Phase 1 API
            const response = await fetch('/api/users');
            const users = await response.json();
            
            // Hackathon logic: Match by Employee ID
            const user = users.find(u => u.employee_id === empId);
            
            if (user) {
                // Success: Save user to localStorage
                localStorage.setItem('currentUser', JSON.stringify(user));
                
                // Add a cool transition effect before redirecting
                document.querySelector('.glass-panel').style.transition = 'all 0.6s ease';
                document.querySelector('.glass-panel').style.transform = 'scale(0.85)';
                document.querySelector('.glass-panel').style.opacity = '0';
                
                // Redirection logic (We will create these HTML files next)
                setTimeout(() => {
                    if (user.role === 'ADMIN') {
                        window.location.href = '/admin.html';
                    } else {
                        window.location.href = '/employee.html';
                    }
                }, 600);
                
            } else {
                // Failure
                errorMessage.className = 'error-visible';
            }
        } catch (error) {
            console.error("API Error:", error);
            errorMessage.textContent = 'Server connection error. Is backend running?';
            errorMessage.className = 'error-visible';
        }
    });

    // Add subtle interactive animation for input fields
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            document.querySelector('.hologram-ring').style.animationDuration = '4s'; // Spin faster
        });
        input.addEventListener('blur', () => {
            document.querySelector('.hologram-ring').style.animationDuration = '10s'; // Back to normal
        });
    });
});
