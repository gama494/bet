
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const viewport = document.getElementById('game-viewport');
    const gameStateDisplay = document.getElementById('game-state-display');
    const multiplierEl = gameStateDisplay.querySelector('.multiplier');
    const bettingProgressContainer = document.getElementById('betting-progress-container');
    const countdownTimerEl = document.getElementById('countdown-timer');
    const bettingProgressBar = document.getElementById('betting-progress-bar');
    const oddsHistoryBar = document.getElementById('odds-history-bar');
    const showHistoryBtn = document.getElementById('show-history-btn');
    const oddsHistoryModal = new bootstrap.Modal(document.getElementById('oddsHistoryModal'));
    const oddsHistoryModalBody = document.getElementById('odds-history-modal-body');
    const balanceAmountEl = document.getElementById('balance-amount');
    const playerCountEl = document.getElementById('player-count');
    const totalBetAmountEl = document.getElementById('total-bet-amount');
    const liveBetsList = document.getElementById('live-bets-list');
    const myBetsContainer = document.getElementById('my-bets-list');
    const notificationContainer = document.getElementById('in-game-notifications');
    const crashSound = document.getElementById('crashSound');

    // Panel Toggles (for mobile)
    const toggleLeftPanelBtn = document.getElementById('toggle-left-panel-btn');
    const toggleRightPanelBtn = document.getElementById('toggle-right-panel-btn');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const closeLeftPanelBtn = document.getElementById('close-left-panel-btn');
    const closeRightPanelBtn = document.getElementById('close-right-panel-btn');


    // --- GAME STATE & CONFIG ---
    let gameState = 'LOADING'; // LOADING, WAITING, BETTING, RUNNING, CRASHED
    let multiplier = 1.00;
    let stateChangeTime = 0; // Will use Date.now() for persistence
    let plane = { x: 0, y: 0, rotation: 0, image: new Image() };
    let moon = { x: 0, y: 0, radius: 0 };
    let particles = [];
    let trailPoints = [];
    let stars = [];

    let oddsHistory = JSON.parse(localStorage.getItem('crashOddsHistory')) || [];
    let myBets = JSON.parse(localStorage.getItem('crashMyBets')) || [];
    let currentBalance = parseFloat(localStorage.getItem('crashBalance')) || 5000;
    
    let currentBets = {}; // { panelId: { amount: 100, status: 'pending' | 'cashed_out', cashoutAt: 2.5 } }
    let autoBetState = { 1: false, 2: false };
    let livePlayers = [];

    const BETTING_DURATION = 6000; // 6 seconds
    const PLANE_IMAGE_SRC = 'https://img.icons8.com/?size=100&id=WTxhy5HEcZ7d&format=png&color=00a8ff';
    let crashPoint = 1.00;
    let animationFrameId;
    let camera = { x: 0, y: 0, zoom: 1 };
    let explosion = null;

    // --- INITIALIZATION ---
    function init() {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        setupEventListeners();
        
        plane.image.onload = () => {
            attemptToResumeGame();
        };
        plane.image.onerror = () => {
            console.error("Failed to load plane image. Game will use a fallback shape.");
            attemptToResumeGame();
        };
        plane.image.src = PLANE_IMAGE_SRC;

        updateBalanceDisplay();
        updateOddsHistory();
        updateMyBetsHistory();

        requestAnimationFrame(gameLoop); // Start the main loop
    }
    
    /**
     * Checks sessionStorage for a running game state to resume from a page refresh.
     * If no game is running, it starts the normal game flow.
     */
    function attemptToResumeGame() {
        const savedStateJSON = sessionStorage.getItem('crashGameState');
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            const elapsed = Date.now() - savedState.roundStartTime;
            const currentMultiplier = calculateMultiplier(elapsed);

            if (currentMultiplier < savedState.crashPoint) {
                // Game is still running, jump right in
                window.savedGameState = {
                    stateChangeTime: savedState.roundStartTime,
                    crashPoint: savedState.crashPoint
                };
                changeState('RUNNING');
                return;
            }
        }
        // If no saved state, or saved state is for a crashed game, start fresh.
        sessionStorage.removeItem('crashGameState'); // Clean up old data
        changeState('WAITING');
    }

    function resizeCanvas() {
        canvas.width = viewport.clientWidth;
        canvas.height = viewport.clientHeight;
        createStars(); // Re-create stars for the new viewport size
        moon = { x: canvas.width * 0.8, y: canvas.height * 0.2, radius: Math.min(canvas.width, canvas.height) / 8 };
        resetGameVisuals(); // Reset visuals to adapt to new size
    }

    // --- GAME LOGIC & STATE MACHINE ---
    function changeState(newState) {
        if (gameState === newState && newState !== 'RUNNING') return; // Allow re-entry to RUNNING for persistence

        gameStateDisplay.classList.remove('crashed');
        viewport.classList.remove('shake');
        
        gameState = newState;

        switch (newState) {
            case 'WAITING':
                resetGameVisuals();
                multiplierEl.textContent = 'Waiting for next round...';
                multiplierEl.style.fontSize = 'clamp(1.5rem, 5vw, 2.5rem)';
                bettingProgressContainer.style.display = 'none';
                enableBetButtons();
                processAutoBets();
                setTimeout(() => changeState('BETTING'), 6000);
                break;
                
            case 'BETTING':
                stateChangeTime = Date.now(); // Start countdown timer
                resetGameVisuals();
                bettingProgressContainer.style.display = 'block';
                generateNewCrashPoint();
                enableBetButtons();
                break;

            case 'RUNNING':
                // Check if we are resuming a game from a refresh
                if (window.savedGameState) {
                    stateChangeTime = window.savedGameState.stateChangeTime;
                    crashPoint = window.savedGameState.crashPoint;
                    delete window.savedGameState;
                } else {
                    stateChangeTime = Date.now();
                }
                
                // Save state to sessionStorage for persistence
                const stateToSave = { roundStartTime: stateChangeTime, crashPoint: crashPoint };
                sessionStorage.setItem('crashGameState', JSON.stringify(stateToSave));

                bettingProgressContainer.style.display = 'none';
                gameStateDisplay.classList.remove('crashed');
                multiplierEl.style.fontSize = 'clamp(3rem, 10vw, 6rem)';
                lockBetButtons();
                spawnInitialLivePlayers();
                break;

            case 'CRASHED':
                 // Clean up session storage
                sessionStorage.removeItem('crashGameState');
                gameStateDisplay.classList.add('crashed');
                viewport.classList.add('shake');
                multiplierEl.textContent = `${crashPoint.toFixed(2)}x`;

                if (crashSound) {
                    crashSound.currentTime = 0;
                    crashSound.play().catch(error => console.error("Audio playback failed:", error));
                }

                Object.keys(currentBets).forEach(id => {
                    if (currentBets[id] && currentBets[id].status === 'pending') {
                        showNotification(`Bet lost.`, 'danger');
                        addMyBetHistory(currentBets[id].amount, 0, crashPoint);
                    }
                });
                
                addOddsHistory(crashPoint);
                currentBets = {};
                livePlayers.forEach(p => p.status = 'lost');
                createExplosion(plane.x, plane.y);
                setTimeout(() => changeState('WAITING'), 6000);
                break;
        }
    }

    // --- CORE GAME LOOP ---
    function gameLoop() {
        // Update game logic
        if (gameState === 'RUNNING') {
            const elapsed = Date.now() - stateChangeTime;
            updateMultiplier(elapsed);
            updatePlanePath(elapsed);
            updateCamera();
            checkAutoCashouts();
            checkLivePlayerCashouts();
            if (multiplier >= crashPoint) {
                changeState('CRASHED');
            }
        }
        
        // Update countdown UI
        if (gameState === 'BETTING') {
            updateUI();
        }
        
        // Always draw
        draw();

        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    // --- UPDATES (Called from gameLoop) ---
    function updateUI() {
        if (gameState === 'BETTING') {
            const elapsed = Date.now() - stateChangeTime;
            const remaining = Math.max(0, BETTING_DURATION - elapsed);
            const progress = (remaining / BETTING_DURATION) * 100;

            countdownTimerEl.textContent = (remaining / 1000).toFixed(1);
            bettingProgressBar.style.width = `${progress}%`;

            if (remaining <= 0) changeState('RUNNING');
        }
    }

    function updateMultiplier(elapsedTime) {
        const elapsedSeconds = elapsedTime / 1000;
        multiplier = 1 + 0.06 * Math.pow(elapsedSeconds, 1.5);
        multiplierEl.textContent = `${multiplier.toFixed(2)}x`;
        document.querySelectorAll('.bet-btn.cashout').forEach(btn => {
            const panelId = btn.dataset.panel;
            if(currentBets[panelId] && currentBets[panelId].status === 'pending') {
                const valueEl = btn.querySelector('.bet-btn-value');
                if (valueEl) {
                    valueEl.textContent = `MK ${(currentBets[panelId].amount * multiplier).toFixed(2)}`;
                }
            }
        });
    }

    function updatePlanePath(elapsedTime) {
        const time = elapsedTime / 1000;
        
        const p0 = { x: 50, y: canvas.height - 50 };
        const p1 = { x: canvas.width * 0.7, y: canvas.height * 0.8 };
        const p2 = { x: canvas.width * 5, y: -canvas.height * 4 };

        const t = Math.min(time / 20, 1);
        const prevX = plane.x, prevY = plane.y;
        plane.x = Math.pow(1 - t, 2) * p0.x + 2 * (1 - t) * t * p1.x + Math.pow(t, 2) * p2.x;
        plane.y = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;

        plane.rotation = Math.atan2(plane.y - prevY, plane.x - prevX);

        // Update trail points
        trailPoints.push({ x: plane.x, y: plane.y, alpha: 1 });
        if (trailPoints.length > 80) trailPoints.shift();
    }
    
    function updateCamera() {
        const targetZoom = 1 / (1 + Math.log10(Math.max(1, multiplier)) * 0.4);
        camera.zoom += (targetZoom - camera.zoom) * 0.05;
        camera.x += (plane.x - camera.x) * 0.1;
        camera.y += (plane.y - camera.y) * 0.1;
    }

    // --- DRAWING ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        drawStars();
        drawMoon();
        drawTrail();
        drawParticles();
        drawPlane();
        drawExplosion();
        
        ctx.restore();
    }

    function drawMoon() {
        const moonParallaxX = moon.x - (camera.x - plane.x) * 0.1; // Slow parallax
        const moonParallaxY = moon.y - (camera.y - plane.y) * 0.1;
        
        ctx.beginPath();
        const grad = ctx.createRadialGradient(moonParallaxX, moonParallaxY, moon.radius * 0.7, moonParallaxX, moonParallaxY, moon.radius);
        grad.addColorStop(0, 'rgba(255, 255, 240, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 240, 0)');
        ctx.fillStyle = grad;
        ctx.arc(moonParallaxX, moonParallaxY, moon.radius, 0, Math.PI * 2);
        ctx.fill();

        // Craters
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.arc(moonParallaxX + moon.radius * 0.4, moonParallaxY - moon.radius * 0.2, moon.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(moonParallaxX - moon.radius * 0.5, moonParallaxY - moon.radius * 0.1, moon.radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }
    
    function drawTrail() {
        if (trailPoints.length < 2) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
        for (let i = 1; i < trailPoints.length; i++) {
            const p = trailPoints[i];
            p.alpha -= 0.01; // Fade out over time
            ctx.lineTo(p.x, p.y);
        }
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(0, 180, 255, 0.8)";
        
        const gradient = ctx.createLinearGradient(trailPoints[0].x, 0, plane.x, 0);
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(1, `rgba(0, 200, 255, 0.7)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        // Cleanup faded points
        if(trailPoints[0] && trailPoints[0].alpha <= 0) trailPoints.shift();
    }
    
    function drawStars() {
        stars.forEach(layer => {
            ctx.fillStyle = layer.color;
            layer.stars.forEach(star => {
                const parallaxX = star.x - camera.x * layer.speed;
                const parallaxY = star.y - camera.y * layer.speed;
                ctx.beginPath();
                ctx.arc(parallaxX, parallaxY, star.radius, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    }

    function drawParticles() {
        if (gameState !== 'RUNNING') return;
        
        const trailOffsetX = -30 * Math.cos(plane.rotation);
        const trailOffsetY = -30 * Math.sin(plane.rotation);

        particles.push({
            x: plane.x + trailOffsetX, y: plane.y + trailOffsetY,
            vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
            radius: 1 + Math.random() * 2, alpha: 1, decay: 0.03 + Math.random() * 0.02
        });

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
            if (p.alpha <= 0) particles.splice(i, 1);
            else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
                gradient.addColorStop(0, `rgba(255, 220, 150, ${p.alpha})`);
                gradient.addColorStop(1, `rgba(255, 150, 50, 0)`);
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }
    }

    function drawPlane() {
        if(gameState === 'CRASHED' && explosion) return;

        ctx.save();
        ctx.translate(plane.x, plane.y);
        ctx.rotate(plane.rotation);
        ctx.shadowColor = '#00a8ff';
        ctx.shadowBlur = 20;
        try {
            if (plane.image.complete && plane.image.naturalHeight !== 0) {
                const w = plane.image.width * 0.8;
                const h = plane.image.height * 0.8;
                ctx.drawImage(plane.image, -w / 2, -h / 2, w, h);
            } else { throw new Error("Image not ready"); }
        } catch (e) {
            ctx.beginPath();
            ctx.moveTo(15, 0); ctx.lineTo(-10, -8); ctx.lineTo(-10, 8); ctx.closePath();
            ctx.fillStyle = '#00a8ff'; ctx.fill();
        }
        ctx.restore();
    }

    function createExplosion(x, y) {
        explosion = { x, y, particles: [] };
        for (let i = 0; i < 150; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 8;
            explosion.particles.push({
                x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 5, alpha: 1, decay: 0.01 + Math.random() * 0.02,
                color: Math.random() > 0.3 ? '#ffc107' : '#e84118'
            });
        }
    }

    function drawExplosion() {
        if (!explosion) return;
        for (let i = explosion.particles.length - 1; i >= 0; i--) {
            const p = explosion.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= p.decay;
            if (p.alpha <= 0) explosion.particles.splice(i, 1);
            else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius * p.alpha, 0, Math.PI * 2);
                ctx.fillStyle = `${p.color}${Math.round(p.alpha * 255).toString(16).padStart(2, '0')}`;
                ctx.fill();
            }
        }
        if (explosion.particles.length === 0) explosion = null;
    }

    function calculateMultiplier(elapsedTime) {
        const elapsedSeconds = elapsedTime / 1000;
        return 1 + 0.06 * Math.pow(elapsedSeconds, 1.5);
    }
    
    // --- UI & STATE HELPERS ---
    function resetGameVisuals() {
        multiplier = 1.00;
        plane.x = 50;
        plane.y = canvas.height - 50;
        plane.rotation = 0;
        camera.x = plane.x;
        camera.y = plane.y;
        camera.zoom = 1;
        particles.length = 0;
        trailPoints = [];
        explosion = null;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        draw();
    }
    
    function createStars() {
        stars = [
            { speed: 0.1, color: 'rgba(255, 255, 255, 0.2)', stars: [] },
            { speed: 0.2, color: 'rgba(255, 255, 255, 0.4)', stars: [] },
            { speed: 0.3, color: 'rgba(255, 255, 255, 0.6)', stars: [] }
        ];
        const totalStarsPerLayer = 150;
        const areaMultiplier = 5;
        
        stars.forEach(layer => {
            for (let i = 0; i < totalStarsPerLayer; i++) {
                layer.stars.push({
                    x: (Math.random() - 0.5) * canvas.width * areaMultiplier,
                    y: (Math.random() - 0.5) * canvas.height * areaMultiplier,
                    radius: Math.random() * 1.5
                });
            }
        });
    }
    
    // --- BETTING LOGIC ---
    function placeBet(panelId) {
        if (gameState !== 'BETTING' && gameState !== 'WAITING') {
            showNotification('Betting is closed for this round.', 'danger');
            return;
        }
        
        const betPanel = document.getElementById(`bet-panel-${panelId}`);
        const amountInput = betPanel.querySelector('.bet-amount-input');
        const betBtn = betPanel.querySelector('.bet-btn');
        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount <= 0) {
            showNotification('Invalid bet amount.', 'danger');
            return;
        }
        if (amount > currentBalance) {
            showNotification('Insufficient balance.', 'danger');
            return;
        }
        if (currentBets[panelId]) {
            showNotification('You have already placed a bet.', 'info');
            return;
        }
        
        currentBalance -= amount;
        updateBalanceDisplay();
        
        currentBets[panelId] = { amount, status: 'pending' };
        
        showNotification(`Bet of MK ${amount.toFixed(2)} placed!`, 'success');
        betBtn.innerHTML = 'Bet Placed';
        betBtn.disabled = true;

        updateTotalBetAmount();
    }
    
    function cashout(panelId) {
        if (gameState !== 'RUNNING' || !currentBets[panelId] || currentBets[panelId].status !== 'pending') {
            return;
        }
        
        const bet = currentBets[panelId];
        const cashoutMultiplier = multiplier;
        const winAmount = bet.amount * cashoutMultiplier;
        
        currentBalance += winAmount;
        updateBalanceDisplay();
        
        bet.status = 'cashed_out';
        bet.cashoutAt = cashoutMultiplier;
        
        showNotification(`Cashed out at ${cashoutMultiplier.toFixed(2)}x! Won MK ${winAmount.toFixed(2)}`, 'success');
        
        const betPanel = document.getElementById(`bet-panel-${panelId}`);
        const betBtn = betPanel.querySelector('.bet-btn');
        if (betBtn) {
            betBtn.disabled = true;
            betBtn.innerHTML = `
                <span class="bet-btn-label">Cashed Out</span>
                <span class="bet-btn-value">MK ${winAmount.toFixed(2)}</span>
            `;
            betBtn.classList.remove('cashout');
        }
        
        addMyBetHistory(bet.amount, winAmount, cashoutMultiplier);

        const myPlayer = livePlayers.find(p => p.isMe && p.panelId == panelId);
        if (myPlayer) {
            myPlayer.status = 'cashed_out';
            myPlayer.cashoutAt = cashoutMultiplier;
            updateLiveBetItem(myPlayer);
        }
    }
    
    function processAutoBets() {
        [1, 2].forEach(id => {
            if (autoBetState[id]) {
                const panel = document.getElementById(`bet-panel-${id}`);
                const amount = parseFloat(panel.querySelector('.auto-bet-amount-input').value);
                const cashoutAt = parseFloat(panel.querySelector('.auto-cashout-input').value) || null;
                
                if (!isNaN(amount) && amount > 0 && amount <= currentBalance) {
                    if (!currentBets[id]) {
                         currentBalance -= amount;
                         updateBalanceDisplay();
                         currentBets[id] = { amount, status: 'pending', autoCashout: cashoutAt };
                         showNotification(`Auto-bet of MK ${amount.toFixed(2)} placed for Panel ${id}.`, 'info');
                         updateTotalBetAmount();
                    }
                } else {
                    autoBetState[id] = false;
                    panel.querySelector('.auto-bet-switch').checked = false;
                    showNotification(`Auto-bet for Panel ${id} disabled (insufficient funds or invalid amount).`, 'warning');
                }
            }
        });
        enableBetButtons();
    }
    
    function checkAutoCashouts() {
        Object.keys(currentBets).forEach(id => {
            const bet = currentBets[id];
            if (bet && bet.status === 'pending' && bet.autoCashout && multiplier >= bet.autoCashout) {
                const winAmount = bet.amount * bet.autoCashout;
                currentBalance += winAmount;
                updateBalanceDisplay();
                bet.status = 'cashed_out';
                showNotification(`Auto-cashed out at ${bet.autoCashout.toFixed(2)}x! Won MK ${winAmount.toFixed(2)}`, 'success');
                addMyBetHistory(bet.amount, winAmount, bet.autoCashout);
                
                const myPlayer = livePlayers.find(p => p.isMe && p.panelId == id);
                if (myPlayer) {
                    myPlayer.status = 'cashed_out';
                    myPlayer.cashoutAt = bet.autoCashout;
                    updateLiveBetItem(myPlayer);
                }
            }
        });
    }

    // --- UI HELPERS ---
    function enableBetButtons() {
        document.querySelectorAll('.bet-btn[data-panel]').forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('cashout');
            btn.classList.add('place-bet');
            btn.innerHTML = 'Place Bet';
        });
    }

    function lockBetButtons() {
        [1, 2].forEach(id => {
            const panel = document.getElementById(`manual-${id}`);
            const betBtn = panel.querySelector('.bet-btn');

            if (currentBets[id] && currentBets[id].status === 'pending') {
                betBtn.disabled = false;
                betBtn.classList.remove('place-bet');
                betBtn.classList.add('cashout');
                
                betBtn.innerHTML = `
                    <span class="bet-btn-label">Cashout</span>
                    <span class="bet-btn-value">MK ${(currentBets[id].amount * 1.00).toFixed(2)}</span>
                `;
            } else {
                betBtn.disabled = true;
                betBtn.innerHTML = 'Waiting...';
            }
        });
    }

    function updateBalanceDisplay() {
        balanceAmountEl.textContent = `MK ${currentBalance.toFixed(2)}`;
        localStorage.setItem('crashBalance', currentBalance);
    }
    
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // --- HISTORY MANAGEMENT ---
    function addOddsHistory(crashedAt) {
        oddsHistory.unshift(crashedAt);
        if (oddsHistory.length > 50) oddsHistory.pop();
        localStorage.setItem('crashOddsHistory', JSON.stringify(oddsHistory));
        updateOddsHistory();
    }
    
    function updateOddsHistory() {
        oddsHistoryBar.innerHTML = '';
        oddsHistory.slice(0, 10).forEach(value => {
            const badge = document.createElement('span');
            badge.className = `odds-badge ${getOddColor(value)}`;
            badge.textContent = `${value.toFixed(2)}x`;
            oddsHistoryBar.appendChild(badge);
        });
    }
    
    function addMyBetHistory(bet, won, multiplier) {
        myBets.unshift({ bet, won, multiplier, date: new Date().toISOString() });
        if (myBets.length > 50) myBets.pop();
        localStorage.setItem('crashMyBets', JSON.stringify(myBets));
        updateMyBetsHistory();
    }

    function updateMyBetsHistory() {
        myBetsContainer.innerHTML = '';
        if (!myBets || myBets.length === 0) {
            myBetsContainer.innerHTML = `<p class="text-center text-muted p-3">No bets placed yet.</p>`;
            return;
        }
        myBets.forEach(bet => {
            if (!bet || typeof bet.bet === 'undefined' || typeof bet.won === 'undefined') {
                console.warn('Skipping malformed bet history record:', bet);
                return;
            }

            const profit = bet.won - bet.bet;
            const isWin = bet.won > 0;
            const item = document.createElement('div');
            item.className = 'live-bet-item my-bet-item';
            
            const displayMultiplier = bet.multiplier || 0;
            const displayBetAmount = bet.bet || 0;
            const displayProfit = profit || 0;

            item.innerHTML = `
                <div>
                    <span class="text-${isWin ? 'success' : 'danger'}">${displayMultiplier.toFixed(2)}x</span>
                    <small class="d-block text-muted">${new Date(bet.date).toLocaleTimeString()}</small>
                </div>
                <span class="text-muted">MK ${displayBetAmount.toFixed(2)}</span>
                <span class="fw-bold text-${isWin ? 'success' : 'danger'}">${isWin ? '+' : ''}MK ${displayProfit.toFixed(2)}</span>
            `;
            myBetsContainer.appendChild(item);
        });
    }

    function getOddColor(value) {
        if (value < 2) return 'low';
        if (value < 10) return 'medium';
        return 'high';
    }

    // --- LIVE PLAYER SIMULATION ---
    function spawnInitialLivePlayers() {
        livePlayers = [];
        liveBetsList.innerHTML = '';
        const numPlayers = 15 + Math.floor(Math.random() * 20);
        playerCountEl.textContent = numPlayers;

        Object.keys(currentBets).forEach(id => {
            const bet = currentBets[id];
            if (bet && bet.status === 'pending') {
                const player = {
                    id: `me-${id}`, name: "You", betAmount: bet.amount,
                    status: 'playing', cashoutAt: null, isMe: true, panelId: parseInt(id),
                };
                livePlayers.push(player);
                addLiveBetItem(player);
            }
        });

        for (let i = 0; i < numPlayers; i++) {
             const player = {
                id: `player-${i}`, name: `User${Math.floor(1000 + Math.random() * 9000)}`,
                betAmount: (Math.random() * 200 + 10), status: 'playing',
                cashoutAt: 1.1 + Math.random() * 5, isMe: false,
            };
            livePlayers.push(player);
            addLiveBetItem(player);
        }
        updateTotalBetAmount();
    }
    
    function checkLivePlayerCashouts() {
        livePlayers.forEach(p => {
            if (p.status === 'playing' && !p.isMe && multiplier >= p.cashoutAt) {
                p.status = 'cashed_out';
                updateLiveBetItem(p);
            }
        });
    }

    function addLiveBetItem(player) {
        const item = document.createElement('div');
        item.className = 'live-bet-item new';
        item.id = `live-bet-${player.id}`;
        item.innerHTML = `
            <i class="fas fa-user user-icon"></i>
            <span class="user-name">${player.name}</span>
            <span class="bet-amount">MK ${player.betAmount.toFixed(2)}</span>
            <span class="cashout-at text-muted">-</span>
        `;
        liveBetsList.prepend(item);
    }
    
    function updateLiveBetItem(player) {
        const item = document.getElementById(`live-bet-${player.id}`);
        if (!item) return;

        if (player.status === 'cashed_out') {
            item.classList.add('cashed-out');
            const cashoutEl = item.querySelector('.cashout-at');
            cashoutEl.classList.remove('text-muted');
            cashoutEl.classList.add('text-success', 'fw-bold');
            cashoutEl.textContent = `@${player.cashoutAt.toFixed(2)}x`;
            
            const amountEl = item.querySelector('.bet-amount');
            amountEl.classList.add('text-success');
            amountEl.textContent = `MK ${(player.betAmount * player.cashoutAt).toFixed(2)}`;
        }
    }
    
    function updateTotalBetAmount() {
         const total = Object.values(currentBets).reduce((sum, bet) => sum + bet.amount, 0);
         playerCountEl.textContent = Object.keys(currentBets).length;
         totalBetAmountEl.textContent = total.toFixed(2);
    }


    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // Listen for admin commands from another tab
        window.addEventListener('storage', (event) => {
            if (event.key === 'adminForceCrashNow') {
                if (gameState === 'RUNNING') {
                    crashPoint = multiplier; // Crash at the current multiplier
                    changeState('CRASHED');
                }
                localStorage.removeItem('adminForceCrashNow');
            }
        });

        document.querySelectorAll('.bet-panel').forEach(panel => {
            panel.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    panel.querySelector('.tab-btn.active').classList.remove('active');
                    btn.classList.add('active');
                    panel.querySelector('.tab-content.active').classList.remove('active');
                    panel.querySelector(`#${btn.dataset.tab}`).classList.add('active');
                });
            });

            panel.addEventListener('click', (e) => {
                const button = e.target.closest('.bet-btn');
                if (!button || button.disabled) return;
                const panelId = button.dataset.panel;
                if (button.classList.contains('place-bet')) {
                    placeBet(panelId);
                } else if (button.classList.contains('cashout')) {
                    cashout(panelId);
                }
            });
            
            panel.querySelectorAll('.bet-modifier').forEach(btn => {
                btn.addEventListener('click', () => {
                    const input = panel.querySelector('.bet-amount-input');
                    let value = parseFloat(input.value) || 0;
                    const action = btn.dataset.action;
                    if (action === 'half') value /= 2;
                    else if (action === 'double') value *= 2;
                    else if (action === 'add') value += parseFloat(btn.dataset.value);
                    input.value = Math.max(0, parseFloat(value.toFixed(2)));
                });
            });
            
            panel.querySelector('.auto-bet-switch').addEventListener('change', (e) => {
                const panelId = panel.id.split('-')[2];
                autoBetState[panelId] = e.target.checked;
                showNotification(`Auto-bet ${e.target.checked ? 'enabled' : 'disabled'} for Panel ${panelId}.`, 'info');
            });
        });
        
        showHistoryBtn.addEventListener('click', () => {
            oddsHistoryModalBody.innerHTML = '';
            oddsHistory.forEach(value => {
                 const badge = document.createElement('span');
                 badge.className = `odds-badge ${getOddColor(value)}`;
                 badge.textContent = `${value.toFixed(2)}x`;
                 oddsHistoryModalBody.appendChild(badge);
            });
            oddsHistoryModal.show();
        });

        toggleLeftPanelBtn.addEventListener('click', () => leftPanel.classList.add('show'));
        closeLeftPanelBtn.addEventListener('click', () => leftPanel.classList.remove('show'));
        toggleRightPanelBtn.addEventListener('click', () => rightPanel.classList.add('show'));
        if (closeRightPanelBtn) {
           closeRightPanelBtn.addEventListener('click', () => rightPanel.classList.remove('show'));
        }
    }
    
    // --- CRYPTO/SEED LOGIC (Pseudo) ---
    function generateNewCrashPoint() {
        // ADMIN OVERRIDE
        const adminCrash = localStorage.getItem('adminCrashOverride');
        if (adminCrash) {
            const adminValue = parseFloat(adminCrash);
            if (!isNaN(adminValue) && adminValue >= 1.00) {
                crashPoint = adminValue;
                localStorage.removeItem('adminCrashOverride');
                // SECRET: No notification or console log for users
                return;
            } else {
                 localStorage.removeItem('adminCrashOverride');
            }
        }

        // STANDARD RANDOM GENERATION
        const gameSeed = Math.random().toString(36).substring(2);
        let hash = 0;
        for (let i = 0; i < gameSeed.length; i++) {
            hash = (hash << 5) - hash + gameSeed.charCodeAt(i);
            hash |= 0;
        }
        const h = Math.abs(hash);
        if (h % 100 < 2) { // 2% house edge for instant crash
            crashPoint = 1.00;
        } else {
            const maxMultiplier = 10000;
            const e = Math.pow(2, 52);
            const crash = Math.floor((maxMultiplier * e - h) / (e - h)) / 100;
            crashPoint = Math.max(1.00, crash);
        }
    }

    // --- START THE APP ---
    init();
});
