// Sons usando Howler.js
const sounds = {
    hit: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'], volume: 0.5 }),
    heal: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1954/1954-preview.mp3'], volume: 0.5 }),
    win: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'], volume: 0.7 }),
    click: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], volume: 0.3 }),
    switch: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'], volume: 0.4 })
};

let socket;
let myId;
let opponentId;
let battleId;

let gameState = {
    player: null,
    opponent: null,
    turn: "none"
};

window.onload = async () => {
    const params = new URLSearchParams(window.location.search);
    const p1Id = params.get('p1');
    const p2Id = params.get('p2');
    const serverUrl = params.get('server');
    
    // Conectar ao Servidor WebSocket
    if (serverUrl) {
        // Inicializa o Socket
        socket = io(serverUrl);
        
        socket.on('connect', () => {
            log(`Conectado ao Servidor PvP!`);
            
            // O jogador que clica no link precisa se identificar. 
            // Como é um link público, vamos usar um truque simples para este protótipo:
            // Vamos perguntar quem ele é, ou assumir com base em um prompt.
            let whoAmI = prompt("Qual é o seu ID do Discord? (Deixe em branco para simular como Desafiante)");
            
            if (whoAmI === p2Id) {
                myId = p2Id;
                opponentId = p1Id;
            } else {
                myId = p1Id;
                opponentId = p2Id;
            }

            // Entra na sala
            socket.emit('join_battle', { 
                p1: p1Id, 
                p2: p2Id, 
                isPlayer1: (myId === p1Id)
            });
        });

        socket.on('battle_status', (data) => {
            log(data.message);
        });

        socket.on('sync_state', (state) => {
            // state contém { p1: {}, p2: {}, turn: 'p1', status: 'playing' }
            const me = state.p1.id === myId ? state.p1 : state.p2;
            const opp = state.p1.id === myId ? state.p2 : state.p1;
            
            gameState.player = me;
            gameState.opponent = opp;
            gameState.turn = state.turn === 'p1' ? state.p1.id : state.p2.id;
            
            updateUI();
            
            if (state.status === 'playing') {
                document.getElementById('deck-selection').classList.add('hidden');
            }
        });

        socket.on('action_result', (data) => {
            log(data.message);
            if (data.action === 'attack') {
                sounds.hit.play();
                animateImpact(data.target === myId ? 'player-card' : 'opponent-card');
                createParticles(data.target === myId ? 'player-card' : 'opponent-card', 'fire-particle');
            } else if (data.action === 'heal') {
                sounds.heal.play();
            } else if (data.action === 'defend') {
                sounds.click.play();
            }
        });

    } else {
        log("Erro: Servidor PvP não encontrado na URL.");
    }
    
    setupHUD();
};

function setupHUD() {
    document.getElementById('btn-atacar').onclick = () => toggleSubmenu('attack-menu', renderAttacks);
    document.getElementById('btn-defesa').onclick = () => useDefense();
    document.getElementById('btn-item').onclick = () => toggleSubmenu('item-menu', renderItems);
}

function toggleSubmenu(id, renderer) {
    sounds.click.play();
    const menus = ['attack-menu', 'item-menu', 'switch-menu'];
    menus.forEach(m => {
        if (m === id) {
            const el = document.getElementById(m);
            if (el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                renderer();
            } else {
                el.classList.add('hidden');
            }
        } else {
            const el = document.getElementById(m);
            if(el) el.classList.add('hidden');
        }
    });
}

function renderAttacks() {
    const menu = document.getElementById('attack-menu');
    menu.innerHTML = '';
    if (!gameState.player || !gameState.player.attacks) return;

    gameState.player.attacks.forEach((atk, i) => {
        const btn = document.createElement('button');
        btn.className = 'attack-option';
        btn.innerHTML = `<strong>${atk.name}</strong><span class="cost">Dano: ${atk.damage}</span>`;
        btn.onclick = () => {
            if (gameState.turn !== myId) return log("Não é o seu turno!");
            
            // Animação local antes de mandar pro server
            const pImg = document.getElementById('player-img');
            pImg.classList.add('attack-anim');
            setTimeout(() => pImg.classList.remove('attack-anim'), 500);

            socket.emit('player_action', { action: 'attack', index: i });
            document.getElementById('attack-menu').classList.add('hidden');
        };
        menu.appendChild(btn);
    });
}

function renderItems() {
    const menu = document.getElementById('item-menu');
    menu.innerHTML = `<button class="attack-option" onclick="useItem('potion')">Poção (x${gameState.player.potion || 0})</button>`;
}

function useDefense() {
    if (gameState.turn !== myId) return log("Não é o seu turno!");
    socket.emit('player_action', { action: 'defend' });
    document.getElementById('attack-menu').classList.add('hidden'); // fecha menus abertos
}

function useItem(type) {
    if (gameState.turn !== myId) return log("Não é o seu turno!");
    socket.emit('player_action', { action: 'item', itemType: type });
    document.getElementById('item-menu').classList.add('hidden');
}

function updateUI() {
    if (!gameState.player || !gameState.opponent) return;

    // Player
    if(gameState.player.name) document.getElementById('player-name').innerText = gameState.player.name;
    if(gameState.player.img) document.getElementById('player-img').src = gameState.player.img;
    const pPercent = (gameState.player.hp / gameState.player.maxHp) * 100;
    document.getElementById('player-hp-bar').style.width = Math.max(0, pPercent) + '%';
    document.getElementById('player-hp-text').innerText = `${gameState.player.hp} / ${gameState.player.maxHp} HP`;

    // Opponent
    if(gameState.opponent.name) document.getElementById('opponent-name').innerText = gameState.opponent.name;
    if(gameState.opponent.img) document.getElementById('opponent-img').src = gameState.opponent.img;
    const oPercent = (gameState.opponent.hp / gameState.opponent.maxHp) * 100;
    document.getElementById('opponent-hp-bar').style.width = Math.max(0, oPercent) + '%';
    document.getElementById('opponent-hp-text').innerText = `${gameState.opponent.hp} / ${gameState.opponent.maxHp} HP`;
    
    // Status de Turno
    if (gameState.turn === myId) {
        document.getElementById('battle-log').style.borderColor = '#00ff00';
    } else {
        document.getElementById('battle-log').style.borderColor = '#333';
    }
}

function createParticles(targetId, className) {
    const target = document.getElementById(targetId);
    if(!target) return;
    const rect = target.getBoundingClientRect();
    for(let i=0; i<10; i++) {
        const p = document.createElement('div');
        p.className = `particle ${className}`;
        p.style.left = (rect.left + Math.random() * rect.width) + 'px';
        p.style.top = (rect.top + Math.random() * rect.height) + 'px';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 600);
    }
}

function animateImpact(id) {
    const el = document.getElementById(id);
    if(el) {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
    }
}

function log(msg) {
    const logBox = document.getElementById('battle-log');
    if(!logBox) return;
    const p = document.createElement('p');
    p.innerText = `> ${msg}`;
    logBox.prepend(p);
}