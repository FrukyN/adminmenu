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
// (bez vytváření DOM elementu a vynuceného reflow, jako tomu bylo dřív)
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
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

    // --- SPRÁVA VOZIDLA (MODAL) ---
    let selectedVehiclePlate = null;
    const vehicleModal = document.getElementById('vehicleModal');
    const modalVehicleTitle = document.getElementById('modalVehicleTitle');
    const closeVehicleModalBtn = document.getElementById('closeVehicleModalBtn');
    const btnToggleVehicleLock = document.getElementById('btnToggleVehicleLock');
    const btnToggleImpound = document.getElementById('btnToggleImpound');
    const btnDeleteVehicleModal = document.getElementById('btnDeleteVehicleModal');
    const btnTransferVehicleOwner = document.getElementById('btnTransferVehicleOwner');
    const btnSaveVehicleNote = document.getElementById('btnSaveVehicleNote');

    const openVehicleModal = (btn) => {
        selectedVehiclePlate = btn.getAttribute('data-plate');
        const model = btn.getAttribute('data-model') || 'Neznámý model';
        const owner = btn.getAttribute('data-owner') || 'Neznámý majitel';
        const vin = btn.getAttribute('data-vin') || '–';
        const fuel = btn.getAttribute('data-fuel') || '–';
        const engine = btn.getAttribute('data-engine') || '–';
        const body = btn.getAttribute('data-body') || '–';
        const status = btn.getAttribute('data-status') || '–';
        const locked = btn.getAttribute('data-locked') === 'true';
        const impounded = btn.getAttribute('data-impounded') === 'true';

        if (modalVehicleTitle) modalVehicleTitle.innerText = `Vozidlo: ${model} (${selectedVehiclePlate})`;
        document.getElementById('modalVehiclePlate').innerText = selectedVehiclePlate;
        document.getElementById('modalVehicleVin').innerText = vin;
        document.getElementById('modalVehicleModel').innerText = model;
        document.getElementById('modalVehicleOwner').innerText = owner;
        document.getElementById('modalVehicleFuel').innerText = `${fuel}%`;
        document.getElementById('modalVehicleEngine').innerText = `${engine}%`;
        document.getElementById('modalVehicleBody').innerText = `${body}%`;
        document.getElementById('modalVehicleStatus').innerText = status;

        if (btnToggleVehicleLock) {
            btnToggleVehicleLock.setAttribute('data-locked', String(locked));
            btnToggleVehicleLock.innerText = locked ? 'Odemknout dveře' : 'Zamknout dveře';
        }
        if (btnToggleImpound) {
            btnToggleImpound.setAttribute('data-impounded', String(impounded));
            btnToggleImpound.innerText = impounded ? 'Vydat z depa' : 'Zabavit do depa';
        }

        // Dynamicky nastavíme id vozidla na tlačítka rychlých akcí uvnitř modalu,
        // aby je zachytil obecný handler pro button[data-action].
        vehicleModal?.querySelectorAll('[data-action]').forEach(actionBtn => {
            actionBtn.setAttribute('data-id', selectedVehiclePlate);
        });

        document.getElementById('vehicleNoteInput').value = '';
        document.getElementById('vehicleNewOwnerInput').value = '';
        vehicleModal?.classList.add('show');
    };

    document.querySelectorAll('.btn-vehicle-modal').forEach(btn => {
        btn.addEventListener('click', (e) => openVehicleModal(e.currentTarget));
    });

    closeVehicleModalBtn?.addEventListener('click', () => {
        vehicleModal?.classList.remove('show');
        selectedVehiclePlate = null;
    });

    btnToggleVehicleLock?.addEventListener('click', () => {
        if (!selectedVehiclePlate) return;
        const isLocked = btnToggleVehicleLock.getAttribute('data-locked') === 'true';
        const newState = !isLocked;
        btnToggleVehicleLock.setAttribute('data-locked', String(newState));
        btnToggleVehicleLock.innerText = newState ? 'Odemknout dveře' : 'Zamknout dveře';
        sendNUI('executeAction', { action: 'toggleVehicleLock', plate: selectedVehiclePlate, locked: newState });
        showToast(newState ? 'Vozidlo bylo zamčeno.' : 'Vozidlo bylo odemčeno.', 'warning');
    });

    btnToggleImpound?.addEventListener('click', () => {
        if (!selectedVehiclePlate) return;
        const isImpounded = btnToggleImpound.getAttribute('data-impounded') === 'true';
        const newState = !isImpounded;
        btnToggleImpound.setAttribute('data-impounded', String(newState));
        btnToggleImpound.innerText = newState ? 'Vydat z depa' : 'Zabavit do depa';
        sendNUI('executeAction', { action: 'toggleVehicleImpound', plate: selectedVehiclePlate, impounded: newState });
        showToast(newState ? 'Vozidlo bylo zabaveno do depa.' : 'Vozidlo bylo vydáno z depa.', newState ? 'danger' : 'success');
    });

    const btnRepairVehicleModal = vehicleModal?.querySelector('[data-action="repairVehicleModal"]');
    const btnRefuelVehicleModal = vehicleModal?.querySelector('[data-action="refuelVehicleModal"]');

    btnRepairVehicleModal?.addEventListener('click', () => {
        if (!selectedVehiclePlate) return;
        sendNUI('executeAction', { action: 'repairVehicle', plate: selectedVehiclePlate });
        const engineElem = document.getElementById('modalVehicleEngine');
        const bodyElem = document.getElementById('modalVehicleBody');
        if (engineElem) engineElem.innerText = '100%';
        if (bodyElem) bodyElem.innerText = '100%';
        showToast('Vozidlo bylo opraveno a vyčištěno.', 'success');
    });

    btnRefuelVehicleModal?.addEventListener('click', () => {
        if (!selectedVehiclePlate) return;
        sendNUI('executeAction', { action: 'refuelVehicle', plate: selectedVehiclePlate });
        const fuelElem = document.getElementById('modalVehicleFuel');
        if (fuelElem) fuelElem.innerText = '100%';
        showToast('Vozidlo bylo dotankováno.', 'success');
    });

    btnDeleteVehicleModal?.addEventListener('click', () => {
        if (!selectedVehiclePlate) return;
        if (!confirm('Opravdu chceš toto vozidlo trvale smazat? Tuto akci nelze vzít zpět.')) return;
        sendNUI('executeAction', { action: 'deleteVehicle', plate: selectedVehiclePlate });
        showToast(`Vozidlo ${selectedVehiclePlate} bylo smazáno.`, 'danger');
        vehicleModal?.classList.remove('show');
    });

    btnTransferVehicleOwner?.addEventListener('click', () => {
        const newOwner = document.getElementById('vehicleNewOwnerInput')?.value.trim();
        if (!selectedVehiclePlate || !newOwner) {
            showToast('Zadej nového majitele.', 'danger');
            return;
        }
        sendNUI('executeAction', { action: 'transferVehicleOwner', plate: selectedVehiclePlate, newOwner });
        document.getElementById('modalVehicleOwner').innerText = newOwner;
        showToast(`Majitel vozidla byl změněn na ${newOwner}.`, 'success');
        document.getElementById('vehicleNewOwnerInput').value = '';
    });

    btnSaveVehicleNote?.addEventListener('click', () => {
        const note = document.getElementById('vehicleNoteInput')?.value.trim();
        if (!selectedVehiclePlate || !note) {
            showToast('Poznámka nemůže být prázdná.', 'danger');
            return;
        }
        sendNUI('executeAction', { action: 'saveVehicleNote', plate: selectedVehiclePlate, note });
        showToast('Poznámka k vozidlu byla uložena.', 'success');
    });

    // --- SPRÁVA FRAKCE (MODAL) ---
    let selectedFactionId = null;
    const frakceModal = document.getElementById('frakceModal');
    const modalFactionTitle = document.getElementById('modalFactionTitle');
    const closeFrakceModalBtn = document.getElementById('closeFrakceModalBtn');
    const btnPayFactionSalaries = document.getElementById('btnPayFactionSalaries');
    const btnDeleteFaction = document.getElementById('btnDeleteFaction');
    const btnFactionAddFunds = document.getElementById('btnFactionAddFunds');
    const btnFactionRemoveFunds = document.getElementById('btnFactionRemoveFunds');
    const btnSaveFactionNote = document.getElementById('btnSaveFactionNote');

    const formatMoney = (n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('cs-CZ')}`;

    const openFrakceModal = (btn) => {
        selectedFactionId = btn.getAttribute('data-faction');
        const label = btn.getAttribute('data-faction-label') || selectedFactionId;
        const type = btn.getAttribute('data-type') || '–';
        const account = btn.getAttribute('data-account') || '–';
        const accountClass = btn.getAttribute('data-account-class') || 'text-success';
        const balance = Number(btn.getAttribute('data-balance') || 0);
        const members = btn.getAttribute('data-members') || '0';
        const boss = btn.getAttribute('data-boss') || '–';

        if (modalFactionTitle) modalFactionTitle.innerText = `Frakce: ${label}`;
        document.getElementById('modalFactionId').innerText = selectedFactionId;
        document.getElementById('modalFactionBoss').innerText = boss;
        document.getElementById('modalFactionType').innerText = type;
        document.getElementById('modalFactionMembers').innerText = members;

        const accountElem = document.getElementById('modalFactionAccount');
        accountElem.innerText = account;
        accountElem.className = accountClass;

        const balanceElem = document.getElementById('modalFactionBalance');
        balanceElem.innerText = formatMoney(balance);
        balanceElem.className = balance < 0 ? 'text-danger' : 'text-success';
        balanceElem.setAttribute('data-balance', String(balance));

        frakceModal?.querySelectorAll('[data-action]').forEach(actionBtn => {
            actionBtn.setAttribute('data-id', selectedFactionId);
        });

        document.getElementById('factionNoteInput').value = '';
        document.getElementById('factionAmountInput').value = '';
        frakceModal?.classList.add('show');
    };

    document.querySelectorAll('.btn-frakce-modal').forEach(btn => {
        btn.addEventListener('click', (e) => openFrakceModal(e.currentTarget));
    });

    closeFrakceModalBtn?.addEventListener('click', () => {
        frakceModal?.classList.remove('show');
        selectedFactionId = null;
    });

    btnPayFactionSalaries?.addEventListener('click', () => {
        if (!selectedFactionId) return;
        if (!confirm('Vynutit vyplacení výplat všem online členům frakce?')) return;
        sendNUI('executeAction', { action: 'payFactionSalaries', faction: selectedFactionId });
        showToast('Výplaty byly vyplaceny.', 'success');
    });

    btnDeleteFaction?.addEventListener('click', () => {
        if (!selectedFactionId) return;
        if (!confirm('Opravdu chceš tuto frakci trvale zrušit? Tuto akci nelze vzít zpět.')) return;
        sendNUI('executeAction', { action: 'deleteFaction', faction: selectedFactionId });
        showToast('Frakce byla zrušena.', 'danger');
        frakceModal?.classList.remove('show');
    });

    const handleFactionFunds = (mode) => {
        const amount = Number(document.getElementById('factionAmountInput')?.value);
        if (!selectedFactionId || !amount || amount <= 0) {
            showToast('Zadej platnou částku.', 'danger');
            return;
        }
        const balanceElem = document.getElementById('modalFactionBalance');
        const current = Number(balanceElem.getAttribute('data-balance') || 0);
        const updated = mode === 'add' ? current + amount : current - amount;
        balanceElem.innerText = formatMoney(updated);
        balanceElem.className = updated < 0 ? 'text-danger' : 'text-success';
        balanceElem.setAttribute('data-balance', String(updated));

        sendNUI('executeAction', { action: 'setFactionBalance', mode, faction: selectedFactionId, amount });
        showToast(
            mode === 'add' ? `Frakci přidáno ${formatMoney(amount)}.` : `Frakci odebráno ${formatMoney(amount)}.`,
            'success'
        );
        document.getElementById('factionAmountInput').value = '';
    };
    btnFactionAddFunds?.addEventListener('click', () => handleFactionFunds('add'));
    btnFactionRemoveFunds?.addEventListener('click', () => handleFactionFunds('remove'));

    btnSaveFactionNote?.addEventListener('click', () => {
        const note = document.getElementById('factionNoteInput')?.value.trim();
        if (!selectedFactionId || !note) {
            showToast('Poznámka nemůže být prázdná.', 'danger');
            return;
        }
        sendNUI('executeAction', { action: 'saveFactionNote', faction: selectedFactionId, note });
        showToast('Poznámka k frakci byla uložena.', 'success');
    });

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
                'removeAdmin', 'sendAnnouncement', 'unbanPlayer', 'clearWarn',
                'repairVehicleModal', 'refuelVehicleModal'
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

    // --- PLÁNOVANÝ RESTART SERVERU (obdoba plánovaného restartu v txAdmin) ---
    const plannedRestartModal = document.getElementById('plannedRestartModal');
    const btnPlannedrestart = document.getElementById('btnPlannedrestart');
    const closePlannedRestartModalBtn = document.getElementById('closePlannedRestartModalBtn');
    const plannedRestartTimeInput = document.getElementById('plannedRestartTimeInput');
    const plannedRestartMessage = document.getElementById('plannedRestartMessage');
    const btnConfirmPlannedRestart = document.getElementById('btnConfirmPlannedRestart');
    const btnCancelPlannedRestart = document.getElementById('btnCancelPlannedRestart');
    const plannedRestartActiveBox = document.getElementById('plannedRestartActiveBox');
    const plannedRestartActiveTime = document.getElementById('plannedRestartActiveTime');
    const plannedRestartCountdown = document.getElementById('plannedRestartCountdown');
    const statNextRestart = document.getElementById('statNextRestart');
    const presetButtons = plannedRestartModal ? plannedRestartModal.querySelectorAll('[data-preset]') : [];
    const warnCheckboxes = plannedRestartModal ? plannedRestartModal.querySelectorAll('[data-warn-min]') : [];

    let scheduledRestartAt = null; // Date, kdy má dojít k restartu
    let scheduledWarnedMinutes = new Set(); // které varovné hlášky už byly "odeslané" (klientská simulace)
    let restartCountdownInterval = null;

    const formatClock = (date) => date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

    const formatCountdown = (ms) => {
        if (ms <= 0) return 'právě teď';
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) return `${hours} h ${minutes} min`;
        return `${minutes} min`;
    };

    function setNextRestartLabel(text) {
        if (statNextRestart) statNextRestart.innerText = text;
    }

    function stopRestartCountdown() {
        if (restartCountdownInterval) {
            clearInterval(restartCountdownInterval);
            restartCountdownInterval = null;
        }
    }

    function tickRestartCountdown() {
        if (!scheduledRestartAt) return;
        const remainingMs = scheduledRestartAt.getTime() - Date.now();

        if (remainingMs <= 0) {
            if (plannedRestartCountdown) plannedRestartCountdown.innerText = 'probíhá restart…';
            setNextRestartLabel('Restartuje se…');
            stopRestartCountdown();
            return;
        }

        const remainingLabel = formatCountdown(remainingMs);
        if (plannedRestartCountdown) plannedRestartCountdown.innerText = remainingLabel;
        setNextRestartLabel(remainingLabel);

        // Klientská simulace odeslání varovných hlášek (skutečné odeslání řeší server/NUI)
        const remainingMinutes = Math.round(remainingMs / 60000);
        warnCheckboxes.forEach(cb => {
            const minute = Number(cb.getAttribute('data-warn-min'));
            if (cb.checked && remainingMinutes === minute && !scheduledWarnedMinutes.has(minute)) {
                scheduledWarnedMinutes.add(minute);
                showToast(`Varování: server se restartuje za ${minute} min.`, 'warning', 4000);
            }
        });
    }

    function activateScheduledRestartUI() {
        if (!scheduledRestartAt) return;
        plannedRestartActiveBox?.classList.remove('hidden');
        if (plannedRestartActiveTime) plannedRestartActiveTime.innerText = formatClock(scheduledRestartAt);
        btnPlannedrestart && (btnPlannedrestart.innerText = `Naplánováno: ${formatClock(scheduledRestartAt)}`);
        stopRestartCountdown();
        tickRestartCountdown();
        restartCountdownInterval = setInterval(tickRestartCountdown, 15000);
    }

    function resetScheduledRestartUI() {
        scheduledRestartAt = null;
        scheduledWarnedMinutes = new Set();
        stopRestartCountdown();
        plannedRestartActiveBox?.classList.add('hidden');
        if (btnPlannedrestart) btnPlannedrestart.innerText = 'Naplánovat restart';
        setNextRestartLabel('Nenaplánováno');
    }

    btnPlannedrestart?.addEventListener('click', () => {
        // "Naplánovat restart" už neposílá akci rovnou, ale otevře modal s nastavením
        presetButtons.forEach(b => b.classList.remove('active'));
        if (plannedRestartMessage) plannedRestartMessage.value = '';
        if (plannedRestartTimeInput) plannedRestartTimeInput.value = '';
        plannedRestartModal?.classList.add('show');
    });

    closePlannedRestartModalBtn?.addEventListener('click', () => plannedRestartModal?.classList.remove('show'));

    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const minutesFromNow = Number(btn.getAttribute('data-preset'));
            const target = new Date(Date.now() + minutesFromNow * 60000);
            if (plannedRestartTimeInput) {
                const hh = String(target.getHours()).padStart(2, '0');
                const mm = String(target.getMinutes()).padStart(2, '0');
                plannedRestartTimeInput.value = `${hh}:${mm}`;
            }
        });
    });

    plannedRestartTimeInput?.addEventListener('input', () => presetButtons.forEach(b => b.classList.remove('active')));

    btnConfirmPlannedRestart?.addEventListener('click', () => {
        const timeValue = plannedRestartTimeInput?.value;
        if (!timeValue) {
            showToast('Zadej čas restartu nebo zvol rychlou volbu.', 'danger');
            return;
        }

        const [hh, mm] = timeValue.split(':').map(Number);
        const target = new Date();
        target.setSeconds(0, 0);
        target.setHours(hh, mm);
        if (target.getTime() <= Date.now()) {
            // Čas už dnes uplynul -> naplánuj na zítra
            target.setDate(target.getDate() + 1);
        }

        const warnMinutes = Array.from(warnCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => Number(cb.getAttribute('data-warn-min')))
            .sort((a, b) => b - a);

        const message = plannedRestartMessage?.value.trim() || '';

        if (!confirm(`Naplánovat restart serveru na ${formatClock(target)}?`)) return;

        scheduledRestartAt = target;
        scheduledWarnedMinutes = new Set();

        sendNUI('executeAction', {
            action: 'scheduleRestart',
            timestamp: target.getTime(),
            warnMinutes,
            message
        });

        activateScheduledRestartUI();
        showToast(`Restart naplánován na ${formatClock(target)}.`, 'success');
        plannedRestartModal?.classList.remove('show');
    });

    btnCancelPlannedRestart?.addEventListener('click', () => {
        if (!confirm('Opravdu chceš zrušit naplánovaný restart?')) return;
        sendNUI('executeAction', { action: 'cancelScheduledRestart' });
        resetScheduledRestartUI();
        showToast('Naplánovaný restart byl zrušen.', 'warning');
    });

    resetScheduledRestartUI();


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

    // --- ODBANOVÁNÍ HRÁČE (odstraní řádek a upraví počítadlo) ---
    const statActiveBans = document.getElementById('statActiveBans');
    document.querySelectorAll('button[data-action="unbanPlayer"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const id = target.getAttribute('data-id');
            if (!confirm('Opravdu chceš tohoto hráče odbanovat?')) return;
            sendNUI('executeAction', { action: 'unbanPlayer', id });
            target.closest('tr')?.remove();
            if (statActiveBans) {
                statActiveBans.innerText = String(Math.max(0, (parseInt(statActiveBans.innerText, 10) || 0) - 1));
            }
            showToast('Hráč byl odbanován.', 'success');
        });
    });

    // --- ZRUŠENÍ VAROVÁNÍ (odstraní řádek a upraví počítadlo) ---
    const statActiveWarns = document.getElementById('statActiveWarns');
    document.querySelectorAll('button[data-action="clearWarn"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const id = target.getAttribute('data-id');
            if (!confirm('Opravdu chceš toto varování zrušit?')) return;
            sendNUI('executeAction', { action: 'clearWarn', id });
            target.closest('tr')?.remove();
            if (statActiveWarns) {
                statActiveWarns.innerText = String(Math.max(0, (parseInt(statActiveWarns.innerText, 10) || 0) - 1));
            }
            showToast('Varování bylo zrušeno.', 'success');
        });
    });

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

            // Drobná vizuální synchronizace s dashboardem (počet aktivních adminů)
            const activeAdminsElem = document.getElementById('statActiveAdmins');
            if (activeAdminsElem) {
                const current = parseInt(activeAdminsElem.innerText, 10) || 0;
                activeAdminsElem.innerText = String(Math.max(0, current + (onDuty ? 1 : -1)));
            }
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
                const d = data.dashboard;
                const setText = (id, value) => {
                    const el = document.getElementById(id);
                    if (el && value !== undefined && value !== null) el.innerText = value;
                };
                setText('statOnlinePlayers', d.online !== undefined ? `${d.online} / ${d.max}` : undefined);
                setText('statActiveAdmins', d.activeAdmins);
                setText('statPendingReports', d.pendingReports);
                setText('statStatus', d.status);
                setText('statUptime', d.uptime);
                setText('statNextRestart', d.nextRestart);
            }
        }
    });
});
