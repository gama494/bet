document.addEventListener('DOMContentLoaded', () => {
    const crashPointInput = document.getElementById('crash-point-input');
    const setCrashPointBtn = document.getElementById('set-crash-point-btn');
    const crashNowBtn = document.getElementById('crash-now-btn');
    const statusMessage = document.getElementById('status-message');
    const confirmSound = document.getElementById('confirmSound');

    setCrashPointBtn.addEventListener('click', () => {
        const value = parseFloat(crashPointInput.value);

        if (isNaN(value) || value < 1.00) {
            displayMessage('Please enter a valid number >= 1.00', 'danger');
            return;
        }
        
        // Use localStorage to communicate with the game script
        localStorage.setItem('adminCrashOverride', value.toFixed(2));
        
        playSound();
        displayMessage(`Next round will crash at ${value.toFixed(2)}x`, 'success');
        crashPointInput.value = '';
    });

    crashNowBtn.addEventListener('click', () => {
        // Set a unique value each time to ensure the 'storage' event fires
        localStorage.setItem('adminForceCrashNow', Date.now());
        playSound();
        displayMessage('Sent instant crash command!', 'warning');
    });

    function playSound() {
        if (confirmSound) {
            confirmSound.currentTime = 0;
            confirmSound.play().catch(e => console.error("Audio playback failed:", e));
        }
    }

    function displayMessage(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `mt-3 text-center text-${type}`;

        setTimeout(() => {
            if (statusMessage.textContent === message) {
                 statusMessage.textContent = '';
                 statusMessage.className = 'mt-3';
            }
        }, 4000);
    }
});