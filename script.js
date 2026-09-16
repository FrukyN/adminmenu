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

    const resetPlayerModalState = () => {
        const freezeBtn = document.getElementById('btnFreezePlayer');
        if (freezeBtn) {
            freezeBtn.setAttribute('data-frozen', 'false');
            freezeBtn.innerText = 'Zamknout (Freeze)';
        }
        const noteInput = document.getElementById('staffNoteInput');
        if (noteInput) noteInput.value = '';
        const warnInput = document.getElementById('warnReasonInput');
        if (warnInput) warnInput.value = '';
    };

    document.querySelectorAll('.btn-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectedPlayerId = e.target.getAttribute('data-player');
            const playerName = e.target.getAttribute('data-name');
            
            if (modalTitle) modalTitle.innerText = `Správa: ${playerName} (ID: ${selectedPlayerId})`;
            resetPlayerModalState();
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

    // --- EKONOMIKA: ÚPRAVA FINANCÍ HRÁČE ---
    const btnEcoAdd = document.getElementById('btnEcoAdd');
    const btnEcoRemove = document.getElementById('btnEcoRemove');
    const ecoPlayerId = document.getElementById('ecoPlayerId');
    const ecoAmount = document.getElementById('ecoAmount');
    const ecoAccountType = document.getElementById('ecoAccountType');

    const handleEcoAction = (mode) => {
        const targetId = ecoPlayerId?.value.trim();
        const amount = Number(ecoAmount?.value);

        if (!targetId) return;
        if (!amount || amount <= 0) return;

        sendNUI('executeAction', {
            action: 'setPlayerMoney',
            mode: mode, // 'add' nebo 'remove'
            id: targetId,
            amount: amount,
            account: ecoAccountType?.value || 'cash'
        });

        if (ecoAmount) ecoAmount.value = '';
    };

    if (btnEcoAdd) btnEcoAdd.addEventListener('click', () => handleEcoAction('add'));
    if (btnEcoRemove) btnEcoRemove.addEventListener('click', () => handleEcoAction('remove'));

    // --- EKONOMIKA: VYHLEDÁVÁNÍ FIREM ---
    const companySearchInput = document.getElementById('companySearchInput');
    if (companySearchInput) {
        companySearchInput.addEventListener('keyup', (e) => {
            const filter = e.target.value.toLowerCase();
            document.querySelectorAll('#companyList tr').forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(filter) ? "" : "none";
            });
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

    // --- FREEZE TOGGLE V PLAYER MODALU ---
    const btnFreezePlayer = document.getElementById('btnFreezePlayer');
    if (btnFreezePlayer) {
        btnFreezePlayer.addEventListener('click', () => {
            if (!selectedPlayerId || selectedPlayerId === 'offline') return;
            const isFrozen = btnFreezePlayer.getAttribute('data-frozen') === 'true';
            const newState = !isFrozen;
            btnFreezePlayer.setAttribute('data-frozen', String(newState));
            btnFreezePlayer.innerText = newState ? 'Odemknout (Unfreeze)' : 'Zamknout (Freeze)';
            sendNUI('executeAction', { action: 'toggleFreeze', id: selectedPlayerId, state: newState });
        });
    }

    // --- POZNÁMKA SPRÁVCE ---
    const btnSaveNote = document.getElementById('btnSaveNote');
    const staffNoteInput = document.getElementById('staffNoteInput');
    if (btnSaveNote) {
        btnSaveNote.addEventListener('click', () => {
            if (!selectedPlayerId || !staffNoteInput) return;
            sendNUI('executeAction', { action: 'saveStaffNote', id: selectedPlayerId, note: staffNoteInput.value.trim() });
        });
    }

    // --- UDĚLENÍ VAROVÁNÍ ---
    const btnAddWarn = document.getElementById('btnAddWarn');
    const warnReasonInput = document.getElementById('warnReasonInput');
    const warnsList = document.getElementById('warnsList');
    if (btnAddWarn) {
        btnAddWarn.addEventListener('click', () => {
            const reason = warnReasonInput?.value.trim();
            if (!selectedPlayerId || !reason) return;

            sendNUI('executeAction', { action: 'addWarn', id: selectedPlayerId, reason });

            if (warnsList) {
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                entry.innerHTML = `<span class="badge badge-warning">Nové</span><span class="log-text">${reason} — uděleno právě teď</span>`;
                warnsList.appendChild(entry);
            }
            if (warnReasonInput) warnReasonInput.value = '';
        });
    }

    // --- BANOVÁNÍ (Z PLAYER MODALU) ---
    const btnModalBan = document.getElementById('btnModalBan');
    if (btnModalBan) {
        btnModalBan.addEventListener('click', () => {
            const reason = document.getElementById('modalBanReason')?.value.trim();
            const duration = document.getElementById('modalBanDuration')?.value;
            if (!selectedPlayerId || !reason) return;

            sendNUI('executeAction', { action: 'banPlayer', id: selectedPlayerId, reason, duration });
        });
    }

    // --- RYCHLÝ BAN (SEKCE BANY) ---
    const btnQuickBan = document.getElementById('btnQuickBan');
    if (btnQuickBan) {
        btnQuickBan.addEventListener('click', () => {
            const targetId = document.getElementById('banPlayerId')?.value.trim();
            const reason = document.getElementById('banReason')?.value.trim();
            const duration = document.getElementById('banDuration')?.value;
            if (!targetId || !reason) return;

            sendNUI('executeAction', { action: 'banPlayer', id: targetId, reason, duration });
        });
    }

    // --- VYHLEDÁVÁNÍ V BANECH ---
    const banSearchInput = document.getElementById('banSearchInput');
    if (banSearchInput) {
        banSearchInput.addEventListener('keyup', (e) => {
            const filter = e.target.value.toLowerCase();
            document.querySelectorAll('#banList tr').forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(filter) ? "" : "none";
            });
        });
    }

    // --- VYHLEDÁVÁNÍ HRÁČŮ NA MAPĚ ---
    const mapPlayerSearch = document.getElementById('mapPlayerSearch');
    if (mapPlayerSearch) {
        mapPlayerSearch.addEventListener('keyup', (e) => {
            const filter = e.target.value.toLowerCase();
            document.querySelectorAll('#mapPlayerTable tbody tr').forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(filter) ? "" : "none";
            });
        });
    }

    // --- KLIKNUTÍ NA BLIP NA MAPĚ (otevře player modal) ---
    document.querySelectorAll('.map-blip[data-player]').forEach(blip => {
        blip.addEventListener('click', () => {
            selectedPlayerId = blip.getAttribute('data-player');
            const playerName = blip.getAttribute('data-name');
            if (modalTitle) modalTitle.innerText = `Správa: ${playerName} (ID: ${selectedPlayerId})`;
            resetPlayerModalState();
            if (modal) modal.classList.add('show');
        });
    });

    // --- ACL: MODAL ÚPRAVY OPRÁVNĚNÍ ADMINA ---
    const permissionsModal = document.getElementById('permissionsModal');
    const modalAdminName = document.getElementById('modalAdminName');
    const closePermissionsModalBtn = document.getElementById('closePermissionsModalBtn');
    const btnSavePermissions = document.getElementById('btnSavePermissions');
    let selectedAdminName = null;

    document.querySelectorAll('.btn-edit-permissions').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectedAdminName = e.target.getAttribute('data-admin');
            if (modalAdminName) modalAdminName.innerText = `Oprávnění administrátora: ${selectedAdminName}`;
            if (permissionsModal) permissionsModal.classList.add('show');
        });
    });

    if (closePermissionsModalBtn && permissionsModal) {
        closePermissionsModalBtn.addEventListener('click', () => permissionsModal.classList.remove('show'));
    }

    if (btnSavePermissions) {
        btnSavePermissions.addEventListener('click', () => {
            const perms = {};
            document.querySelectorAll('#permissionsModal input[data-perm]').forEach(input => {
                perms[input.getAttribute('data-perm')] = input.checked;
            });
            sendNUI('executeAction', { action: 'saveAdminPermissions', admin: selectedAdminName, permissions: perms });
            if (permissionsModal) permissionsModal.classList.remove('show');
        });
    }

    // --- DISCORD WEBHOOK ---
    const btnSaveWebhook = document.getElementById('btnSaveWebhook');
    const btnTestWebhook = document.getElementById('btnTestWebhook');

    if (btnSaveWebhook) {
        btnSaveWebhook.addEventListener('click', () => {
            sendNUI('executeAction', {
                action: 'saveWebhookConfig',
                url: document.getElementById('discordWebhookUrl')?.value.trim(),
                categories: {
                    audit: document.getElementById('webhookAudit')?.checked,
                    bans: document.getElementById('webhookBans')?.checked,
                    economy: document.getElementById('webhookEconomy')?.checked,
                    chat: document.getElementById('webhookChat')?.checked
                }
            });
        });
    }

    if (btnTestWebhook) {
        btnTestWebhook.addEventListener('click', () => {
            sendNUI('executeAction', { action: 'testWebhook' });
        });
    }

    // --- ZAVÍRÁNÍ ---
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeNUI);

    document.addEventListener('keyup', (e) => {
        if (e.key === "Escape") {
            if (permissionsModal && permissionsModal.classList.contains('show')) {
                permissionsModal.classList.remove('show');
            } else if (modal && modal.classList.contains('show')) {
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
