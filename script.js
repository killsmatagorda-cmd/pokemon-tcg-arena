// Sons usando Howler.js
const sounds = {
    hit: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'], volume: 0.5 }),
    critical: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'], volume: 0.8 }),
    heal: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1954/1954-preview.mp3'], volume: 0.5 }),
    click: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], volume: 0.3 }),
    
    // Vozes Sintetizadas
    v_your_turn: new Howl({ src: ['https://translate.google.com/translate_tts?ie=UTF-8&q=%C3%89%20a%20sua%20vez!&tl=pt&client=tw-ob'], format: ['mp3'], volume: 0.8 }),
    v_critical: new Howl({ src: ['https://translate.google.com/translate_tts?ie=UTF-8&q=Dano%20Cr%C3%ADtico!&tl=pt&client=tw-ob'], format: ['mp3'], volume: 0.9 })
};

let socket, myId, myDeck = [], gameState = { player: null, opponent: null, turn: "none" };

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    const serverUrl = params.get('server');
    const p1Id = params.get('p1'), p2Id = params.get('p2');

    document.getElementById('btn-start-game').onclick = () => {
        sounds.click.play();
        document.getElementById('start-overlay').classList.add('hidden');
        
        // Conexão Socket
        if (serverUrl) {
            socket = io(serverUrl);
            socket.on('connect', () => {
                log("Conectado! Aguardando ID...");
                // Identifica automaticamente quem você é com base nos params da URL
                // Vamos tentar detectar quem abriu o link. Como o bot envia links específicos, 
                // para este MVP vamos pedir o ID uma vez para confirmar.
                myId = prompt("Confirme seu ID do Discord para carregar seu deck:");
                
                socket.emit('join_battle', { p1: p1Id, p2: p2Id, isPlayer1: (myId === p1Id) });
                loadMyDeck(myId);
            });

            socket.on('sync_state', (state) => {
                const me = state.p1.id === myId ? state.p1 : state.p2;
                const opp = state.p1.id === myId ? state.p2 : state.p1;
                gameState.player = me;
                gameState.opponent = opp;
                gameState.turn = state.turn === 'p1' ? state.p1.id : state.p2.id;
                
                updateUI();

                if (state.status === 'playing') {
                    document.getElementById('deck-selection').classList.add('hidden');
                } else if (state.status === 'waiting' && me.ready === true) {
                    // Já escolheu mas o outro não. Mostra espera.
                    document.getElementById('deck-selection').innerHTML = "<h1>Aguardando oponente escolher...</h1>";
                } else if (state.status === 'waiting') {
                    document.getElementById('deck-selection').classList.remove('hidden');
                }
            });

            socket.on('action_result', (data) => {
                log(data.message);
                if (data.action === 'attack') {
                    const isAttackerMe = data.attacker === myId;
                    const card = document.getElementById(isAttackerMe ? 'player-card' : 'opponent-card');
                    card.classList.add(isAttackerMe ? 'project-forward-p1' : 'project-forward-p2');
                    setTimeout(() => card.classList.remove('project-forward-p1', 'project-forward-p2'), 700);
                    if (data.isCritical) { sounds.critical.play(); sounds.v_critical.play(); } else { sounds.hit.play(); }
                    animateImpact(data.target === myId ? 'player-card' : 'opponent-card');
                } else if (data.action === 'voice' && data.type === 'your_turn') {
                    sounds.v_your_turn.play();
                }
            });
        }
    };
    setupHUD();
};

async function loadMyDeck(id) {
    try {
        const response = await fetch('pokemon_data.json');
        const data = await response.json();
        const userDeck = data.users[id] || [];
        renderDeckSelection(userDeck);
    } catch (e) { log("Erro ao carregar seu deck."); }
}

function renderDeckSelection(deck) {
    const grid = document.getElementById('deck-grid');
    grid.innerHTML = '';
    deck.forEach((pkmn, i) => {
        const div = document.createElement('div');
        div.className = 'selectable-card';
        div.innerHTML = `<img src="${pkmn.image}" alt="${pkmn.name}"><p>${pkmn.name}</p>`;
        div.onclick = () => {
            sounds.click.play();
            socket.emit('select_pokemon', { index: i });
        };
        grid.appendChild(div);
    });
}

function setupHUD() {
    document.getElementById('btn-atacar').onclick = () => toggleMenu('attack-menu', renderAttacks);
    document.getElementById('btn-defesa').onclick = () => socket.emit('player_action', { action: 'defend' });
    document.getElementById('btn-item').onclick = () => toggleMenu('item-menu', renderItems);
}

function renderAttacks() {
    const menu = document.getElementById('attack-menu'); menu.innerHTML = '';
    if(!gameState.player.attacks) return;
    gameState.player.attacks.forEach((atk, i) => {
        const btn = document.createElement('button');
        btn.className = 'attack-option';
        btn.innerHTML = `<strong>${atk.name}</strong><span>Dano: ${atk.damage}</span>`;
        btn.onclick = () => {
            if (gameState.turn !== myId) return;
            socket.emit('player_action', { action: 'attack', index: i });
            menu.classList.add('hidden');
        };
        menu.appendChild(btn);
    });
}

function renderItems() {
    const menu = document.getElementById('item-menu');
    menu.innerHTML = `<button class="attack-option" onclick="usePotion()">Poção (x${gameState.player.potion})</button>`;
}

function usePotion() {
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
    if (!gameState.player || !gameState.opponent) return;
    const p = gameState.player, o = gameState.opponent;
    document.getElementById('player-hp-bar').style.width = (p.hp/p.maxHp*100)+'%';
    document.getElementById('opponent-hp-bar').style.width = (o.hp/o.maxHp*100)+'%';
    document.getElementById('player-hp-text').innerText = `${p.hp}/${p.maxHp} HP`;
    document.getElementById('opponent-hp-text').innerText = `${o.hp}/${o.maxHp} HP`;
    document.getElementById('player-name').innerText = p.name;
    document.getElementById('opponent-name').innerText = o.name;
    document.getElementById('player-img').src = p.image;
    document.getElementById('opponent-img').src = o.image;
    document.getElementById('battle-log').style.boxShadow = gameState.turn === myId ? "0 0 15px #00ff00 inset" : "none";
}

function animateImpact(id) {
    const el = document.getElementById(id);
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
}

function log(m) {
    const b = document.getElementById('battle-log');
    const p = document.createElement('p'); p.innerText = "> "+m;
    b.prepend(p);
}