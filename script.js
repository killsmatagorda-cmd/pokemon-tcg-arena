// Sistema de Dublagem e Sons (Howler.js)
const sounds = {
    // SFX
    hit: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'], volume: 0.5 }),
    critical: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'], volume: 0.8 }),
    heal: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1954/1954-preview.mp3'], volume: 0.5 }),
    click: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], volume: 0.3 }),
    
    // Dublagens (Exemplos de URLs de voz sintetizada ou assets)
    v_your_turn: new Howl({ src: ['https://translate.google.com/translate_tts?ie=UTF-8&q=%C3%89%20a%20sua%20vez!&tl=pt&client=tw-ob'], format: ['mp3'], volume: 0.8 }),
    v_critical: new Howl({ src: ['https://translate.google.com/translate_tts?ie=UTF-8&q=Dano%20Cr%C3%ADtico!&tl=pt&client=tw-ob'], format: ['mp3'], volume: 0.9 }),
    v_victory: new Howl({ src: ['https://translate.google.com/translate_tts?ie=UTF-8&q=Vit%C3%B3ria%20Absoluta!&tl=pt&client=tw-ob'], format: ['mp3'], volume: 1.0 })
};

let socket, myId, opponentId, gameState = { player: null, opponent: null, turn: "none" };

window.onload = async () => {
    const params = new URLSearchParams(window.location.search);
    const serverUrl = params.get('server');
    const p1Id = params.get('p1'), p2Id = params.get('p2');

    if (!serverUrl) return log("Erro: Falha na conexão WebSocket.");

    socket = io(serverUrl);
    socket.on('connect', () => {
        myId = prompt("Seu ID do Discord:") || p1Id;
        socket.emit('join_battle', { p1: p1Id, p2: p2Id, isPlayer1: (myId === p1Id) });
    });

    socket.on('sync_state', (state) => {
        const me = state.p1.id === myId ? state.p1 : state.p2;
        const opp = state.p1.id === myId ? state.p2 : state.p1;
        gameState.player = me; gameState.opponent = opp;
        gameState.turn = state.turn === 'p1' ? state.p1.id : state.p2.id;
        updateUI();
        if (state.status === 'playing') document.getElementById('deck-selection').classList.add('hidden');
    });

    socket.on('action_result', (data) => {
        log(data.message);
        
        if (data.action === 'attack') {
            const isAttackerMe = data.attacker === myId;
            const attackerCard = isAttackerMe ? document.getElementById('player-card') : document.getElementById('opponent-card');
            
            // ANIMAÇÃO DE PROJEÇÃO FÍSICA
            attackerCard.classList.add(isAttackerMe ? 'project-forward-p1' : 'project-forward-p2');
            setTimeout(() => attackerCard.classList.remove('project-forward-p1', 'project-forward-p2'), 600);

            // Sons e Vozes
            if (data.isCritical) {
                sounds.critical.play();
                sounds.v_critical.play();
            } else {
                sounds.hit.play();
            }
            
            animateImpact(data.target === myId ? 'player-card' : 'opponent-card');
            createParticles(data.target === myId ? 'player-card' : 'opponent-card', 'fire-particle');

        } else if (data.action === 'voice') {
            if (data.type === 'your_turn') sounds.v_your_turn.play();
        } else if (data.action === 'heal') {
            sounds.heal.play();
        }
    });

    setupHUD();
};

function setupHUD() {
    document.getElementById('btn-atacar').onclick = () => toggleMenu('attack-menu', renderAttacks);
    document.getElementById('btn-defesa').onclick = () => {
        if (gameState.turn !== myId) return;
        socket.emit('player_action', { action: 'defend' });
    };
    document.getElementById('btn-item').onclick = () => toggleMenu('item-menu', renderItems);
}

function renderAttacks() {
    const menu = document.getElementById('attack-menu'); menu.innerHTML = '';
    gameState.player.attacks.forEach((atk, i) => {
        const btn = document.createElement('button');
        btn.className = 'attack-option';
        btn.innerHTML = `<strong>${atk.name}</strong><span>Dano: ${atk.damage}</span>`;
        btn.onclick = () => {
            if (gameState.turn !== myId) return;
            socket.emit('player_action', { action: 'attack', index: i });
            menu.parentElement.classList.add('hidden');
        };
        menu.appendChild(btn);
    });
}

function renderItems() {
    const menu = document.getElementById('item-menu');
    menu.innerHTML = `<button class="attack-option" onclick="usePotion()">Poção (x${gameState.player.potion})</button>`;
}

function usePotion() {
    if (gameState.turn !== myId) return;
    socket.emit('player_action', { action: 'item', itemType: 'potion' });
    document.getElementById('item-menu').classList.add('hidden');
}

function toggleMenu(id, renderer) {
    sounds.click.play();
    const menu = document.getElementById(id);
    const isHidden = menu.classList.contains('hidden');
    document.querySelectorAll('.submenu').forEach(m => m.classList.add('hidden'));
    if (isHidden) { menu.classList.remove('hidden'); renderer(); }
}

function updateUI() {
    if (!gameState.player) return;
    // Update HP Bars & Texts
    const p1 = gameState.player, p2 = gameState.opponent;
    document.getElementById('player-hp-bar').style.width = (p1.hp/p1.maxHp*100)+'%';
    document.getElementById('opponent-hp-bar').style.width = (p2.hp/p2.maxHp*100)+'%';
    document.getElementById('player-hp-text').innerText = `${p1.hp}/${p1.maxHp} HP`;
    document.getElementById('opponent-hp-text').innerText = `${p2.hp}/${p2.maxHp} HP`;
    document.getElementById('player-name').innerText = p1.name;
    document.getElementById('opponent-name').innerText = p2.name;
    document.getElementById('player-img').src = p1.image;
    document.getElementById('opponent-img').src = p2.image;
    
    // Indicador de Turno Visual
    document.getElementById('battle-log').style.boxShadow = gameState.turn === myId ? "0 0 20px #00ff00 inset" : "none";
}

function animateImpact(id) {
    const el = document.getElementById(id);
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
}

function createParticles(id, type) {
    const rect = document.getElementById(id).getBoundingClientRect();
    for(let i=0; i<8; i++) {
        const p = document.createElement('div');
        p.className = 'particle fire-particle';
        p.style.left = (rect.left + Math.random()*rect.width)+'px';
        p.style.top = (rect.top + Math.random()*rect.height)+'px';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 600);
    }
}

function log(m) {
    const b = document.getElementById('battle-log');
    const p = document.createElement('p'); p.innerText = "> "+m;
    b.prepend(p);
}