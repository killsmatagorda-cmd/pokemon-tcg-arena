// Sons usando Howler.js
const sounds = {
    hit: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'], volume: 0.5 }),
    heal: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1954/1954-preview.mp3'], volume: 0.5 }),
    win: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'], volume: 0.7 }),
    click: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], volume: 0.3 }),
    switch: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'], volume: 0.4 })
};

let playerDeck = [];
let gameState = {
    player: null,
    opponent: null,
    turn: "player",
    isDefending: false
};

window.onload = async () => {
    const params = new URLSearchParams(window.location.search);
    const p1Id = params.get('p1');
    const p2Id = params.get('p2');

    const selectionScreen = document.getElementById('deck-selection');

    try {
        const response = await fetch('pokemon_data.json');
        const data = await response.json();

        if (p1Id && p2Id && data.users[p1Id] && data.users[p2Id]) {
            const p1Pkmn = data.users[p1Id][0];
            const p2Pkmn = data.users[p2Id][0];

            gameState.player = { 
                ...p1Pkmn, 
                hp: p1Pkmn.hp, 
                maxHp: p1Pkmn.max_hp, 
                img: p1Pkmn.image,
                items: { potion: 2 } 
            };
            
            gameState.opponent = { 
                name: "Oponente",
                pokemon: p2Pkmn.name, 
                hp: p2Pkmn.hp, 
                maxHp: p2Pkmn.max_hp, 
                img: p2Pkmn.image 
            };

            // Esconde a tela de seleção e mostra o jogo
            selectionScreen.style.display = 'none';
            selectionScreen.classList.add('hidden');
            
            updateUI();
            log(`⚔️ Batalha Iniciada!`);
            log(`${gameState.player.name} vs ${gameState.opponent.pokemon}`);
        } else {
            // Fallback se não houver IDs
            selectionScreen.style.display = 'flex';
            playerDeck = [
                { name: "Pikachu", hp: 100, maxHp: 100, img: "https://images.pokemontcg.io/base1/58_hires.png", attacks: [{name: "Choque do Trovão", damage: 20}, {name: "Trovão", damage: 50}] },
                { name: "Charizard", hp: 150, maxHp: 150, img: "https://images.pokemontcg.io/base1/4_hires.png", attacks: [{name: "Garra de Metal", damage: 30}, {name: "Giro de Fogo", damage: 100}] }
            ];
            initDeckSelection();
        }
    } catch (error) {
        console.error("Erro:", error);
        selectionScreen.innerHTML = "<h1>Erro ao carregar dados da batalha</h1>";
    }
    
    setupHUD();
};

function initDeckSelection() {
    const grid = document.getElementById('deck-grid');
    playerDeck.forEach((pkmn, index) => {
        const div = document.createElement('div');
        div.className = 'selectable-card';
        div.innerHTML = `<img src="${pkmn.img}" alt="${pkmn.name}"><p>${pkmn.name}</p>`;
        div.onclick = () => selectPokemon(index);
        grid.appendChild(div);
    });
}

function selectPokemon(index) {
    gameState.player = { ...playerDeck[index], items: { potion: 2 } };
    document.getElementById('deck-selection').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('deck-selection').classList.add('hidden');
        updateUI();
        log(`Você escolheu ${gameState.player.name}!`);
    }, 500);
}

function setupHUD() {
    document.getElementById('btn-atacar').onclick = () => toggleSubmenu('attack-menu', renderAttacks);
    document.getElementById('btn-defesa').onclick = () => useDefense();
    document.getElementById('btn-item').onclick = () => toggleSubmenu('item-menu', renderItems);
    document.getElementById('btn-trocar').onclick = () => toggleSubmenu('switch-menu', renderDeckToSwitch);
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
            document.getElementById(m).classList.add('hidden');
        }
    });
}

function renderAttacks() {
    const menu = document.getElementById('attack-menu');
    menu.innerHTML = '';
    gameState.player.attacks.forEach((atk, i) => {
        const btn = document.createElement('button');
        btn.className = 'attack-option';
        btn.innerHTML = `<strong>${atk.name}</strong><span class="cost">Dano: ${atk.damage}</span>`;
        btn.onclick = () => playerAttack(i);
        menu.appendChild(btn);
    });
}

function renderDeckToSwitch() {
    const menu = document.getElementById('switch-menu');
    menu.innerHTML = '';
    playerDeck.forEach((pkmn, i) => {
        if (pkmn.name === gameState.player.name) return;
        const btn = document.createElement('button');
        btn.className = 'attack-option';
        btn.innerHTML = `<strong>${pkmn.name}</strong><span class="cost">HP: ${pkmn.hp}/${pkmn.maxHp}</span>`;
        btn.onclick = () => switchPokemon(i);
        menu.appendChild(btn);
    });
}

function renderItems() {
    const menu = document.getElementById('item-menu');
    menu.innerHTML = `<button class="attack-option" onclick="useItem('potion')">Poção (x${gameState.player.items.potion})</button>`;
}

function useDefense() {
    if (gameState.turn !== 'player') return;
    gameState.isDefending = true;
    log(`${gameState.player.name} entrou em posição de defesa!`);
    sounds.click.play();
    endPlayerTurn();
}

function playerAttack(index) {
    if (gameState.turn !== 'player') return;
    const atk = gameState.player.attacks[index];
    
    // Animação de Saída da Carta
    const pImg = document.getElementById('player-img');
    pImg.classList.add('attack-anim');
    setTimeout(() => pImg.classList.remove('attack-anim'), 500);

    createParticles('opponent-card', 'fire-particle');
    
    gameState.opponent.hp = Math.max(0, gameState.opponent.hp - atk.damage);
    log(`${gameState.player.name} usou ${atk.name}!`);
    
    sounds.hit.play();
    updateUI();
    checkGameOver();

    if (gameState.opponent.hp > 0) endPlayerTurn();
}

function endPlayerTurn() {
    gameState.turn = 'opponent';
    document.querySelectorAll('.submenu').forEach(m => m.classList.add('hidden'));
    setTimeout(opponentTurn, 1500);
}

function opponentTurn() {
    let damage = 25;
    if (gameState.isDefending) {
        damage = Math.floor(damage / 2);
        gameState.isDefending = false;
        log("O escudo reduziu o dano!");
    }

    const oImg = document.getElementById('opponent-img');
    oImg.classList.add('attack-anim');
    setTimeout(() => oImg.classList.remove('attack-anim'), 500);

    gameState.player.hp = Math.max(0, gameState.player.hp - damage);
    log(`${gameState.opponent.pokemon} CPU usou ataque psíquico!`);
    
    sounds.hit.play();
    animateImpact('player-card');
    
    updateUI();
    checkGameOver();
    gameState.turn = 'player';
}

function switchPokemon(index) {
    sounds.switch.play();
    gameState.player = { ...playerDeck[index], items: gameState.player.items };
    log(`Você trocou para ${gameState.player.name}!`);
    updateUI();
    endPlayerTurn();
}

function updateUI() {
    if (!gameState.player) return;

    // Player
    document.getElementById('player-name').innerText = gameState.player.name;
    document.getElementById('player-img').src = gameState.player.img;
    const pPercent = (gameState.player.hp / gameState.player.maxHp) * 100;
    document.getElementById('player-hp-bar').style.width = pPercent + '%';
    document.getElementById('player-hp-text').innerText = `${gameState.player.hp} / ${gameState.player.maxHp} HP`;

    // Opponent
    document.getElementById('opponent-name').innerText = gameState.opponent.pokemon;
    document.getElementById('opponent-img').src = gameState.opponent.img;
    const oPercent = (gameState.opponent.hp / gameState.opponent.maxHp) * 100;
    document.getElementById('opponent-hp-bar').style.width = oPercent + '%';
    document.getElementById('opponent-hp-text').innerText = `${gameState.opponent.hp} / ${gameState.opponent.maxHp} HP`;
}

function createParticles(targetId, className) {
    const target = document.getElementById(targetId);
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
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
}

function log(msg) {
    const logBox = document.getElementById('battle-log');
    const p = document.createElement('p');
    p.innerText = `> ${msg}`;
    logBox.prepend(p);
}

function checkGameOver() {
    if (gameState.opponent.hp <= 0) {
        log("VITÓRIA! O oponente foi nocauteado.");
        sounds.win.play();
        gameState.turn = 'none';
    } else if (gameState.player.hp <= 0) {
        log("DERROTA! Seu Pokémon desmaiou.");
        gameState.turn = 'none';
    }
}

function useItem(type) {
    if (type === 'potion' && gameState.player.items.potion > 0) {
        gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + 50);
        gameState.player.items.potion--;
        log(`Usou Poção! HP restaurado.`);
        sounds.heal.play();
        updateUI();
        endPlayerTurn();
    }
}
