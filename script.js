let selectedPlayerId = null;
let selectedAdminName = null;
let selectedReportId = null;

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

// --- OZNÁMENÍ (TOASTY) ---
function showToast(message, type = 'default', duration = 3200) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 220);
    }, duration);
}

// Jednoduchý escape proti XSS při vkládání textu do innerHTML
function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
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
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            if (!targetId) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

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

    const openPlayerModal = (playerId, playerName, isOffline = false) => {
        selectedPlayerId = playerId;
        if (modalTitle) {
            modalTitle.innerText = isOffline
                ? `Offline správa: ${playerName}`
                : `Správa: ${playerName} (ID: ${playerId})`;
        }
        resetPlayerModalState();
        if (modal) modal.classList.add('show');
    };

    document.querySelectorAll('.btn-modal[data-player]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            openPlayerModal(
                target.getAttribute('data-player'),
                target.getAttribute('data-name'),
                target.getAttribute('data-offline') === 'true'
            );
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
            if (!selectedPlayerId) return;
            sendNUI('executeAction', { action: 'forceCommand', playerId: selectedPlayerId, command: 'pedmenu' });
            showToast('PedMenu vynuceno hráči.', 'success');
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (!selectedPlayerId) return;
            if (!confirm('Opravdu chceš tohoto hráče odhlásit ze serveru?')) return;
            sendNUI('executeAction', { action: 'forceLogout', playerId: selectedPlayerId });
            showToast('Hráč byl odhlášen.', 'warning');
            modal?.classList.remove('show');
        });
    }

    // --- OBECNÁ FUNKCE PRO VYHLEDÁVÁNÍ/FILTROVÁNÍ KARET ---
    function setupCardFilter({ inputId, selectId, checkboxId, listId }) {
        const input = document.getElementById(inputId);
        const select = selectId ? document.getElementById(selectId) : null;
        const checkbox = checkboxId ? document.getElementById(checkboxId) : null;
        const list = document.getElementById(listId);
        if (!list) return;

        const applyFilter = () => {
            const filterText = (input?.value || '').toLowerCase();
            const filterType = select?.value || 'none';
            const onlineOnly = checkbox?.checked || false;

            list.querySelectorAll('.card').forEach(card => {
                const text = card.innerText.toLowerCase();
                let visible = !filterText || text.includes(filterText);

                if (visible && filterType !== 'none') {
                    visible = card.getAttribute('data-filter-' + filterType) === 'true'
                        || text.includes(filterType);
                }

                if (visible && onlineOnly) {
                    visible = !text.includes('[offline]') && !text.includes('offline');
                }

                card.style.display = visible ? '' : 'none';
            });
        };

        input?.addEventListener('keyup', applyFilter);
        select?.addEventListener('change', applyFilter);
        checkbox?.addEventListener('change', applyFilter);
    }

    setupCardFilter({ inputId: 'playerSearchInput', selectId: 'playerSearchType', checkboxId: 'searchOffline', listId: 'playerList' });
    setupCardFilter({ inputId: 'vehicleSearchInput', selectId: 'vehicleSearchType', listId: 'vehicleList' });
    setupCardFilter({ inputId: 'frakceSearchInput', selectId: 'frakceSearchType', listId: 'frakceList' });

    // --- RYCHLÉ AKCE A NÁSTROJE (S POTVRZENÍM U NEBEZPEČNÝCH AKCÍ) ---
    document.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const actionType = target.getAttribute('data-action');
            const confirmMsg = target.getAttribute('data-confirm');

            if (confirmMsg && !confirm(confirmMsg)) return;

            // Speciální akce mají vlastní obsluhu níže (report/whitelist/admin management),
            // aby se předešlo duplicitnímu odeslání NUI callbacku.
            const handledElsewhere = [
                'approveWhitelist', 'rejectWhitelist', 'closeReport', 'openReportChat',
                'removeAdmin', 'sendAnnouncement'
            ];
            if (handledElsewhere.includes(actionType)) return;

            const targetId = target.getAttribute('data-id') || selectedPlayerId;

            // Vizuální zpětná vazba pro toggle nástroje (noclip, godmode, invis)
            if (['toggleNoclip', 'toggleGodmode', 'toggleInvis'].includes(actionType)) {
                target.classList.toggle('active');
            }

            sendNUI('executeAction', { action: actionType, id: targetId });
            showToast(`Akce "${actionType}" byla odeslána.`, 'default', 1800);
        });
    });

    // --- OZNÁMENÍ CELÉMU SERVERU ---
    const btnSendAnnouncement = document.getElementById('btnSendAnnouncement');
    if (btnSendAnnouncement) {
        btnSendAnnouncement.addEventListener('click', () => {
            const message = prompt('Text oznámení pro všechny hráče na serveru:');
            if (!message || !message.trim()) return;
            sendNUI('executeAction', { action: 'sendAnnouncement', message: message.trim() });
            showToast('Oznámení bylo odesláno všem hráčům.', 'success');
        });
    }

    // --- INTERAKTIVNÍ STAFF CHAT ---
    const staffChatInput = document.getElementById('staffChatInput');
    const sendStaffChatBtn = document.getElementById('sendStaffChatBtn');
    const adminStaffChat = document.getElementById('adminStaffChat');

    const handleSendStaffMsg = () => {
        if (!staffChatInput || !staffChatInput.value.trim()) return;
        const msg = staffChatInput.value.trim();

        const msgElem = document.createElement('div');
        msgElem.className = 'msg admin';
        msgElem.innerHTML = `<strong>Ty:</strong> ${escapeHtml(msg)}`;
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

        if (!targetId) {
            showToast('Zadej ID hráče.', 'danger');
            return;
        }
        if (!amount || amount <= 0) {
            showToast('Zadej platnou částku.', 'danger');
            return;
        }

        sendNUI('executeAction', {
            action: 'setPlayerMoney',
            mode: mode,
            id: targetId,
            amount: amount,
            account: ecoAccountType?.value || 'cash'
        });

        showToast(
            mode === 'add'
                ? `Hráči #${targetId} přidáno $${amount.toLocaleString('cs-CZ')}.`
                : `Hráči #${targetId} odebráno $${amount.toLocaleString('cs-CZ')}.`,
            'success'
        );

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
    const logCategoryFilter = document.getElementById('logCategoryFilter');
    const applyLogFilter = () => {
        const filter = (logSearchInput?.value || '').toLowerCase();
        const category = logCategoryFilter?.value || 'all';
        document.querySelectorAll('#logsContainer .log-entry').forEach(entry => {
            const matchesText = !filter || entry.innerText.toLowerCase().includes(filter);
            const matchesCategory = category === 'all' || entry.classList.contains('log-' + category);
            entry.style.display = (matchesText && matchesCategory) ? "flex" : "none";
        });
    };
    logSearchInput?.addEventListener('keyup', applyLogFilter);
    logCategoryFilter?.addEventListener('change', applyLogFilter);

    // --- FREEZE TOGGLE V PLAYER MODALU ---
    const btnFreezePlayer = document.getElementById('btnFreezePlayer');
    if (btnFreezePlayer) {
        btnFreezePlayer.addEventListener('click', () => {
            if (!selectedPlayerId) return;
            const isFrozen = btnFreezePlayer.getAttribute('data-frozen') === 'true';
            const newState = !isFrozen;
            btnFreezePlayer.setAttribute('data-frozen', String(newState));
            btnFreezePlayer.innerText = newState ? 'Odemknout (Unfreeze)' : 'Zamknout (Freeze)';
            sendNUI('executeAction', { action: 'toggleFreeze', id: selectedPlayerId, state: newState });
            showToast(newState ? 'Hráč byl zamčen.' : 'Hráč byl odemčen.', 'warning');
        });
    }

    // --- POZNÁMKA SPRÁVCE ---
    const btnSaveNote = document.getElementById('btnSaveNote');
    const staffNoteInput = document.getElementById('staffNoteInput');
    if (btnSaveNote) {
        btnSaveNote.addEventListener('click', () => {
            if (!selectedPlayerId || !staffNoteInput?.value.trim()) {
                showToast('Poznámka nemůže být prázdná.', 'danger');
                return;
            }
            sendNUI('executeAction', { action: 'saveStaffNote', id: selectedPlayerId, note: staffNoteInput.value.trim() });
            showToast('Poznámka byla uložena.', 'success');
        });
    }

    // --- UDĚLENÍ VAROVÁNÍ ---
    const btnAddWarn = document.getElementById('btnAddWarn');
    const warnReasonInput = document.getElementById('warnReasonInput');
    const warnsList = document.getElementById('warnsList');
    if (btnAddWarn) {
        btnAddWarn.addEventListener('click', () => {
            const reason = warnReasonInput?.value.trim();
            if (!selectedPlayerId || !reason) {
                showToast('Zadej důvod varování.', 'danger');
                return;
            }

            sendNUI('executeAction', { action: 'addWarn', id: selectedPlayerId, reason });

            if (warnsList) {
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                entry.innerHTML = `<span class="badge badge-warning">Nové</span><span class="log-text">${escapeHtml(reason)} — uděleno právě teď</span>`;
                warnsList.appendChild(entry);
            }
            showToast('Varování bylo uděleno.', 'warning');
            if (warnReasonInput) warnReasonInput.value = '';
        });
    }

    // --- BANOVÁNÍ (Z PLAYER MODALU) ---
    const btnModalBan = document.getElementById('btnModalBan');
    if (btnModalBan) {
        btnModalBan.addEventListener('click', () => {
            const reason = document.getElementById('modalBanReason')?.value.trim();
            const duration = document.getElementById('modalBanDuration')?.value;
            if (!selectedPlayerId || !reason) {
                showToast('Zadej důvod banu.', 'danger');
                return;
            }
            if (!confirm(`Opravdu chceš zabanovat tohoto hráče? (${duration})`)) return;

            sendNUI('executeAction', { action: 'banPlayer', id: selectedPlayerId, reason, duration });
            showToast('Hráč byl zabanován.', 'danger');
            modal?.classList.remove('show');
        });
    }

    // --- RYCHLÝ BAN (SEKCE BANY) ---
    const btnQuickBan = document.getElementById('btnQuickBan');
    if (btnQuickBan) {
        btnQuickBan.addEventListener('click', () => {
            const targetId = document.getElementById('banPlayerId')?.value.trim();
            const reason = document.getElementById('banReason')?.value.trim();
            const duration = document.getElementById('banDuration')?.value;
            if (!targetId || !reason) {
                showToast('Vyplň ID hráče a důvod.', 'danger');
                return;
            }
            if (!confirm(`Zabanovat hráče "${targetId}"? (${duration})`)) return;

            sendNUI('executeAction', { action: 'banPlayer', id: targetId, reason, duration });
            showToast('Ban byl udělen.', 'danger');
            document.getElementById('banPlayerId').value = '';
            document.getElementById('banReason').value = '';
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
            openPlayerModal(blip.getAttribute('data-player'), blip.getAttribute('data-name'));
        });
    });

    // --- ACL: MODAL ÚPRAVY OPRÁVNĚNÍ ADMINA ---
    const permissionsModal = document.getElementById('permissionsModal');
    const modalAdminName = document.getElementById('modalAdminName');
    const closePermissionsModalBtn = document.getElementById('closePermissionsModalBtn');
    const btnSavePermissions = document.getElementById('btnSavePermissions');

    function attachPermissionsHandler(btn) {
        btn.addEventListener('click', (e) => {
            selectedAdminName = e.currentTarget.getAttribute('data-admin');
            if (modalAdminName) modalAdminName.innerText = `Oprávnění administrátora: ${selectedAdminName}`;
            if (permissionsModal) permissionsModal.classList.add('show');
        });
    }
    function attachRemoveAdminHandler(btn) {
        btn.addEventListener('click', (e) => {
            const adminName = e.currentTarget.getAttribute('data-admin');
            sendNUI('executeAction', { action: 'removeAdmin', admin: adminName });
            e.currentTarget.closest('tr')?.remove();
            showToast(`${adminName} byl odebrán z administrátorského týmu.`, 'danger');
        });
    }

    document.querySelectorAll('.btn-edit-permissions').forEach(attachPermissionsHandler);
    document.querySelectorAll('button[data-action="removeAdmin"]').forEach(attachRemoveAdminHandler);

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
            showToast(`Oprávnění pro ${selectedAdminName} byla uložena.`, 'success');
            if (permissionsModal) permissionsModal.classList.remove('show');
        });
    }

    // --- SPRÁVA ADMINŮ: PŘIDÁNÍ NOVÉHO ADMINA ---
    const addAdminModal = document.getElementById('addAdminModal');
    const btnOpenAddAdminModal = document.getElementById('btnOpenAddAdminModal');
    const closeAddAdminModalBtn = document.getElementById('closeAddAdminModalBtn');
    const btnConfirmAddAdmin = document.getElementById('btnConfirmAddAdmin');
    const adminList = document.getElementById('adminList');

    btnOpenAddAdminModal?.addEventListener('click', () => addAdminModal?.classList.add('show'));
    closeAddAdminModalBtn?.addEventListener('click', () => addAdminModal?.classList.remove('show'));

    btnConfirmAddAdmin?.addEventListener('click', () => {
        const name = document.getElementById('newAdminName')?.value.trim();
        const identifier = document.getElementById('newAdminIdentifier')?.value.trim();
        const role = document.getElementById('newAdminRole')?.value;
        const roleLabels = { trial: 'Trial Admin', admin: 'Admin', senior: 'Senior Admin', super: 'SuperAdmin' };
        const roleBadgeClass = { trial: 'badge-warning', admin: 'badge-accent', senior: 'badge-accent', super: 'badge-danger' };

        if (!name || !identifier) {
            showToast('Vyplň jméno i identifikátor hráče.', 'danger');
            return;
        }

        sendNUI('executeAction', { action: 'addAdmin', name, identifier, role });

        if (adminList) {
            const row = document.createElement('tr');
            row.setAttribute('data-admin-row', name);
            row.innerHTML = `
                <td><strong>${escapeHtml(name)}</strong></td>
                <td><code>${escapeHtml(identifier)}</code></td>
                <td><span class="badge ${roleBadgeClass[role] || 'badge-accent'}">${roleLabels[role] || role}</span></td>
                <td class="table-actions">
                    <button class="btn btn-small btn-edit-permissions" data-admin="${escapeHtml(name)}">Upravit Práva</button>
                    <button class="btn btn-small btn-danger" data-action="removeAdmin" data-admin="${escapeHtml(name)}">Odebrat</button>
                </td>`;
            adminList.appendChild(row);

            attachPermissionsHandler(row.querySelector('.btn-edit-permissions'));
            attachRemoveAdminHandler(row.querySelector('[data-action="removeAdmin"]'));
        }

        showToast(`${name} byl přidán jako ${roleLabels[role] || role}.`, 'success');
        document.getElementById('newAdminName').value = '';
        document.getElementById('newAdminIdentifier').value = '';
        addAdminModal?.classList.remove('show');
    });

    // --- WHITELIST: SCHVÁLENÍ / ODMÍTNUTÍ ---
    function updateWhitelistBadge() {
        const remaining = document.querySelectorAll('#whitelist .data-table tbody tr').length;
        const badge = document.getElementById('whitelistPendingBadge');
        if (badge) badge.innerText = `Čeká na schválení: ${remaining}`;
    }

    document.querySelectorAll('button[data-action="approveWhitelist"], button[data-action="rejectWhitelist"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const action = target.getAttribute('data-action');
            const id = target.getAttribute('data-id');
            sendNUI('executeAction', { action, id });
            target.closest('tr')?.remove();
            updateWhitelistBadge();
            showToast(
                action === 'approveWhitelist' ? 'Žádost byla schválena.' : 'Žádost byla odmítnuta.',
                action === 'approveWhitelist' ? 'success' : 'danger'
            );
        });
    });

    // --- REPORTY: UZAVŘENÍ, PŘEVZETÍ, CHAT ---
    function updateReportsCount() {
        const remaining = document.querySelectorAll('#reportsList .report-item').length;
        const badge = document.getElementById('reportsBadge');
        const pendingCount = document.getElementById('reportsPendingCount');
        if (badge) badge.innerText = `[${remaining}]`;
        if (pendingCount) pendingCount.innerText = String(remaining);
    }

    const chatModal = document.getElementById('chatModal');
    const chatModalTitle = document.getElementById('chatModalTitle');
    const reportChatMessages = document.getElementById('reportChatMessages');
    const reportChatInput = document.getElementById('reportChatInput');
    const sendReportChatBtn = document.getElementById('sendReportChatBtn');

    function attachCloseReportHandler(btn) {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (!confirm('Opravdu chceš tento report uzavřít?')) return;
            sendNUI('executeAction', { action: 'closeReport', id });
            document.getElementById(`report-${id}`)?.remove();
            updateReportsCount();
            showToast(`Report #${id} byl uzavřen.`, 'success');
        });
    }
    function attachOpenReportChatHandler(btn) {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            selectedReportId = target.getAttribute('data-id');
            const playerName = target.getAttribute('data-name') || 'hráč';
            if (chatModalTitle) chatModalTitle.innerText = `Chat s hráčem — Report #${selectedReportId} (${playerName})`;
            if (reportChatMessages) {
                reportChatMessages.innerHTML = '<div class="msg system">Chat k reportu je viditelný pouze pro adminy a hráče.</div>';
            }
            chatModal?.classList.add('show');
        });
    }

    document.querySelectorAll('button[data-action="closeReport"]').forEach(attachCloseReportHandler);
    document.querySelectorAll('button[data-action="openReportChat"]').forEach(attachOpenReportChatHandler);

    const handleSendReportChat = () => {
        if (!reportChatInput?.value.trim() || !selectedReportId) return;
        const msg = reportChatInput.value.trim();
        const msgElem = document.createElement('div');
        msgElem.className = 'msg admin';
        msgElem.innerHTML = `<strong>Admin:</strong> ${escapeHtml(msg)}`;
        reportChatMessages?.appendChild(msgElem);
        if (reportChatMessages) reportChatMessages.scrollTop = reportChatMessages.scrollHeight;
        sendNUI('executeAction', { action: 'sendReportChatMessage', id: selectedReportId, message: msg });
        reportChatInput.value = '';
    };
    sendReportChatBtn?.addEventListener('click', handleSendReportChat);
    reportChatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendReportChat();
    });

    // --- REPORTY: ZAPSÁNÍ MANUÁLNÍHO REPORTU ---
    const createReportModal = document.getElementById('createReportModal');
    const btnCreateReport = document.getElementById('btnCreateReport');
    const btnConfirmCreateReport = document.getElementById('btnConfirmCreateReport');
    const reportsList = document.getElementById('reportsList');

    btnCreateReport?.addEventListener('click', () => createReportModal?.classList.add('show'));

    btnConfirmCreateReport?.addEventListener('click', () => {
        const playerRef = document.getElementById('newReportPlayerId')?.value.trim();
        const title = document.getElementById('newReportTitle')?.value.trim();
        const category = document.getElementById('newReportCategory')?.value;
        const categoryLabels = {
            rdm: 'RDM / Trolling', bug: 'Herní bug', rulebreak: 'Porušení pravidel', other: 'Ostatní'
        };

        if (!playerRef || !title) {
            showToast('Vyplň hráče i předmět reportu.', 'danger');
            return;
        }

        const newId = String(Date.now()).slice(-5);
        sendNUI('executeAction', { action: 'createManualReport', playerRef, title, category });

        if (reportsList) {
            const card = document.createElement('div');
            card.className = 'card report-item';
            card.id = `report-${newId}`;
            card.innerHTML = `
                <div class="report-header">
                    <div>
                        <span class="badge badge-warning">#${newId} - ${escapeHtml(categoryLabels[category] || category)}</span>
                        <h3 style="margin-top: 0.3rem;">${escapeHtml(title)}</h3>
                        <p class="report-meta">Hráč: <strong>${escapeHtml(playerRef)}</strong> | Právě teď (manuální zápis)</p>
                    </div>
                    <div class="report-actions">
                        <button class="btn btn-small btn-ghost" data-action="openReportChat" data-id="${newId}" data-name="${escapeHtml(playerRef)}">Otevřít Chat</button>
                        <button class="btn btn-small btn-danger" data-action="closeReport" data-id="${newId}">Uzavřít</button>
                    </div>
                </div>`;
            reportsList.prepend(card);

            attachOpenReportChatHandler(card.querySelector('[data-action="openReportChat"]'));
            attachCloseReportHandler(card.querySelector('[data-action="closeReport"]'));
        }

        updateReportsCount();
        showToast('Manuální report byl zapsán.', 'success');
        document.getElementById('newReportPlayerId').value = '';
        document.getElementById('newReportTitle').value = '';
        createReportModal?.classList.remove('show');
    });

    updateReportsCount();

    // --- ADMIN DUTY TOGGLE ---
    const dutyToggle = document.getElementById('dutyToggle');
    const dutyStatusLabel = document.getElementById('dutyStatusLabel');
    if (dutyToggle) {
        dutyToggle.addEventListener('change', () => {
            const onDuty = dutyToggle.checked;
            if (dutyStatusLabel) dutyStatusLabel.innerText = onDuty ? 'Na duty' : 'Mimo duty';
            sendNUI('executeAction', { action: 'toggleAdminDuty', state: onDuty });
            showToast(onDuty ? 'Byl jsi nastaven jako aktivní admin (on duty).' : 'Ukončil jsi admin duty.', onDuty ? 'success' : 'warning');
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
            showToast('Konfigurace webhooku byla uložena.', 'success');
        });
    }

    if (btnTestWebhook) {
        btnTestWebhook.addEventListener('click', () => {
            sendNUI('executeAction', { action: 'testWebhook' });
            showToast('Testovací zpráva byla odeslána na Discord.', 'default');
        });
    }

    // --- ZAVÍRÁNÍ ---
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeNUI);

    document.addEventListener('keyup', (e) => {
        if (e.key === "Escape") {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                openModal.classList.remove('show');
            } else {
                closeNUI();
            }
        }
    });

    // Kliknutí mimo modal-box zavře modální okno (kliknutí na overlay)
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) m.classList.remove('show');
        });
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
