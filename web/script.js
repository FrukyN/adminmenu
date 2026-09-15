let selectedPlayerId = null;

// Bezpečné volání NUI callbacků
function sendNUI(action, payload = {}) {
    if (typeof GetParentResourceName === "function") {
        return fetch(`https://${GetParentResourceName()}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(payload)
        }).catch(err => console.error("Chyba NUI komunikace:", err));
    } else {
        console.log(`[Mock NUI Call] Akce: ${action}`, payload);
    }
}

function closeNUI() {
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = "none";
    sendNUI('closeMenu');
}

// Globální handlery pro inline onclicky z HTML
window.closeReportModal = () => document.getElementById('createReportModal')?.classList.remove('show');
window.closeChatModal = () => document.getElementById('chatModal')?.classList.remove('show');

document.addEventListener("DOMContentLoaded", () => {
    const appContainer = document.getElementById('app-container');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('main > section');

    // Aktuální rok v patičce
    const yearElem = document.getElementById('year');
    if (yearElem) yearElem.innerText = new Date().getFullYear();

    // --- PŘEPÍNÁNÍ TABŮ ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            navItems.forEach(nav => nav.classList.remove('active'));
            e.target.classList.add('active');

            sections.forEach(sec => {
                sec.classList.add('hidden');
                sec.classList.remove('show');
            });

            const activeSection = document.getElementById(targetId);
            if (activeSection) {
                activeSection.classList.remove('hidden');
                setTimeout(() => activeSection.classList.add('show'), 10);
            }
        });
    });

    // --- SPRÁVA HRÁČE (MODAL) ---
    const modal = document.getElementById('playerModal');
    const modalTitle = document.getElementById('modalPlayerName');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const btnPedMenu = document.getElementById('btnPedMenu');
    const btnLogout = document.getElementById('btnLogout');

    document.querySelectorAll('.btn-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectedPlayerId = e.target.getAttribute('data-player');
            const playerName = e.target.getAttribute('data-name');
            
            if (modalTitle) modalTitle.innerText = `Správa: ${playerName} (ID: ${selectedPlayerId})`;
            if (modal) modal.classList.add('show');
        });
    });

    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            selectedPlayerId = null;
        });
    }

    if (btnPedMenu) {
        btnPedMenu.addEventListener('click', () => {
            if (!selectedPlayerId || selectedPlayerId === 'offline') return;
            sendNUI('executeAction', { action: 'forceCommand', playerId: selectedPlayerId, command: 'pedmenu' });
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (!selectedPlayerId || selectedPlayerId === 'offline') return;
            sendNUI('executeAction', { action: 'forceLogout', playerId: selectedPlayerId });
        });
    }

    // --- VYHLEDÁVÁNÍ V HRÁČÍCH ---
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            const filter = e.target.value.toLowerCase();
            document.querySelectorAll('#playerList .card').forEach(card => {
                card.style.display = card.innerText.toLowerCase().includes(filter) ? "flex" : "none";
            });
        });
    }

    // --- RYCHLÉ AKCE A NÁSTROJE (TOOLS) ---
    document.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const actionType = e.target.getAttribute('data-action');
            const targetId = e.target.getAttribute('data-id') || selectedPlayerId;
            sendNUI('executeAction', { action: actionType, id: targetId });
        });
    });

    // --- INTERAKTIVNÍ STAFF CHAT ---
    const staffChatInput = document.getElementById('staffChatInput');
    const sendStaffChatBtn = document.getElementById('sendStaffChatBtn');
    const adminStaffChat = document.getElementById('adminStaffChat');

    const handleSendStaffMsg = () => {
        if (!staffChatInput || !staffChatInput.value.trim()) return;
        const msg = staffChatInput.value.trim();

        // Přidání přímo do DOM pro vizuální odezvu
        const msgElem = document.createElement('div');
        msgElem.className = 'msg admin';
        msgElem.innerHTML = `<strong>Ty:</strong> ${msg}`;
        adminStaffChat.appendChild(msgElem);
        adminStaffChat.scrollTop = adminStaffChat.scrollHeight;

        sendNUI('sendStaffMessage', { message: msg });
        staffChatInput.value = '';
    };

    if (sendStaffChatBtn) sendStaffChatBtn.addEventListener('click', handleSendStaffMsg);
    if (staffChatInput) {
        staffChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSendStaffMsg();
        });
    }

    // --- FILTROVÁNÍ V LOGÁCH ---
    const logSearchInput = document.getElementById('logSearchInput');
    if (logSearchInput) {
        logSearchInput.addEventListener('keyup', (e) => {
            const filter = e.target.value.toLowerCase();
            document.querySelectorAll('#logsContainer .log-entry').forEach(entry => {
                entry.style.display = entry.innerText.toLowerCase().includes(filter) ? "flex" : "none";
            });
        });
    }

    // --- ZAVÍRÁNÍ ---
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeNUI);

    document.addEventListener('keyup', (e) => {
        if (e.key === "Escape") {
            if (modal && modal.classList.contains('show')) {
                modal.classList.remove('show');
            } else {
                closeNUI();
            }
        }
    });

    // --- ZPRACOVÁNÍ ZPRÁV Z LUA KLIENTA ---
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (data.action === "openMenu") {
            if (appContainer) appContainer.style.display = "block";
            
            if (data.dashboard) {
                const statElem = document.getElementById('statOnlinePlayers');
                if (statElem) statElem.innerText = `${data.dashboard.online} / ${data.dashboard.max}`;
            }
        }
    });
});
