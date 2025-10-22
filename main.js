// Ensure the DOM is fully loaded before running the script
document.addEventListener("DOMContentLoaded", () => {
    // --- MOCK DATA ---
    const MOCK_USER = {
        uid: "KBET" + Math.floor(1000 + Math.random() * 9000),
        avatar: `https://api.dicebear.com/8.x/initials/svg?seed=User&radius=50`,
        balance: 5000.00,
    };

    let MOCK_TRANSACTIONS = [
        { id: 't1', type: 'Deposit', amount: 1000, status: 'Completed', date: new Date(Date.now() - 86400000 * 2) },
        { id: 't2', type: 'Withdraw', amount: 200, status: 'Completed', date: new Date(Date.now() - 86400000) },
        { id: 't3', type: 'Bet Win', amount: 50.50, status: 'Completed', date: new Date(Date.now() - 3600000) },
    ];

    // --- UI ELEMENTS ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    const contentOverlay = document.createElement('div');
    contentOverlay.className = 'content-overlay';
    document.body.appendChild(contentOverlay);
    
    // Account Info
    const userAvatar = document.getElementById('userAvatar');
    const userUid = document.getElementById('userUid');
    const userBalanceEl = document.getElementById('userBalance');
    const refreshBalanceBtn = document.getElementById('refreshBalanceBtn');

    // Main Action Buttons
    const mainDepositBtn = document.getElementById('mainDepositBtn');
    const mainWithdrawBtn = document.getElementById('mainWithdrawBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Modals
    const depositModal = new window.bootstrap.Modal(document.getElementById('depositModal'));
    const paychanguModal = new window.bootstrap.Modal(document.getElementById('paychanguModal'));
    const withdrawModal = new window.bootstrap.Modal(document.getElementById('withdrawModal'));
    const historyModal = new window.bootstrap.Modal(document.getElementById('historyModal'));
    const changePasswordModal = new window.bootstrap.Modal(document.getElementById('changePasswordModal'));
    const deleteAccountModal = new window.bootstrap.Modal(document.getElementById('deleteAccountModal'));
    const termsModal = new window.bootstrap.Modal(document.getElementById('termsModal'));
    const contactModal = new window.bootstrap.Modal(document.getElementById('contactModal'));
    
    // Sidebar Links
    const depositLink = document.getElementById('depositLink');
    const withdrawLink = document.getElementById('withdrawLink');
    const historyLink = document.getElementById('historyLink');
    const changePasswordLink = document.getElementById('changePasswordLink');
    const deleteAccountLink = document.getElementById('deleteAccountLink');
    const termsLink = document.getElementById('termsLink');
    const contactLink = document.getElementById('contactLink');

    // Modal Forms
    const depositAmountInput = document.getElementById('depositAmount');
    const proceedToPaychanguBtn = document.getElementById('proceedToPaychanguBtn');
    const withdrawPhoneInput = document.getElementById('withdrawPhone');
    const withdrawAmountInput = document.getElementById('withdrawAmount');
    const processWithdrawBtn = document.getElementById('processWithdrawBtn');
    const transactionsList = document.getElementById('transactionsList');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const paychanguLoader = document.getElementById('paychangu-loader');
    const paychanguSuccess = document.getElementById('paychangu-success');

    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);

    // --- INITIALIZATION ---
    function init() {
        updateUserInfo();
        updateBalance();
        setupEventListeners();
    }

    // --- UI FUNCTIONS ---
    function updateUserInfo() {
        userUid.textContent = MOCK_USER.uid;
        userAvatar.src = MOCK_USER.avatar;
    }

    function updateBalance() {
        userBalanceEl.textContent = `MK ${MOCK_USER.balance.toFixed(2)}`;
    }

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        contentOverlay.classList.toggle('show');
    }

    function showToast(message, type = 'info') {
        const toastId = 'toast-' + Math.random().toString(36).substr(2, 9);
        const toast = document.createElement('div');
        const bgColor = type === 'danger' ? 'bg-danger' : (type === 'success' ? 'bg-success' : 'bg-dark');
        toast.className = `toast align-items-center text-white ${bgColor} border-0 fade show`;
        toast.id = toastId;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        toastContainer.appendChild(toast);
        
        const bsToast = new window.bootstrap.Toast(toast, { delay: 3000 });
        bsToast.show();
        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
        sidebarCloseBtn.addEventListener('click', toggleSidebar);
        contentOverlay.addEventListener('click', toggleSidebar);

        refreshBalanceBtn.addEventListener('click', () => {
            const icon = refreshBalanceBtn.querySelector('i');
            icon.classList.add('fa-spin');
            setTimeout(() => {
                updateBalance();
                icon.classList.remove('fa-spin');
                showToast("Balance updated!", "success");
            }, 500);
        });

        // Main Actions
        mainDepositBtn.addEventListener('click', () => depositModal.show());
        mainWithdrawBtn.addEventListener('click', () => withdrawModal.show());
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showToast("Logging you out...");
            setTimeout(() => {
                window.location.href = 'index-1.html';
            }, 1000);
        });

        // Sidebar Links
        depositLink.addEventListener('click', (e) => { e.preventDefault(); depositModal.show(); toggleSidebar(); });
        withdrawLink.addEventListener('click', (e) => { e.preventDefault(); withdrawModal.show(); toggleSidebar(); });
        historyLink.addEventListener('click', (e) => { e.preventDefault(); showHistory(); toggleSidebar(); });
        changePasswordLink.addEventListener('click', (e) => { e.preventDefault(); changePasswordModal.show(); toggleSidebar(); });
        deleteAccountLink.addEventListener('click', (e) => { e.preventDefault(); deleteAccountModal.show(); toggleSidebar(); });
        termsLink.addEventListener('click', (e) => { e.preventDefault(); termsModal.show(); toggleSidebar(); });
        contactLink.addEventListener('click', (e) => { e.preventDefault(); contactModal.show(); toggleSidebar(); });
        
        // Modal Actions
        proceedToPaychanguBtn.addEventListener('click', processDeposit);
        processWithdrawBtn.addEventListener('click', processWithdraw);
        confirmDeleteBtn.addEventListener('click', () => {
             showToast('Account deleted. (Mock)', 'danger');
             deleteAccountModal.hide();
        });
    }

    // --- TRANSACTION LOGIC ---
    function processDeposit() {
        const amount = parseFloat(depositAmountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount.', 'danger');
            return;
        }
        
        depositModal.hide();
        paychanguModal.show();
        paychanguLoader.style.display = 'block';
        paychanguSuccess.style.display = 'none';

        // Simulate API call to PayChangu
        setTimeout(() => {
            paychanguLoader.style.display = 'none';
            paychanguSuccess.style.display = 'block';

            MOCK_USER.balance += amount;
            addTransaction('Deposit', amount, 'Completed');
            updateBalance();

            setTimeout(() => {
                paychanguModal.hide();
                depositAmountInput.value = '';
            }, 2000);

        }, 2500);
    }

    function processWithdraw() {
        const amount = parseFloat(withdrawAmountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount.', 'danger');
            return;
        }
        if (amount > MOCK_USER.balance) {
            showToast('Insufficient balance.', 'danger');
            return;
        }
        MOCK_USER.balance -= amount;
        addTransaction('Withdraw', amount, 'Completed');
        updateBalance();
        showToast(`Successfully withdrew MK ${amount.toFixed(2)}`, 'success');
        withdrawModal.hide();
        withdrawAmountInput.value = '';
        withdrawPhoneInput.value = '';
    }
    
    function showHistory() {
        transactionsList.innerHTML = '';
        if (MOCK_TRANSACTIONS.length === 0) {
            transactionsList.innerHTML = '<p class="text-center my-3">No transactions yet.</p>';
        } else {
            MOCK_TRANSACTIONS.slice().reverse().forEach(tx => {
                const item = document.createElement('div');
                item.className = 'list-group-item d-flex justify-content-between align-items-center';
                const isCredit = tx.type.toLowerCase().includes('deposit') || tx.type.toLowerCase().includes('win');
                item.innerHTML = `
                    <div>
                        <h6 class="mb-1">${tx.type}</h6>
                        <small class="text-muted">${tx.date.toLocaleString()}</small>
                    </div>
                    <span class="badge bg-${isCredit ? 'success' : 'danger'} rounded-pill fs-6 fw-normal">
                        ${isCredit ? '+' : '-'}MK ${tx.amount.toFixed(2)}
                    </span>
                `;
                transactionsList.appendChild(item);
            });
        }
        historyModal.show();
    }

    function addTransaction(type, amount, status) {
        MOCK_TRANSACTIONS.push({
            id: 't' + (MOCK_TRANSACTIONS.length + 1),
            type,
            amount,
            status,
            date: new Date()
        });
    }

    // --- RUN ---
    init();
});