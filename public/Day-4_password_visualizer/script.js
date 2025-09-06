document.addEventListener('DOMContentLoaded', function() {
            const passwordInput = document.getElementById('passwordInput');
            const togglePassword = document.getElementById('togglePassword');
            const strengthFill = document.getElementById('strengthFill');
            const strengthText = document.getElementById('strengthText');
            const scoreNumber = document.getElementById('scoreNumber');
            const criteriaList = document.getElementById('criteriaList');
            
            // Common passwords to check against
            const commonPasswords = [
                'password', '123456', '12345678', 'qwerty', 'abc123', 
                'password1', 'admin', 'letmein', 'welcome', 'monkey'
            ];
            
            // Toggle password visibility
            togglePassword.addEventListener('click', function() {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    togglePassword.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    passwordInput.type = 'password';
                    togglePassword.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
            
            // Check password strength as user types
            passwordInput.addEventListener('input', checkPasswordStrength);
            
            function checkPasswordStrength() {
                const password = passwordInput.value;
                let strength = 0;
                let totalCriteria = 0;
                let metCriteria = 0;
                
                // Reset all criteria
                document.querySelectorAll('.criteria-item').forEach(item => {
                    item.classList.remove('met');
                    const icon = item.querySelector('.criteria-icon');
                    icon.className = 'criteria-icon not-met';
                    icon.textContent = '✗';
                });
                
                // Check length
                totalCriteria++;
                if (password.length >= 8) {
                    strength += 20;
                    updateCriteria('length', true);
                    metCriteria++;
                } else {
                    updateCriteria('length', false);
                }
                
                // Check uppercase letters
                totalCriteria++;
                if (/[A-Z]/.test(password)) {
                    strength += 20;
                    updateCriteria('uppercase', true);
                    metCriteria++;
                } else {
                    updateCriteria('uppercase', false);
                }
                
                // Check lowercase letters
                totalCriteria++;
                if (/[a-z]/.test(password)) {
                    strength += 20;
                    updateCriteria('lowercase', true);
                    metCriteria++;
                } else {
                    updateCriteria('lowercase', false);
                }
                
                // Check numbers
                totalCriteria++;
                if (/[0-9]/.test(password)) {
                    strength += 20;
                    updateCriteria('numbers', true);
                    metCriteria++;
                } else {
                    updateCriteria('numbers', false);
                }
                
                // Check special characters
                totalCriteria++;
                if (/[!@#$%^&*]/.test(password)) {
                    strength += 20;
                    updateCriteria('special', true);
                    metCriteria++;
                } else {
                    updateCriteria('special', false);
                }
                
                // Check if not common password
                totalCriteria++;
                if (!commonPasswords.includes(password.toLowerCase())) {
                    strength += 20;
                    updateCriteria('common', true);
                    metCriteria++;
                } else {
                    updateCriteria('common', false);
                }
                
                // Update strength bar and text
                updateStrengthIndicator(strength, metCriteria, totalCriteria);
                
                // Update score
                scoreNumber.textContent = Math.round(strength);
            }
            
            function updateCriteria(criteria, isMet) {
                const item = document.querySelector(`[data-criteria="${criteria}"]`);
                const icon = item.querySelector('.criteria-icon');
                
                if (isMet) {
                    item.classList.add('met');
                    icon.className = 'criteria-icon met';
                    icon.textContent = '✓';
                } else {
                    item.classList.remove('met');
                    icon.className = 'criteria-icon not-met';
                    icon.textContent = '✗';
                }
            }
            
            function updateStrengthIndicator(strength, metCriteria, totalCriteria) {
                // Update the width and color of the strength bar
                let strengthClass = '';
                
                if (strength <= 20) {
                    strengthClass = 'very-weak';
                    strengthText.textContent = 'Very Weak';
                    strengthText.style.color = '#e74c3c';
                } else if (strength <= 40) {
                    strengthClass = 'weak';
                    strengthText.textContent = 'Weak';
                    strengthText.style.color = '#e67e22';
                } else if (strength <= 60) {
                    strengthClass = 'medium';
                    strengthText.textContent = 'Medium';
                    strengthText.style.color = '#f1c40f';
                } else if (strength <= 80) {
                    strengthClass = 'strong';
                    strengthText.textContent = 'Strong';
                    strengthText.style.color = '#2ecc71';
                } else {
                    strengthClass = 'very-strong';
                    strengthText.textContent = 'Very Strong';
                    strengthText.style.color = '#27ae60';
                }
                
                // Update the strength bar
                strengthFill.className = 'strength-fill ' + strengthClass;
                
                // Add more detailed text for very strong passwords
                if (metCriteria === totalCriteria && strength >= 100) {
                    strengthText.textContent = 'Excellent! This password is very secure';
                }
            }
        });