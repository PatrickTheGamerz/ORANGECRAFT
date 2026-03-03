// --- 0. GAME SAVING, GLOBALS, & OPTIONS PERSISTENCE ---
let savedWorlds = {};
let appSettings = { fov: 75, render: 4, graphics: 1, lighting: 1, music: true, packs: [] };
let achievements = { wood: false, stone: false, iron: false, diamond: false };

try { 
    savedWorlds = JSON.parse(localStorage.getItem('orangecraft_worlds') || '{}'); 
    let s = JSON.parse(localStorage.getItem('orangecraft_settings'));
    if(s) appSettings = {...appSettings, ...s};
} catch(e) {}

let activeWorldId = null; let selectedWorldListId = null;
let newWorldType = "DEFAULT", newWorldMode = "SURVIVAL", newWorldDiff = 1, newWorldChest = false, newWorldCheats = false;
let modifiedBlocks = {}; let fallingBlocks = [];

let optFov = appSettings.fov, optRender = appSettings.render, optGraphics = appSettings.graphics, optLighting = appSettings.lighting, optMusic = appSettings.music;
let isProgrammerArt = appSettings.packs.includes('programmer_art');

let player = { hp: 20, maxHp: 20, food: 20, maxFood: 20, saturation: 5.0, dead: false, flying: false, exhaustion: 0.0 };
let gamerules = { keepInventory: false };

function saveSettings() {
    appSettings = { fov: optFov, render: optRender, graphics: optGraphics, lighting: optLighting, music: optMusic, packs: isProgrammerArt ? ['programmer_art'] : [] };
    localStorage.setItem('orangecraft_settings', JSON.stringify(appSettings));
    if(isProgrammerArt) document.body.classList.add('prog-art'); else document.body.classList.remove('prog-art');
}
if(isProgrammerArt) { document.getElementById('selected-packs').appendChild(document.getElementById('pack-programmer-art')); document.body.classList.add('prog-art'); }

function loadWorldList() {
    let container = document.getElementById('world-list-container'); container.innerHTML = '';
    let keys = Object.keys(savedWorlds);
    if(keys.length === 0) { container.innerHTML = '<div style="color:#aaa; text-align:center; margin-top:20px;">No worlds found. Create one!</div>'; return; }
    keys.forEach(k => {
        let w = savedWorlds[k]; let div = document.createElement('div');
        div.className = 'world-item' + (selectedWorldListId === k ? ' selected' : '');
        div.innerHTML = `<div class="world-item-title">${w.name}</div><div class="world-item-desc">${w.type} Mode • ${w.mode} • ${w.diff===1?'Normal':(w.diff===0?'Peaceful':'Hard')}</div>`;
        div.onclick = () => { selectedWorldListId = k; loadWorldList(); };
        div.ondblclick = () => { selectedWorldListId = k; playSelectedWorld(); };
        container.appendChild(div);
    });
    if(!selectedWorldListId && keys.length > 0) selectedWorldListId = keys[0];
}

function cycleWorldMode() {
    const modes = ["SURVIVAL", "CREATIVE", "SPECTATOR", "HARDCORE", "ADVENTURE"];
    newWorldMode = modes[(modes.indexOf(newWorldMode) + 1) % modes.length];
    document.getElementById('btn-world-mode').innerText = "Game Mode: " + newWorldMode.charAt(0) + newWorldMode.slice(1).toLowerCase();
    let desc = "Resources, crafting, gain levels, health and hunger";
    if(newWorldMode === "CREATIVE") desc = "Unlimited resources, free flying and destroy blocks instantly";
    if(newWorldMode === "HARDCORE") desc = "Same as survival mode, locked at hardest difficulty, and one life only";
    if(newWorldMode === "SPECTATOR") desc = "Look but don't touch, fly through blocks";
    if(newWorldMode === "ADVENTURE") desc = "Exploration and interaction only, blocks cannot be broken";
    document.getElementById('mode-desc').innerText = desc;
}
function cycleWorldType() { const types = ["DEFAULT", "SUPERFLAT", "AMPLIFIED"]; newWorldType = types[(types.indexOf(newWorldType) + 1) % types.length]; document.getElementById('btn-world-type').innerText = "World Type: " + newWorldType.charAt(0) + newWorldType.slice(1).toLowerCase(); }
function toggleWorldDiff() { newWorldDiff = 1 - newWorldDiff; document.getElementById('btn-world-diff').innerText = "Difficulty: " + (newWorldDiff ? "Normal" : "Peaceful"); }
function toggleChest() { newWorldChest = !newWorldChest; document.getElementById('btn-world-chest').innerText = "Bonus Chest: " + (newWorldChest ? "ON" : "OFF"); }
function toggleCheats() { newWorldCheats = !newWorldCheats; document.getElementById('btn-world-cheats').innerText = "Allow Cheats: " + (newWorldCheats ? "ON" : "OFF"); }

function createNewWorld() {
    let name = document.getElementById('new-world-name').value.trim() || "New World";
    let id = 'world_' + Date.now();
    savedWorlds[id] = { name: name, type: newWorldType, mode: newWorldMode, diff: newWorldMode==='HARDCORE'? 2 : newWorldDiff, chest: newWorldChest, cheats: newWorldCheats || newWorldMode==='CREATIVE', inventory: null, pos: null, modifiedBlocks: {}, chests: {}, playerParams: null, gamerules: {keepInventory: false}, achievements: {} };
    localStorage.setItem('orangecraft_worlds', JSON.stringify(savedWorlds));
    selectedWorldListId = id; playSelectedWorld();
}
function deleteSelectedWorld() { if(selectedWorldListId && savedWorlds[selectedWorldListId]) { if(confirm("Are you sure you want to delete this world? This cannot be undone!")) { delete savedWorlds[selectedWorldListId]; localStorage.setItem('orangecraft_worlds', JSON.stringify(savedWorlds)); selectedWorldListId = null; loadWorldList(); } } }
function playSelectedWorld() {
    if(selectedWorldListId && savedWorlds[selectedWorldListId]) {
        activeWorldId = selectedWorldListId; let w = savedWorlds[activeWorldId];
        modifiedBlocks = w.modifiedBlocks || {}; if(w.inventory) { inventory = w.inventory; } 
        if(w.playerParams) { player = {...w.playerParams}; player.dead = false; } else { player = { hp: 20, maxHp: 20, food: 20, maxFood: 20, saturation: 5.0, dead: false, flying: false, exhaustion: 0 }; }
        if(w.gamerules) gamerules = {...w.gamerules};
        if(w.achievements) achievements = {...w.achievements};
        startGame(w);
    }
}
function saveGame() {
    if(activeWorldId && savedWorlds[activeWorldId] && !player.dead) {
        savedWorlds[activeWorldId].inventory = inventory;
        savedWorlds[activeWorldId].pos = { x: cameraGroup.position.x, y: cameraGroup.position.y, z: cameraGroup.position.z, rotX: cam.rotation.x, rotY: targetRotation.y };
        savedWorlds[activeWorldId].modifiedBlocks = modifiedBlocks;
        let savedChests = {}; dynamicBlocks.forEach((v,k)=>{if(v.type==='chest') savedChests[k] = v.slots;});
        savedWorlds[activeWorldId].chests = savedChests;
        savedWorlds[activeWorldId].playerParams = player;
        savedWorlds[activeWorldId].gamerules = gamerules;
        savedWorlds[activeWorldId].achievements = achievements;
        localStorage.setItem('orangecraft_worlds', JSON.stringify(savedWorlds));
    }
}

// --- 0.5 OPTIONS SUB-MENUS & TEXTURE PACK UI ---
let texCache = {}; let imgDataUrls = {}; let isDraggingFov = false; let previousMenu = "MAIN_MENU";

function startFovDrag(e) { isDraggingFov = true; updateFovDrag(e); }
document.addEventListener('mousemove', e => { if(isDraggingFov) updateFovDrag(e); }); document.addEventListener('mouseup', () => { isDraggingFov = false; });

function updateFovDrag(e) {
    let bg = document.getElementById('fov-slider').getBoundingClientRect();
    let pct = Math.max(0, Math.min(1, (e.clientX - bg.left) / bg.width)); optFov = Math.floor(30 + (pct * 80)); 
    document.getElementById('fov-fill').style.width = (pct * 100) + '%'; document.getElementById('fov-handle').style.left = (pct * 100) + '%';
    document.getElementById('fov-label').innerText = "FOV: " + (optFov === 110 ? "Quake Pro" : (optFov === 70 ? "Normal" : optFov));
    if(cam) { cam.fov = optFov; cam.updateProjectionMatrix(); }
}
function updateOptionsUI() {
    let pct = (optFov - 30) / 80; document.getElementById('fov-fill').style.width = (pct * 100) + '%'; document.getElementById('fov-handle').style.left = (pct * 100) + '%';
    document.getElementById('fov-label').innerText = "FOV: " + (optFov === 110 ? "Quake Pro" : (optFov === 70 ? "Normal" : optFov));
}

function toggleOptionClass(el) { if(el.innerText.includes('ON') || el.innerText.includes('Fancy') || el.innerText.includes('Max')) { el.innerText = el.innerText.replace('ON', 'OFF').replace('Fancy', 'Fast').replace('Max', 'Off'); el.classList.remove('btn-active'); } else { el.innerText = el.innerText.replace('OFF', 'ON').replace('Fast', 'Fancy').replace('Off', 'Max'); el.classList.add('btn-active'); } }

function setSubMenu(type) {
    let title = "Settings", content = "";
    if(type === 'video') {
        title = "Video Settings";
        content = `<div class="btn btn-half ${optGraphics?'btn-active':''}" onclick="playSound('click'); cycleOpt('graphics', this)">Graphics: ${optGraphics?"Fancy":"Fast"}</div>
                   <div class="btn btn-half" onclick="playSound('click'); cycleOpt('render', this)">Render Distance: ${optRender}</div>
                   <div class="btn btn-half ${optLighting?'btn-active':''}" onclick="playSound('click'); cycleOpt('lighting', this)">Smooth Lighting: ${optLighting?"Max":"Off"}</div>
                   <div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">View Bobbing: ON</div>`;
    } else if (type === 'controls') {
        title = "Controls";
        content = `<div class="btn btn-half" onclick="playSound('click')">Mouse Sensitivity: 100%</div>
                   <div class="btn btn-half" onclick="playSound('click'); toggleOptionClass(this)">Invert Mouse: OFF</div>
                   <div class="btn btn-half" onclick="playSound('click')">Forward: W</div>
                   <div class="btn btn-half" onclick="playSound('click')">Inventory: E</div>`;
    } else if (type === 'language') {
        title = "Language";
        content = `<div style="color:#aaa; text-align:center; width:100%; margin-bottom:10px;">Language selection simulated.</div>
                   <div class="btn btn-half btn-active" onclick="playSound('click')">English (US)</div>
                   <div class="btn btn-half" onclick="playSound('click')">Pirate Speak</div>`;
    } else if (type === 'skin') {
        title = "Skin Customization";
        content = `<div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Cape: ON</div>
                   <div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Jacket: ON</div>
                   <div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Left Sleeve: ON</div>
                   <div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Right Sleeve: ON</div>`;
    } else if (type === 'chat') {
        title = "Chat Settings";
        content = `<div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Chat: Shown</div>
                   <div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Colors: ON</div>`;
    } else if (type === 'music') {
        title = "Music & Sounds";
        content = `<div class="btn btn-half ${optMusic?'btn-active':''}" onclick="playSound('click'); cycleOpt('music', this)">Music: ${optMusic?"ON":"OFF"}</div>
                   <div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Master Volume: 100%</div>`;
    }
    document.getElementById('sub-menu-title').innerText = title; document.getElementById('sub-menu-grid').innerHTML = content; setMenu('SUB_MENU');
}

function cycleOpt(type, el = null) {
    if(type==='render') { optRender = optRender===2?4: (optRender===4?6:2); if(el) el.innerText = "Render Distance: " + optRender; RENDER_DIST = optRender; }
    if(type==='graphics') { optGraphics = 1-optGraphics; if(el) { el.innerText = "Graphics: " + (optGraphics?"Fancy":"Fast"); if(optGraphics) el.classList.add('btn-active'); else el.classList.remove('btn-active'); } }
    if(type==='lighting') { optLighting = 1-optLighting; if(el) { el.innerText = "Smooth Lighting: " + (optLighting?"Max":"Off"); if(optLighting) el.classList.add('btn-active'); else el.classList.remove('btn-active'); } }
    if(type==='music') { optMusic = !optMusic; if(el) { el.innerText = "Music: " + (optMusic?"ON":"OFF"); if(optMusic) el.classList.add('btn-active'); else el.classList.remove('btn-active'); } if(!optMusic && audioCtx) audioCtx.suspend(); else if(optMusic && audioCtx) audioCtx.resume(); }
}

function openPackMenu(title) { document.getElementById('pack-menu-title').innerText = title; setMenu('TEXTURE_PACKS'); }
function togglePack(el) { let parent = el.parentElement.id; if(parent === 'available-packs') document.getElementById('selected-packs').appendChild(el); else document.getElementById('available-packs').appendChild(el); }
function importPack(e) { let file = e.target.files[0]; if(file) alert("Simulated import successful!\nLoaded: " + file.name + "\n(Note: Some features may say 'Incompatible' in a simulated browser environment)"); }
function applyTexturePacks() {
    let programmerArtActive = document.getElementById('selected-packs').contains(document.getElementById('pack-programmer-art'));
    if(isProgrammerArt !== programmerArtActive) {
        isProgrammerArt = programmerArtActive; saveSettings();
        for(let k in texCache) delete texCache[k]; for(let k in imgDataUrls) delete imgDataUrls[k];
        for(let [k, c] of chunks.entries()) { c.dirty = true; }
        updateUI(); initPackIcons();
    }
    setMenu('OPTIONS');
}

// --- 1. DYNAMIC AUDIO SYSTEM ---
let audioCtx = null, reverbNode = null, isPlayingMusic = false;

function initAudio() { 
    if(!audioCtx) { 
        audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
        let len = audioCtx.sampleRate * 4.0; let buffer = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
        for(let c=0; c<2; c++) { let data = buffer.getChannelData(c); for(let i=0; i<len; i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 5); }
        reverbNode = audioCtx.createConvolver(); reverbNode.buffer = buffer; reverbNode.connect(audioCtx.destination);
    } 
}

function playSound(type, blockName = '') {
    if(!audioCtx) return; let now = audioCtx.currentTime; let g = audioCtx.createGain(); g.connect(audioCtx.destination);
    if(type === 'click') {
        let o = audioCtx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(600, now); o.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.05); o.connect(g); o.start(now); o.stop(now + 0.05);
    } else if (type === 'tool_break') {
        let bufferSize = audioCtx.sampleRate * 0.4; let buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate); let data = buffer.getChannelData(0);
        for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
        let noise = audioCtx.createBufferSource(); noise.buffer = buffer; 
        let filter = audioCtx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 1500;
        g.gain.setValueAtTime(0.8, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.4); noise.connect(filter); filter.connect(g); noise.start(now);
    } else if (type === 'damage' || type === 'fall') {
        let o = audioCtx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(type==='fall'?150:300, now); o.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.2); o.connect(g); o.start(now); o.stop(now + 0.2);
    } else if (type === 'eat') {
        let o = audioCtx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(400, now); o.frequency.linearRampToValueAtTime(300, now + 0.1);
        g.gain.setValueAtTime(0.4, now); g.gain.linearRampToValueAtTime(0.01, now + 0.1); o.connect(g); o.start(now); o.stop(now + 0.1);
    } else if (type === 'step' || type === 'break' || type === 'place' || type === 'dig') {
        let bufferSize = audioCtx.sampleRate * (type === 'step' || type === 'dig' ? 0.1 : 0.25); let buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate); let data = buffer.getChannelData(0);
        for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
        let noise = audioCtx.createBufferSource(); noise.buffer = buffer; noise.playbackRate.value = 0.85 + Math.random() * 0.3;
        let filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; 
        if ['stone', 'cobblestone', 'bedrock', 'furnace', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'redstone_ore', 'lapis_ore', 'emerald_ore'].includes(blockName) || blockName.endsWith('_block')) { filter.frequency.value = 1800; filter.type = 'highpass'; } 
        else if (blockName.endsWith('_log') || blockName.endsWith('_planks') || blockName === 'crafting_table' || blockName === 'torch' || blockName === 'chest') { filter.frequency.value = 600; } 
        else if (blockName.endsWith('_leaves') || blockName.endsWith('_sapling') || blockName === 'dead_bush' || blockName === 'short_grass' || blockName === 'rose' || blockName === 'dandelion') { filter.frequency.value = 2500; filter.type = 'bandpass'; } 
        else if (blockName === 'sand' || blockName === 'gravel') { filter.frequency.value = 800; filter.type = 'lowpass'; noise.playbackRate.value = 0.6; }
        else { filter.frequency.value = 350; } 
        g.gain.setValueAtTime(type==='step' || type==='dig' ? 0.15 : 0.4, now); g.gain.exponentialRampToValueAtTime(0.01, now + (type==='step'||type==='dig'?0.1:0.25)); 
        noise.connect(filter); filter.connect(g); noise.start(now);
    }
}

function playMusic() {
    initAudio(); if(isPlayingMusic || !optMusic) return; isPlayingMusic = true;
    const seq = [ {n: 369.99, d: 800, wait: 800}, {n: 415.30, d: 800, wait: 800}, {n: 440.00, d: 1600, wait: 1600}, {n: 659.25, d: 2000, wait: 2000}, {n: 554.37, d: 1200, wait: 1200}, {n: 440.00, d: 800, wait: 800}, {n: 415.30, d: 800, wait: 800}, {n: 329.63, d: 3000, wait: 4500} ];
    let idx = 0;
    function playNextNote() {
        if(!optMusic) { isPlayingMusic = false; return; }
        if(idx >= seq.length) { idx = 0; setTimeout(playNextNote, 8000); return; }
        let note = seq[idx]; idx++; let now = audioCtx.currentTime;
        [-0.01, 0, 0.01].forEach(detune => {
            let o = audioCtx.createOscillator(); o.type = 'sine'; let g = audioCtx.createGain(); let filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
            o.frequency.value = note.n * (1 + detune); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.12, now + 0.3); g.gain.linearRampToValueAtTime(0, now + (note.d/1000) + 1.5);
            o.connect(filter); filter.connect(g); g.connect(audioCtx.destination); g.connect(reverbNode); o.start(now); o.stop(now + (note.d/1000) + 1.5);
        });
        setTimeout(playNextNote, note.wait);
    }
    playNextNote();
}

// --- 2. TEXTURES & ASSETS ---
const authenticSplashes = ["Version 1.01.8!", "Don't starve!", "Chests added!", "Achievements!"];

function getDmgLevel(type, damage) {
    if(!type || (!type.endsWith('_pickaxe') && !type.endsWith('_axe') && !type.endsWith('_shovel') && !type.endsWith('_sword') && !type.endsWith('_hoe'))) return 0;
    let maxD = type.startsWith('diamond_') ? 1561 : type.startsWith('iron_') ? 250 : (type.startsWith('stone_') ? 131 : (type.startsWith('golden_') ? 32 : 59));
    if (damage > maxD * 0.75) return 2; if (damage > maxD * 0.4) return 1; return 0;
}

function drawPixelMap(ctx, palette, mapStr) {
    for(let i=0; i<256; i++) { let char = mapStr[i]; if(palette[char]) { ctx.fillStyle = palette[char]; ctx.fillRect(i%16, Math.floor(i/16), 1, 1); } }
}

function genTex(type, dmgLevel = 0) {
    let cacheKey = type + '_' + dmgLevel + (isProgrammerArt ? '_old' : '');
    if(texCache[cacheKey]) return texCache[cacheKey];
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;

    const pWood = {'H':'#5c3a21', 'h':'#9c774a', 'S':'#36200b', 's':'#8a5c34', '_':null}; const pStone = {'H':'#4a4a4a', 'h':'#828282', 'S':'#36200b', 's':'#8a5c34', '_':null};
    const pIron = {'H':'#d8d8d8', 'h':'#f5f5f5', 'S':'#36200b', 's':'#8a5c34', '_':null}; const pGold = {'H':'#fceba6', 'h':'#f8d13b', 'S':'#36200b', 's':'#8a5c34', '_':null};
    const pDiamond = {'H':'#bce3f0', 'h':'#33ebcb', 'S':'#36200b', 's':'#8a5c34', '_':null};
    const pFurn = {'C':'#5a5a5a', 'B':'#6a6a6a', 'A':'#828282', 'D':'#4a4a4a', 'X':'#111', 'O':'#ffa500', 'Y':'#ffff00', 'W':'#ffffff'};

    let oreBase = isProgrammerArt ? 'ABACACABABAACABACABAABACABCAABACAABACABAABACABAABACABAABACABAACAACABCAABACABCAABCABAABACABAABACAAABACABAABACABCABACABAABACABACABABCAABACABCAABACCABAABACABAABACAAABACABAABACABCABACABAABACABAACAACABAACABCAABACACABAABACABAABACAAABACABAABACABAABACABCAABACABAAC' : 'ABACACABABAACABACABAABACABCAABACAABACABAABACABAABACABAABACABAACAACABCAABACABCAABCABAABACABAABACAAABACABAABACABCABACABAABACABACABABCAABACABCAABACCABAABACABAABACAAABACABAABACABCABACABAABACABAACAACABAACABCAABACACABAABACABAABACAAABACABAABACABAABACABCAABACABAAC';
    let pOre = isProgrammerArt ? {'A':'#666', 'B':'#555', 'C':'#777'} : {'A':'#7d7d7d', 'B':'#686868', 'C':'#8e8e8e'};

    if (type === 'stone') { drawPixelMap(ctx, pOre, oreBase); } 
    else if (type === 'coal_ore') { drawPixelMap(ctx, {...pOre, 'X':'#000', 'x':'#222'}, oreBase.replace(/CABAABAC/g, 'CxBAxXAC').replace(/ABCAABAC/g, 'ABxXXBAC')); }
    else if (type === 'iron_ore') { drawPixelMap(ctx, {...pOre, 'X':'#eac9b6', 'x':'#d8af93'}, oreBase.replace(/CABAABAC/g, 'CxBAxXAC').replace(/ABCAABAC/g, 'ABxXXBAC')); }
    else if (type === 'gold_ore') { drawPixelMap(ctx, {...pOre, 'X':(isProgrammerArt?'#ff0':'#fceba6'), 'x':(isProgrammerArt?'#fa0':'#f8d13b')}, oreBase.replace(/CABAABAC/g, 'CxBAxXAC').replace(/ABCAABAC/g, 'ABxXXBAC')); }
    else if (type === 'diamond_ore') { drawPixelMap(ctx, {...pOre, 'X':(isProgrammerArt?'#5ff':'#bce3f0'), 'x':(isProgrammerArt?'#0aa':'#33ebcb')}, oreBase.replace(/CABAABAC/g, 'CxBAxXAC').replace(/ABCAABAC/g, 'ABxXXBAC')); }
    else if (type === 'lapis_ore') { drawPixelMap(ctx, {...pOre, 'X':'#345ec3', 'x':'#1c3a82'}, oreBase.replace(/CABAABAC/g, 'CxBAxXAC').replace(/ABCAABAC/g, 'ABxXXBAC')); }
    else if (type === 'emerald_ore') { drawPixelMap(ctx, {...pOre, 'X':'#17dd62', 'x':'#009038'}, oreBase.replace(/CABAABAC/g, 'CxBAxXAC').replace(/ABCAABAC/g, 'ABxXXBAC')); }
    else if (type === 'redstone_ore' || type === 'lit_redstone_ore') { drawPixelMap(ctx, {...pOre, 'X':'#ff0000', 'x':(type==='lit_redstone_ore'?'#ffaa00':'#8f0000')}, oreBase.replace(/CABAABAC/g, 'CxBAxXAC').replace(/ABCAABAC/g, 'ABxXXBAC')); }
    else if (type.endsWith('_block') && type !== 'coal_block') {
        let p = type==='iron_block'?{'A':'#ffffff','B':'#e5e5e5','C':'#d8d8d8','D':'#cccccc'} : (type==='gold_block'?{'A':'#fff5a6','B':'#fceba6','C':'#f8d13b','D':'#c4a329'} : (type==='diamond_block'?{'A':'#e0f7fa','B':'#bce3f0','C':'#33ebcb','D':'#25ab94'} : (type==='emerald_block'?{'A':'#41f384','B':'#17dd62','C':'#00ad43','D':'#007a2f'} : (type==='redstone_block'?{'A':'#ff3333','B':'#e60000','C':'#b30000','D':'#800000'} : {'A':'#537ee8','B':'#345ec3','C':'#1c3a82','D':'#102456'}))));
        if(isProgrammerArt && type==='iron_block') p = {'A':'#fff','B':'#eee','C':'#ddd','D':'#aaa'};
        drawPixelMap(ctx, p, 'BBBBBBBBBBBBBBBB'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BAAAAAAAAAAAAAAC'+'BCCCCCCCCCCCCCCD'+'CDDDDDDDDDDDDDDD'); 
    }
    else if (type.endsWith('_pickaxe')) {
        let mapArr = ("__HHHHHHH_______"+"_HhhhhhhhH______"+"HhH__sS__HhH____"+"HH___sS___HH____"+"_____sS_________"+"_____sS_________"+"____sS__________"+"___sS___________"+"__sS____________"+"_sS_____________"+"sS______________"+"S_______________"+"________________"+"________________"+"________________"+"________________").split('');
        if (dmgLevel >= 1) { mapArr[2*16+11] = '_'; mapArr[3*16+10] = '_'; } if (dmgLevel >= 2) { mapArr[2*16+0] = '_'; mapArr[3*16+0] = '_'; mapArr[3*16+1] = '_'; }
        drawPixelMap(ctx, type.startsWith('wood') ? pWood : (type.startsWith('iron') ? pIron : (type.startsWith('golden') ? pGold : (type.startsWith('diamond') ? pDiamond : pStone))), mapArr.join(''));
    } else if (type.endsWith('_axe')) {
        let mapArr = ("__HHHH__________"+"_HhhhhH_________"+"_HhhhhH_________"+"_HhhH_sS________"+"__HH__sS________"+"______sS________"+"_____sS_________"+"____sS__________"+"___sS___________"+"__sS____________"+"_sS_____________"+"sS______________"+"S_______________"+"________________"+"________________"+"________________").split('');
        if (dmgLevel >= 1) { mapArr[2*16+6] = '_'; mapArr[3*16+5] = '_'; } if (dmgLevel >= 2) { mapArr[1*16+1] = '_'; mapArr[4*16+2] = '_'; }
        drawPixelMap(ctx, type.startsWith('wood') ? pWood : (type.startsWith('iron') ? pIron : (type.startsWith('golden') ? pGold : (type.startsWith('diamond') ? pDiamond : pStone))), mapArr.join(''));
    } else if (type.endsWith('_shovel')) {
        let mapArr = ("_______HHH______"+"______HhhhH_____"+"______HhhhH_____"+"_______HhH______"+"________sS______"+"_______sS_______"+"______sS________"+"_____sS_________"+"____sS__________"+"___sS___________"+"__sS____________"+"_sS_____________"+"sS______________"+"S_______________"+"________________"+"________________").split('');
        if (dmgLevel >= 1) { mapArr[1*16+6] = '_'; mapArr[2*16+6] = '_'; } if (dmgLevel >= 2) { mapArr[1*16+10] = '_'; mapArr[3*16+9] = '_'; }
        drawPixelMap(ctx, type.startsWith('wood') ? pWood : (type.startsWith('iron') ? pIron : (type.startsWith('golden') ? pGold : (type.startsWith('diamond') ? pDiamond : pStone))), mapArr.join(''));
    } else if (type.endsWith('_sword')) {
        let mapArr = ("______________H_"+"_____________HhH"+"____________HhhH"+"___________HhhH_"+"__________HhhH__"+"_________HhhH___"+"________HhhH____"+"_______HhhH_____"+"__HH__HhhH______"+"_HhhH_HhH_______"+"HhHhhHH_H_______"+"HhhHh_sS________"+"_HH__sS_________"+"____sS__________"+"___sS___________"+"___S____________").split('');
        if (dmgLevel >= 1) { mapArr[1*16+14] = '_'; mapArr[2*16+13] = '_'; } if (dmgLevel >= 2) { mapArr[3*16+12] = '_'; mapArr[4*16+11] = '_'; }
        drawPixelMap(ctx, type.startsWith('wood') ? pWood : (type.startsWith('iron') ? pIron : (type.startsWith('golden') ? pGold : (type.startsWith('diamond') ? pDiamond : pStone))), mapArr.join(''));
    } else if (type.endsWith('_hoe')) {
        let mapArr = ("____HHHHH_______"+"___HhhhhhH______"+"___HhH__HhH_____"+"___HH____sS_____"+"_________sS_____"+"________sS______"+"_______sS_______"+"______sS________"+"_____sS_________"+"____sS__________"+"___sS___________"+"__sS____________"+"_sS_____________"+"sS______________"+"S_______________"+"________________").split('');
        if (dmgLevel >= 1) { mapArr[1*16+9] = '_'; mapArr[2*16+9] = '_'; } if (dmgLevel >= 2) { mapArr[1*16+3] = '_'; mapArr[3*16+3] = '_'; }
        drawPixelMap(ctx, type.startsWith('wood') ? pWood : (type.startsWith('iron') ? pIron : (type.startsWith('golden') ? pGold : (type.startsWith('diamond') ? pDiamond : pStone))), mapArr.join(''));
    } else if (type.endsWith('_ingot')) {
        let p = type==='iron_ingot'?{'A':'#000','B':'#555','C':'#fff','D':'#ccc','_':null} : (type==='gold_ingot'?{'A':'#000','B':'#b5840b','C':'#fceba6','D':'#f8d13b','_':null} : null);
        drawPixelMap(ctx, p, '________________'+'_____________B__'+'____________BDB_'+'___________BDCB_'+'__________BDCCB_'+'_________BDCCCB_'+'________BDCCCCB_'+'_______BDCCCCB_B'+'______BDCCCCB_BD'+'_____BDCCCCB_BDD'+'____BDCCCCB_BDDD'+'___BDCCCCB_BDDD_'+'__BDCCCCB_BDDD__'+'_BCCCCCCB_B_____'+'__BBBBBBBB______'+'________________');
    } else if (type === 'diamond' || type === 'emerald') {
        let p = type === 'diamond' ? {'B':'#25ab94','C':'#bce3f0','D':'#33ebcb','_':null} : {'B':'#00ad43','C':'#41f384','D':'#17dd62','_':null};
        drawPixelMap(ctx, p, '________________'+'_______BB_______'+'______BCCB______'+'_____BCCCCB_____'+'____BCCCCCCB____'+'___BCDDDDDDDB___'+'__BDDDDDDDDDDB__'+'_BDDDDDDDDDDDDB_'+'__BDDDDDDDDDDB__'+'___BDDDDDDDDB___'+'____BDDDDDDB____'+'_____BDDDDB_____'+'______BDDB______'+'_______BB_______'+'________________'+'________________');
    } else if (type === 'lapis_lazuli') {
        drawPixelMap(ctx, {'B':'#102456','C':'#345ec3','D':'#1c3a82','_':null}, '________________'+'_______BB_______'+'______BCCB______'+'_____BCDDCB_____'+'____BCDDDDCB____'+'____BCDDDDCB____'+'___BCDDDDDDCB___'+'___BCDDDDDDCB___'+'___BCDDDDDDCB___'+'____BCDDDDCB____'+'____BCDDDDCB____'+'_____BCDDCB_____'+'______BCCB______'+'_______BB_______'+'________________'+'________________');
    } else if (type === 'redstone') {
        drawPixelMap(ctx, {'B':'#800000','C':'#ff3333','D':'#e60000','_':null}, '________________'+'________________'+'________________'+'_______BB_______'+'______BCCB______'+'_____BCDDCB_____'+'____BCDDDDCB____'+'____BCDDDDCB____'+'_____BCDDCB_____'+'______BCCB______'+'_______BB_______'+'________________'+'________________'+'________________'+'________________'+'________________');
    } else if (type === 'apple') {
        drawPixelMap(ctx, {'B':'#000000','C':'#ff0000','D':'#cc0000','S':'#5c3a21','L':'#33cc33','_':null}, '________________'+'________________'+'_______S________'+'______SSL_______'+'______SCCCD_____'+'____CCCCCDD_____'+'___CCCCCCDD_____'+'__CCCCCCDDD_____'+'__CCCCCCDDD_____'+'__CCCCCCDDD_____'+'__CCCCCCDDD_____'+'___CCCCCDDD_____'+'____CCCDDD______'+'________________'+'________________'+'________________');
    } else if (type.startsWith('raw_')) {
        let p = type==='raw_iron'?{'B':'#333','C':'#eac9b6','D':'#d8af93','_':null} : {'B':'#b5840b','C':'#fceba6','D':'#f8d13b','_':null};
        drawPixelMap(ctx, p, '________________'+'________________'+'......BB........'+'.....BCCB.BB....'+'....BCCCBBCCB...'+'...BCCCCBCCCB...'+'...BCCCCCCDCB...'+'....BDCCCCDCB...'+'.....BBDDDCB....'+'.......BBBB.....'+'________________'+'________________'+'________________'+'________________'+'________________'+'________________');
    } else if (type === 'coal') {
        drawPixelMap(ctx, {'A':'#000','B':'#111','C':'#222','D':'#333','_':null}, '________________'+'________________'+'______BCC_______'+'_____CDABC______'+'____CCABABC_____'+'___BCBABABBC____'+'___CCAAABABC____'+'____CBABABBC____'+'_____BCAACC_____'+'______BCCC______'+'________________'+'________________'+'________________'+'________________'+'________________'+'________________');
    } else if (type === 'charcoal') {
        drawPixelMap(ctx, {'A':'#111','B':'#222','C':'#333','D':'#444','_':null}, '________________'+'________________'+'_____BCCB_______'+'____CDBBDC______'+'___CDBDDBBC_____'+'__CDBBDDDABC____'+'__CBBDDDABBC____'+'___CBBABBABC____'+'____CBBABBC_____'+'_____BCCCB______'+'________________'+'________________'+'________________'+'________________'+'________________'+'________________');
    } else if (type === 'coal_block') {
        drawPixelMap(ctx, {'A':'#000','B':'#0a0a0a','C':'#141414','D':'#1e1e1e'}, 'CDDDDDDDDDDDDDDC'+'DCCCCCCCCCCCCCCD'+'DCBBBBBBBBBBBBCD'+'DCBAAAAAAAAAABCD'+'DCBAAAAAAAAAABCD'+'DCBAAAAAAAAAABCD'+'DCBAAAAAAAAAABCD'+'DCBAAAAAAAAAABCD'+'DCBAAAAAAAAAABCD'+'DCBAAAAAAAAAABCD'+'DCBAAAAAAAAAABCD'+'DCBAAAAAAAAAABCD'+'DCBBBBBBBBBBBBCD'+'DCCCCCCCCCCCCCCD'+'CDDDDDDDDDDDDDDC'+'CCCCCCCCCCCCCCCC');
    } else if (type === 'torch') {
        drawPixelMap(ctx, {'O':'#ffa500', 'Y':'#ffff00', 'W':'#ffffff', 'S':'#36200b', 's':'#8a5c34', '_':null}, '_______WY_______'+'______YOOY______'+'______YOOY______'+'_______ss_______'+'_______Ss_______'+'_______Ss_______'+'_______Ss_______'+'_______Ss_______'+'_______Ss_______'+'_______Ss_______'+'_______Ss_______'+'_______Ss_______'+'________________'+'________________'+'________________'+'________________');
    } else if (type === 'short_grass') {
        drawPixelMap(ctx, {'A':isProgrammerArt?'#41B21F':'#74BC39', 'B':isProgrammerArt?'#2A8610':'#5A962A', '_':null}, '________________'+'________________'+'________________'+'________________'+'________________'+'________________'+'_______AA_______'+'______AABA______'+'_____AB_A_A_____'+'____A_A_BA_A____'+'____A_AB_B_A____'+'___BA_A__A_B____'+'___A_AB_AB_A____'+'___B_A_A_A_A____'+'___A_BA_B_BA____'+'___B_A_B_BA_____');
    } else if (type === 'dandelion') {
        drawPixelMap(ctx, {'Y':'#ffff00', 'G':'#33cc33', 'g':'#228822', '_':null}, '________________'+'________________'+'_______YY_______'+'______YYYY______'+'_______YY_______'+'_______G________'+'______GG________'+'_______G_g______'+'______G_g_g_____'+'______Gg__g_____'+'_______G_G______'+'______G_G_g_____'+'_____G_G__g_____'+'____g_G_G_______'+'____g_G_________'+'____g_G_________');
    } else if (type === 'rose') {
        drawPixelMap(ctx, {'R':'#ff0000', 'D':'#aa0000', 'G':'#33cc33', 'g':'#228822', '_':null}, '________________'+'________________'+'_______R________'+'______RDR_______'+'_____RRDRR______'+'______RDR_______'+'_______G________'+'______g_G_______'+'______g__G______'+'_____g_g_G______'+'______g__G_g____'+'________G_g_g___'+'_______G__g_____'+'______G_g_______'+'______G_g_______'+'______G_________');
    } else if (type === 'oak_sapling' || type === 'birch_sapling' || type === 'dead_bush') {
        let isOak = type === 'oak_sapling'; let isDead = type === 'dead_bush';
        let p = isDead ? {'A':'#63432b','B':'#503520','C':null,'_':null} : {'A':'#36200b','B':'#5c3a21','C':(isOak?'#2d7a22':'#63A32E'),'_':null};
        drawPixelMap(ctx, p, '________________'+'________________'+'_______C________'+'______CCC_______'+'_____CCCCC______'+'______CCC_______'+'_____ACCCA______'+'_____BCCCB______'+'______BBB_______'+'_______B________'+'______BAB_______'+'_____B_B_B______'+'_______A________'+'______ABA_______'+'_____B_B_B______'+'_______A________');
    } else if (type === 'furnaceTop') {
        drawPixelMap(ctx, pFurn, 'DDDDDDDDDDDDDDDD'+'DBBBBBBDCBBBBBBD'+'DBBBBBBDCBBBBBBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBAAAAAAAABABBD'+'DBBBBBBBCBBBBBBD'+'DBBBBBBBCBBBBBBD'+'DDDDDDDDDDDDDDDD');
    } else if (type === 'furnaceFront') {
        drawPixelMap(ctx, pFurn, 'DDDDDDDDDDDDDDDD'+'DBBBBBBDCBBBBBBD'+'DBAAAABDCAAAAABD'+'DBAAAAADCAAAAABD'+'DBBBBBBDCBBBBBBD'+'DDDDDDDDDDDDDDDD'+'DCBBBBBBBBBBBBDC'+'DCAAXXXXXXXAAADC'+'DCAAXXXXXXXAABDC'+'DCBBXXXXXXXBBBBD'+'DDDDXXXXXXXDDDDD'+'DBBBXXXXXXXBBBBD'+'DBAAXXXXXXXAAABD'+'DBAAXXXXXXXAAABD'+'DBBBBBBBCBBBBBBD'+'DDDDDDDDDDDDDDDD');
    } else if (type === 'furnaceFrontLit') {
        drawPixelMap(ctx, pFurn, 'DDDDDDDDDDDDDDDD'+'DBBBBBBDCBBBBBBD'+'DBAAAABDCAAAAABD'+'DBAAAAADCAAAAABD'+'DBBBBBBDCBBBBBBD'+'DDDDDDDDDDDDDDDD'+'DCBBBBBBBBBBBBDC'+'DCAAXXXXXXXAAADC'+'DCAAXXOXXOXAABDC'+'DCBBOXOXXOXBBBBD'+'DDDDOOOXOOODDDDD'+'DBBBOYYOOYOBBBBD'+'DBAAOYYWYYOAAABD'+'DBAAOYYYYYOAAABD'+'DBBBBBBBCBBBBBBD'+'DDDDDDDDDDDDDDDD');
    } else if (type === 'chestTop') {
        drawPixelMap(ctx, {'A':'#9c774a', 'B':'#5c3a21', 'C':'#36200b', '_':null}, 'CCCCCCCCCCCCCCCC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBAAAAAAAAAAAABC'+'CBBBBBBBBBBBBBBC'+'CCCCCCCCCCCCCCCC');
    } else if (type === 'chestSide') {
        drawPixelMap(ctx, {'A':'#9c774a', 'B':'#5c3a21', 'C':'#36200b', 'S':'#222222', '_':null}, 'CCCCCCCCCCCCCCCC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CCCCCCCCCCCCCCCC'+'CBBBBBBBBBBBBBBC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CCCCCCCCCCCCCCCC');
    } else if (type === 'chestFront') {
        drawPixelMap(ctx, {'A':'#9c774a', 'B':'#5c3a21', 'C':'#36200b', 'S':'#222', 'L':'#ddd', '_':null}, 'CCCCCCCCCCCCCCCC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CCCCCCCLLCCCCCCC'+'CBBBBBBCSBBBBBBC'+'CAAAAAACSCAAAAAC'+'CAAAAAACSCAAAAAC'+'CAAAAAACCCAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CAAAAAAAAAAAAAAC'+'CCCCCCCCCCCCCCCC');
    } else if (type === 'chest_item') {
        drawPixelMap(ctx, {'A':'#9c774a', 'B':'#5c3a21', 'C':'#36200b', 'S':'#222', 'L':'#ddd', '_':null}, '________________'+'___CCCCCCCCCC___'+'___CAAAAAAAAC___'+'___CAAAAAAAAC___'+'___CAAAAAAAAC___'+'___CCCCLLCCCC___'+'___CBBBCSBBBC___'+'___CAAACSCAAC___'+'___CAAACSCAAC___'+'___CAAACCCAAC___'+'___CAAAAAAAAC___'+'___CAAAAAAAAC___'+'___CAAAAAAAAC___'+'___CCCCCCCCCC___'+'________________'+'________________');
    } else if (type === 'stick') {
        ctx.fillStyle = '#36200b'; for(let i=2; i<14; i++) { ctx.fillRect(15-i, i, 2, 2); } ctx.fillStyle = '#8a5c34'; for(let i=2; i<14; i++) { ctx.fillRect(15-i, i, 1, 1); } 
    } else if (type === 'cobblestone' || type === 'furnaceSide') { 
        drawPixelMap(ctx, isProgrammerArt ? {'D':'#111', 'C':'#444', 'B':'#666', 'A':'#999'} : {'D':'#4a4a4a', 'C':'#5a5a5a', 'B':'#6a6a6a', 'A':'#828282'}, 'DDDDDDDDDDDDDDDD'+'DBBBBBBDCBBBBBBD'+'DBAAAABDCAAAAABD'+'DBAAABBDCAABABBD'+'DBBBBBBDCBBBBBBD'+'DDDDDDDDDDDDDDDD'+'DCBBBBDCBBBBBBBD'+'DCAAABDCAAAAAABD'+'DCAABBDCAAAAABBD'+'DCBBBBDCBBBBBBBD'+'DDDDDDDDDDDDDDDD'+'DBBBBBBBCBBBBBBD'+'DBAAAAABCBAAAABD'+'DBAAAAABCAAAAABD'+'DBBBBBBBCBBBBBBD'+'DDDDDDDDDDDDDDDD'); 
    } else if (type === 'sand') {
        ctx.fillStyle = '#dbd3a0'; ctx.fillRect(0,0,16,16); for(let i=0; i<100; i++) { ctx.fillStyle=Math.random()>0.5? '#c2b77a':'#e8e1ba'; ctx.fillRect(Math.random()*16, Math.random()*16, 1, 1); }
    } else if (type === 'gravel') {
        ctx.fillStyle = '#85807e'; ctx.fillRect(0,0,16,16); for(let i=0; i<150; i++) { ctx.fillStyle=Math.random()>0.5? '#696462':(Math.random()>0.5?'#9c9795':'#524d4a'); ctx.fillRect(Math.random()*16, Math.random()*16, 1, 1); }
    } else if (type === 'cactusSide') {
        ctx.fillStyle = '#0f5e13'; ctx.fillRect(0,0,16,16); ctx.fillStyle = '#178a1d'; for(let x=1;x<16;x+=3) ctx.fillRect(x,0,2,16); ctx.fillStyle = '#000000'; for(let i=0;i<15;i++){ ctx.fillRect(Math.floor(Math.random()*16), Math.floor(Math.random()*16), 1, 1); }
    } else if (type === 'cactusTop') {
        ctx.fillStyle = '#178a1d'; ctx.fillRect(0,0,16,16); ctx.fillStyle = '#e8f0e8'; ctx.fillRect(4,4,8,8);
    } else if (type === 'dirt' || type === 'grassSide') {
        drawPixelMap(ctx, isProgrammerArt ? {'A':'#724e33', 'B':'#62432a', 'C':'#895b3a', 'D':'#503520'} : {'A':'#866043', 'B':'#755138', 'C':'#9b7150', 'D':'#63432b'}, 'ABACAAABDBAACAAB'+'BAADACBAAABACBDA'+'CBBAAABACDAAAACA'+'AACDBAACBAABDAAB'+'DBACAACDBAABACDB'+'AABDCAAAACDBBAAA'+'ACBAABDCBAAAACBA'+'BAAACBAAABDCBAAB'+'ABDCBAAACBAAABDC'+'CBAAABDCBAAACBAA'+'AAABACBAAABDCAAB'+'ACDBAAACDBAAABAC'+'BAAACDBAAACDBAAA'+'ABDCAAAACDBAAACA'+'CBAAABDCAAAACDBA'+'AABDCAAAACDBAAAB');
        if(type === 'grassSide') { ctx.fillStyle = isProgrammerArt ? '#41B21F' : '#74BC39'; ctx.fillRect(0,0,16,3); let fringes = [2,3,2,4,2,3,1,2,3,2,4,3,2,1,2,3]; for(let x=0; x<16; x++) { ctx.fillStyle = isProgrammerArt ? '#41B21F' : '#74BC39'; ctx.fillRect(x, 3, 1, fringes[x]); ctx.fillStyle = isProgrammerArt ? '#2A8610' : '#5A962A'; ctx.fillRect(x, 3+fringes[x], 1, 1); } }
    } else if (type === 'bedrock') { drawPixelMap(ctx, {'A':'#333333', 'B':'#111111', 'C':'#555555', 'D':'#222222'}, 'AABDAACDDBAAACDB'+'CDBABDBACDABBDCA'+'AACDDBCAACDDBDBA'+'BDDCAABDAACDDBAA'+'AABDAACDDBAAACDB'+'CDBABDBACDABBDCA'+'AACDDBCAACDDBDBA'+'BDDCAABDAACDDBAA'+'AABDAACDDBAAACDB'+'CDBABDBACDABBDCA'+'AACDDBCAACDDBDBA'+'BDDCAABDAACDDBAA'+'AABDAACDDBAAACDB'+'CDBABDBACDABBDCA'+'AACDDBCAACDDBDBA'+'BDDCAABDAACDDBAA'); }
    else if (type === 'ctTop') { drawPixelMap(ctx, {'A':'#b07f4f', 'B':'#593a20', 'C':'#8a603c'}, 'AAAAAAAAAAAAAAAA'+'AAAAAAAAAAAAAAAA'+'AAAAAAAAAAAAAAAA'+'AAABBBBBBBBBBAAA'+'AAABCCCCCCCCBAAA'+'AAABCBBBBBBCBAAA'+'AAABCBCCCCCBBAAA'+'AAABCBCCCCCBBAAA'+'AAABCBCCCCCBBAAA'+'AAABCBBBBBBCBAAA'+'AAABCCCCCCCCBAAA'+'AAABBBBBBBBBBAAA'+'AAAAAAAAAAAAAAAA'+'AAAAAAAAAAAAAAAA'+'AAAAAAAAAAAAAAAA'+'AAAAAAAAAAAAAAAA'); }
    else if (type === 'ctSide') { drawPixelMap(ctx, {'A':'#a88154', 'B':'#593c20', 'C':'#7a7a7a', 'D':'#e0e0e0', 'E':'#593a20'}, 'BBBBBBBBBBBBBBBB'+'BBBBBBBBBBBBBBBB'+'BBBBBBBBBBBBBBBB'+'BBBBBBBBBBBBBBBB'+'AAAAAAAAAAAAAAAA'+'AAAAAAAAAACCACAA'+'AAAAAAAAAACCCCAA'+'AAAAAAAAAAADCAAA'+'AAAAAAAAAAAAEAAA'+'AAAAAAAAAAAAEAAA'+'AAAAAAAAAAAAEAAA'+'AAAAAAAAAAAAEAAA'+'AAAAAAAAAAAAAAAA'+'AAAAAAAAAAAAAAAA'+'AAAAAAAAAAAAAAAA'+'AAAAAAAAAAAAAAAA'); }
    else if (type === 'grass') { ctx.fillStyle = isProgrammerArt ? '#41B21F' : '#74BC39'; ctx.fillRect(0,0,16,16); for(let i=0; i<120; i++) { ctx.fillStyle=Math.random()>0.5? (isProgrammerArt ? '#2A8610' : '#63A32E'): (isProgrammerArt ? '#66FF33' : '#85D444'); ctx.fillRect(Math.random()*16, Math.random()*16, 1, 1); } }
    else if (type === 'farmlandTop') { ctx.fillStyle = '#6e4c33'; ctx.fillRect(0,0,16,16); ctx.fillStyle = '#5c3a21'; for(let y=2;y<16;y+=4) ctx.fillRect(0,y,16,2); }
    else if (type === 'oak_planks' || type === 'birch_planks') { 
        let baseC = type === 'oak_planks' ? '#b48f5e' : '#d4c78e'; let d1 = type === 'oak_planks' ? '#9c774a' : '#b8ab74'; let d2 = type === 'oak_planks' ? '#7a5a35' : '#998e5e'; let d3 = type === 'oak_planks' ? '#6b4b2b' : '#857b50';
        ctx.fillStyle = baseC; ctx.fillRect(0,0,16,16); ctx.fillStyle = d1; for(let y=0; y<16; y+=4) { ctx.fillRect(0, y+3, 16, 1); ctx.fillStyle = d2; ctx.fillRect(0, y+4, 16, 1); ctx.fillStyle = d1; ctx.fillRect(Math.random()*16, y+1, 4, 1); ctx.fillRect(Math.random()*16, y+2, 3, 1); } ctx.fillStyle = d3; ctx.fillRect(3,0,1,3); ctx.fillRect(11,4,1,3); ctx.fillRect(5,8,1,3); ctx.fillRect(13,12,1,3); 
    }
    else if (type === 'oak_log' || type === 'birch_log') { 
        let baseC = type === 'oak_log' ? '#3d2b1c' : '#dedede'; let d1 = type === 'oak_log' ? '#5c442c' : '#333333';
        ctx.fillStyle = baseC; ctx.fillRect(0,0,16,16); ctx.fillStyle = d1; for(let x=0; x<16; x+=2) { ctx.fillRect(x, 0, 1, 16); if(Math.random()>0.3) ctx.fillRect(x+1, Math.random()*16, 1, 3); } 
    }
    else if (type === 'oak_top' || type === 'birch_top') { 
        let baseC = type === 'oak_top' ? '#412e1c' : '#d4c78e'; 
        ctx.fillStyle = baseC; ctx.fillRect(0,0,16,16); ctx.fillStyle = '#b7935f'; ctx.fillRect(1,1,14,14); ctx.fillStyle = '#a17e4d'; ctx.fillRect(2,2,12,12); ctx.fillStyle = '#b7935f'; ctx.fillRect(3,3,10,10); ctx.fillStyle = '#a17e4d'; ctx.fillRect(5,5,6,6); ctx.fillStyle = '#b7935f'; ctx.fillRect(6,6,4,4); ctx.fillStyle = '#a17e4d'; ctx.fillRect(7,7,2,2); 
    }
    else if (type === 'oak_leaves' || type === 'birch_leaves') { 
        ctx.clearRect(0,0,16,16); let isSolidLeaves = isProgrammerArt; let c1 = type === 'oak_leaves' ? '#1e5416' : '#49753e'; let c2 = type === 'oak_leaves' ? '#2d7a22' : '#63A32E';
        if(isSolidLeaves) { ctx.fillStyle=c1; ctx.fillRect(0,0,16,16); } for(let x=0; x<16; x++) { for(let y=0; y<16; y++) { if((x+y)%2===0 || Math.random()>0.7) { ctx.fillStyle = Math.random()>0.5 ? c2 : c1; ctx.fillRect(x,y,1,1); } } } 
    } else if (type.startsWith('ui_heart')) {
        drawPixelMap(ctx, {'W':'#ffffff','B':'#000000','R':'#ff0000','D':'#aa0000','_':null}, '________________'+'__BBBB___BBBB___'+'_BWWWWBBBWwwDB__'+'BWWWWWWBWWwwDDB_'+'BWWRRRRBWWwwDDB_'+'BWWRRRRBWwwwDDB_'+'BWWRRRRBwwwwDDB_'+'BWRRRRRBwwwwDDB_'+'_BRRRRRBwwwwDB__'+'__BRRRRBwwwDB___'+'___BRRRBwwDB____'+'____BRRBwDB_____'+'_____BRBDB______'+'______BBB_______'+'________________'+'________________');
        if(type==='ui_heart_half') { ctx.clearRect(8,0,8,16); ctx.fillStyle='#000'; ctx.fillRect(8,1,1,1); ctx.fillRect(8,2,1,1); ctx.fillRect(8,12,1,1); ctx.fillRect(7,13,1,1); }
        if(type==='ui_heart_empty') { ctx.clearRect(0,0,16,16); drawPixelMap(ctx, {'B':'#000000','_':null}, '________________'+'__BBBB___BBBB___'+'_B____B_B____B__'+'B______B______B_'+'B______B______B_'+'B_____________B_'+'B_____________B_'+'B_____________B_'+'_B___________B__'+'__B_________B___'+'___B_______B____'+'____B_____B_____'+'_____B___B______'+'______B_B_______'+'_______B________'+'________________'); }
    } else if (type.startsWith('ui_food')) {
        drawPixelMap(ctx, {'B':'#000000','C':'#ffbb00','D':'#cc6600','_':null}, '________________'+'________________'+'_________BBB____'+'________BCCCB___'+'_______BCCDCCB__'+'_______BCDCCCB__'+'______BCCDCCCB__'+'_____BCCDCCCB___'+'_____BCCDCCB____'+'____BCCDCCCB____'+'__BBBCCDCCB_____'+'_B___BCDDB______'+'B_____BBBB______'+'B_B__B__________'+'_B_BB___________'+'________________');
        if(type==='ui_food_half') { ctx.clearRect(8,0,8,16); ctx.fillStyle='#000'; ctx.fillRect(7,3,1,1); ctx.fillRect(7,4,1,1); ctx.fillRect(7,10,1,1); }
        if(type==='ui_food_empty') { ctx.clearRect(0,0,16,16); drawPixelMap(ctx, {'B':'#000000','_':null}, '________________'+'________________'+'_________BBB____'+'________B___B___'+'_______B_____B__'+'_______B_____B__'+'______B______B__'+'_____B_______B__'+'_____B______B___'+'____B______B____'+'__BBB______B____'+'_B___B____B_____'+'B_____BBBB______'+'B_B__B__________'+'_B_BB___________'+'________________'); }
    }

    imgDataUrls[cacheKey] = canvas.toDataURL(); const t = new THREE.CanvasTexture(canvas); t.magFilter = THREE.NearestFilter; 
    if((type.endsWith('_leaves') && !isProgrammerArt) || type === 'stick' || type === 'charcoal' || type === 'coal' || type.endsWith('_ingot') || type.startsWith('raw_') || type === 'diamond' || type === 'emerald' || type === 'lapis_lazuli' || type === 'redstone' || type === 'torch' || type === 'apple' || type === 'chest_item' || type.endsWith('_sapling') || type === 'dead_bush' || type === 'short_grass' || type === 'dandelion' || type === 'rose' || type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe') || type.startsWith('ui_')) t.transparent = true; 
    texCache[cacheKey] = t; return t;
}

const crackMats = Array(10).fill(null).map((_, i) => {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.fillStyle = "rgba(0,0,0,0.85)";
    let cx = 7.5, cy = 7.5; let stageProgress = i / 9.0;
    if(i > 0) { ctx.fillRect(7, 7, 2, 2); for(let a=0; a<Math.PI*2; a+=Math.PI/4) { let len = Math.floor(stageProgress * 8); for(let dist=1; dist<=len; dist++) { if(Math.random() < 0.8) ctx.fillRect(Math.floor(cx + Math.cos(a)*dist), Math.floor(cy + Math.sin(a)*dist), 1, 1); } } }
    const t = new THREE.CanvasTexture(canvas); t.magFilter = THREE.NearestFilter; return new THREE.MeshBasicMaterial({ map: t, transparent: true, polygonOffset: true, polygonOffsetFactor: -1, depthWrite: false });
});

genTex('dirt'); document.querySelectorAll('.dirt-bg').forEach(el => el.style.backgroundImage = `url(${imgDataUrls['dirt_0'+(isProgrammerArt?'_old':'')]})`);
function initPackIcons() {
    genTex('stone'); genTex('grass');
    document.getElementById('icon-prog-art').style.backgroundImage = `url(${imgDataUrls['stone_0_old'] || imgDataUrls['stone_0']})`;
    document.getElementById('icon-default').style.backgroundImage = `url(${imgDataUrls['grass_0']})`;
    // Pre-gen HUD
    genTex('ui_heart_full'); genTex('ui_heart_half'); genTex('ui_heart_empty');
    genTex('ui_food_full'); genTex('ui_food_half'); genTex('ui_food_empty');
}
initPackIcons();

const creativeCategories = {
    'blocks': ['stone', 'cobblestone', 'dirt', 'grass', 'sand', 'gravel', 'oak_log', 'birch_log', 'oak_planks', 'birch_planks', 'oak_leaves', 'birch_leaves', 'cactus', 'bedrock', 'coal_ore', 'iron_ore', 'gold_ore', 'lapis_ore', 'redstone_ore', 'diamond_ore', 'emerald_ore', 'coal_block', 'iron_block', 'gold_block', 'lapis_block', 'redstone_block', 'diamond_block', 'emerald_block', 'furnace', 'chest', 'crafting_table', 'torch', 'oak_sapling', 'birch_sapling', 'dead_bush', 'short_grass', 'dandelion', 'rose'],
    'items': ['coal', 'charcoal', 'raw_iron', 'iron_ingot', 'raw_gold', 'gold_ingot', 'lapis_lazuli', 'redstone', 'diamond', 'emerald', 'stick', 'apple', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe', 'diamond_pickaxe', 'wooden_axe', 'stone_axe', 'iron_axe', 'golden_axe', 'diamond_axe', 'wooden_shovel', 'stone_shovel', 'iron_shovel', 'golden_shovel', 'diamond_shovel', 'wooden_sword', 'stone_sword', 'iron_sword', 'golden_sword', 'diamond_sword', 'wooden_hoe', 'stone_hoe', 'iron_hoe', 'golden_hoe', 'diamond_hoe']
};
let activeCreativeTab = 'blocks';

// --- 3. UI, CHAT, INVENTORY, & LOGIC ---
let inventory = Array(36).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let crafting2x2 = Array(4).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let crafting3x3 = Array(9).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let activeSlot = 0, dragItem = null, gameState = "MAIN_MENU", drops = [];
let miningTarget = null, miningProgress = 0, miningSoundTimer = 0;

let chatLog = [];
function addChatMessage(msg, color="white") {
    chatLog.push(`<span style="color:${color}">${msg}</span>`);
    if(chatLog.length > 20) chatLog.shift();
    let logEl = document.getElementById('chat-log');
    logEl.innerHTML = chatLog.join('<br>');
    logEl.scrollTop = logEl.scrollHeight;
}

function processCommand(cmd) {
    addChatMessage(cmd, "#aaa");
    if(savedWorlds[activeWorldId] && !savedWorlds[activeWorldId].cheats) { addChatMessage("Cheats are disabled on this level.", "red"); return; }
    
    let args = cmd.toLowerCase().split(' ');
    if(args[0] === '/gamemode') {
        let m = args[1]; if(m==='0'||m==='s') m='survival'; if(m==='1'||m==='c') m='creative'; if(m==='2'||m==='a') m='adventure'; if(m==='3'||m==='sp') m='spectator';
        if(['survival','creative','spectator','adventure'].includes(m)) {
            savedWorlds[activeWorldId].mode = m.toUpperCase();
            addChatMessage(`Set own game mode to ${m.charAt(0).toUpperCase() + m.slice(1)}`, "#aaa");
        } else { addChatMessage(`Unknown game mode: ${args[1]}`, "red"); }
    } else if (args[0] === '/gamerule') {
        if(args[1] === 'keepinventory') {
            if(args[2] === 'true') { gamerules.keepInventory = true; addChatMessage("Game rule keepInventory has been updated to true", "#aaa"); }
            else if (args[2] === 'false') { gamerules.keepInventory = false; addChatMessage("Game rule keepInventory has been updated to false", "#aaa"); }
        }
    } else if (args[0] === '/kill') {
        player.hp = 0; addChatMessage("Player fell out of the world", "#aaa");
    } else if (args[0] === '/help') {
        addChatMessage(`Commands: /gamemode <mode>, /gamerule keepInventory <true|false>, /kill`, "yellow");
    } else {
        addChatMessage(`Unknown command: ${args[0]}. Please check that the command exists and that you have permission to use it.`, "red");
    }
}

const commandList = ['/gamemode survival', '/gamemode creative', '/gamemode spectator', '/gamemode adventure', '/gamerule keepInventory true', '/gamerule keepInventory false', '/kill', '/help'];
document.getElementById('chat-input').addEventListener('input', (e) => {
    let val = e.target.value; let suggBox = document.getElementById('chat-suggestions');
    if(val.startsWith('/')) {
        let matches = commandList.filter(c => c.startsWith(val));
        if(matches.length > 0) { suggBox.style.display = 'flex'; suggBox.innerHTML = matches.map(m => `<div class="chat-sugg" onclick="document.getElementById('chat-input').value='${m}'; document.getElementById('chat-suggestions').style.display='none'; document.getElementById('chat-input').focus();">${m}</div>`).join(''); } else { suggBox.style.display = 'none'; }
    } else { suggBox.style.display = 'none'; }
});

function checkAchievement(id) {
    let isCreative = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'CREATIVE';
    let isCheats = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].cheats;
    if (isCreative || isCheats || achievements[id]) return;
    achievements[id] = true;
    let names = {'wood': 'Getting Wood', 'stone': 'Time to Mine!', 'iron': 'Acquire Hardware', 'diamond': 'DIAMONDS!'};
    addChatMessage(`Player has made the advancement [${names[id]}]`, "#55ff55");
}

function formatName(str) { return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); }
document.addEventListener('mousemove', (e) => {
    let tt = document.getElementById('tooltip');
    if (gameState === "INV" || gameState === "CRAFTING" || gameState === "FURNACE" || gameState === "CREATIVE" || gameState === "CHEST") {
        let hovered = e.target.closest('.inv-slot');
        if (hovered && hovered.dataset.itemType) { tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px'; tt.innerText = formatName(hovered.dataset.itemType); } 
        else { tt.style.display = 'none'; }
    } else { tt.style.display = 'none'; }
    if(dragItem) { document.getElementById('drag-icon').style.left = e.clientX-18+'px'; document.getElementById('drag-icon').style.top = e.clientY-18+'px'; }
    if(gameState === "PLAYING" && !isDraggingFov && !player.dead) { targetRotation.y -= e.movementX*0.002; targetRotation.x -= e.movementY*0.002; targetRotation.x = Math.max(-1.5, Math.min(1.5, targetRotation.x)); }
});

function getIconHTML(type, damage=0) {
    if(!type) return ''; let dmgLevel = getDmgLevel(type, damage);
    
    if(type === 'crafting_table') { genTex('ctTop'); genTex('ctSide'); } else if(type.endsWith('_log')) { genTex(type.replace('log','top')); genTex(type); } else if(type === 'grass') { genTex('grass'); genTex('grassSide'); } else if (type === 'farmland') { genTex('farmlandTop'); genTex('dirt'); } else if (type === 'furnace') { genTex('furnaceTop'); genTex('furnaceSide'); genTex('furnaceFront'); } else if (type === 'chest') { genTex('chest_item'); } else genTex(type, dmgLevel);
    
    let html = ''; let suf = isProgrammerArt ? '_old' : '';
    let is2D = (type === 'stick' || type === 'charcoal' || type === 'coal' || type.endsWith('_ingot') || type.startsWith('raw_') || type === 'diamond' || type === 'emerald' || type === 'lapis_lazuli' || type === 'redstone' || type === 'torch' || type === 'apple' || type.endsWith('_sapling') || type === 'dead_bush' || type === 'short_grass' || type === 'dandelion' || type === 'rose' || type === 'chest' || type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe'));
    if(is2D) {
        let cacheKey = (type==='chest'?'chest_item':type) + '_' + dmgLevel + suf; html = `<div class="item-2d" style="background-image:url(${imgDataUrls[cacheKey]})"></div>`;
    } else {
        let top = type.endsWith('_log') ? type.replace('log','top') : (type === 'crafting_table' ? 'ctTop' : (type === 'grass' ? 'grass' : (type === 'farmland' ? 'farmlandTop' : (type === 'furnace' ? 'furnaceTop' : type))));
        let side = type === 'crafting_table' ? 'ctSide' : (type === 'grass' ? 'grassSide' : (type === 'farmland' ? 'dirt' : (type === 'furnace' ? 'furnaceFront' : type)));
        html = `<div class="item-3d"><div class="face top" style="background-image:url(${imgDataUrls[top+'_0'+suf]})"></div><div class="face right" style="background-image:url(${imgDataUrls[side+'_0'+suf]})"></div><div class="face front" style="background-image:url(${imgDataUrls[side+'_0'+suf]})"></div></div>`;
    }
    if(type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe')) {
        let maxD = type.startsWith('diamond_') ? 1561 : type.startsWith('iron_') ? 250 : (type.startsWith('stone_') ? 131 : (type.startsWith('golden_') ? 32 : 59));
        if (damage > 0) { let pct = (maxD - damage) / maxD; let color = pct > 0.5 ? '#0f0' : (pct > 0.2 ? '#fa0' : '#f00'); html += `<div style="position:absolute;bottom:2px;left:4px;width:28px;height:4px;background:#000;border:1px solid #222;box-sizing:border-box;"><div style="width:${pct*100}%;height:100%;background:${color};"></div></div>`; }
    }
    return html;
}

function addToInventory(type, amount, damage=0) {
    let maxStack = (type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe')) ? 1 : 64;
    for(let i=0; i<36; i++) { if(inventory[i].type === type && inventory[i].count < maxStack) { let add = Math.min(maxStack - inventory[i].count, amount); inventory[i].count += add; amount -= add; if(amount <= 0) break; } }
    if(amount > 0) { for(let i=0; i<36; i++) { if(!inventory[i].type) { inventory[i].type = type; inventory[i].count = amount; inventory[i].damage = damage; amount = 0; break; } } }
    
    if(type.endsWith('_log')) checkAchievement('wood');
    if(type === 'cobblestone') checkAchievement('stone');
    if(type === 'iron_ingot') checkAchievement('iron');
    if(type === 'diamond') checkAchievement('diamond');

    updateUI(); return amount === 0;
}

function updateSlotDOM(el, item) { if(item.type) { el.innerHTML = getIconHTML(item.type, item.damage) + (item.count > 1 ? `<span class="item-count">${item.count}</span>` : ''); el.dataset.itemType = item.type; } else { el.innerHTML = ''; delete el.dataset.itemType; } }
function createSlot(item, onDown) { let d = document.createElement('div'); d.className = 'inv-slot'; updateSlotDOM(d, item); d.onmousedown = onDown; return d; }

function setCreativeTab(tab) {
    activeCreativeTab = tab; document.querySelectorAll('.c-tab').forEach(el => el.classList.remove('active')); document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('c-search-input').style.display = tab === 'search' ? 'block' : 'none'; updateUI();
}

function updateUI(){
  const hDisp = document.getElementById('hotbar-display'), hInv = document.getElementById('h-inv-grid'), mInv = document.getElementById('m-inv-grid');
  const cGrid2 = document.getElementById('p-craft-grid'), ctMInv = document.getElementById('ct-m-inv-grid'), ctHInv = document.getElementById('ct-h-inv-grid'), cGrid3 = document.getElementById('ct-craft-grid');
  const fMInv = document.getElementById('f-m-inv-grid'), fHInv = document.getElementById('f-h-inv-grid'), chMInv = document.getElementById('ch-m-inv-grid'), chHInv = document.getElementById('ch-h-inv-grid');
  const crHInv = document.getElementById('c-h-inv-grid'), crItemGrid = document.getElementById('c-item-grid');
  
  hDisp.innerHTML = ''; hInv.innerHTML = ''; mInv.innerHTML = ''; ctMInv.innerHTML = ''; ctHInv.innerHTML = ''; fMInv.innerHTML = ''; fHInv.innerHTML = ''; crHInv.innerHTML = ''; chMInv.innerHTML = ''; chHInv.innerHTML = '';
  
  inventory.forEach((item, i) => {
    if(item.count <= 0) { item.type = null; item.count = 0; item.damage = 0; }
    let slot = createSlot(item, (e) => handleSlotAction(inventory, i, e)); let slot2 = createSlot(item, (e) => handleSlotAction(inventory, i, e)); let slot3 = createSlot(item, (e) => handleSlotAction(inventory, i, e)); let slot4 = createSlot(item, (e) => handleSlotAction(inventory, i, e)); let slot5 = createSlot(item, (e) => handleSlotAction(inventory, i, e));
    
    if(i < 9) { 
        hInv.appendChild(slot); ctHInv.appendChild(slot2); fHInv.appendChild(slot3); crHInv.appendChild(slot4); chHInv.appendChild(slot5);
        let hs = document.createElement('div'); hs.className = 'slot' + (i === activeSlot ? ' active' : ''); if(item.type) { hs.innerHTML = getIconHTML(item.type, item.damage) + (item.count > 1 ? `<span class="item-count">${item.count}</span>` : ''); } hDisp.appendChild(hs);
    } else { mInv.appendChild(slot); ctMInv.appendChild(slot2); fMInv.appendChild(slot3); chMInv.appendChild(slot5); }
  });
  
  Array.from(cGrid2.children).forEach((slot, i) => { if(crafting2x2[i].count <= 0) { crafting2x2[i].type = null; crafting2x2[i].count = 0; } updateSlotDOM(slot, crafting2x2[i]); slot.onmousedown = (e) => handleSlotAction(crafting2x2, i, e); });
  Array.from(cGrid3.children).forEach((slot, i) => { if(crafting3x3[i].count <= 0) { crafting3x3[i].type = null; crafting3x3[i].count = 0; } updateSlotDOM(slot, crafting3x3[i]); slot.onmousedown = (e) => handleSlotAction(crafting3x3, i, e); });
  checkRecipes();

  if(gameState === "CREATIVE") {
      crItemGrid.innerHTML = '';
      let itemsToShow = [];
      if(activeCreativeTab === 'search') { let q = document.getElementById('c-search-input').value.toLowerCase(); itemsToShow = [...creativeCategories['blocks'], ...creativeCategories['items']].filter(i => i.replace(/_/g, ' ').includes(q)); }
      else { itemsToShow = creativeCategories[activeCreativeTab]; }

      itemsToShow.forEach(type => {
          let fakeItem = {type: type, count: 1, damage: 0};
          let slot = createSlot(fakeItem, (e) => {
              playSound('click'); let maxStack = (type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe')) ? 1 : 64;
              if(!dragItem) { dragItem = {item: {type: type, count: e.ctrlKey?maxStack:1, damage: 0}, source: 'CREATIVE', idx: -1}; document.getElementById('drag-icon').style.display = 'block'; document.getElementById('drag-icon').innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); }
          });
          crItemGrid.appendChild(slot);
      });
  }

  if(gameState === "CHEST" && activeChestPos) {
      let ch = dynamicBlocks.get(activeChestPos);
      if(ch && ch.type === 'chest') {
          let cGrid = document.getElementById('ch-inv-grid'); cGrid.innerHTML = '';
          ch.slots.forEach((item, i) => { if(item.count <= 0) { item.type = null; item.count = 0; } cGrid.appendChild(createSlot(item, (e) => handleSlotAction(ch.slots, i, e))); });
      }
  }

  if(gameState === "FURNACE" && activeFurnacePos) {
      let fd = dynamicBlocks.get(activeFurnacePos);
      if(fd && fd.type === 'furnace') {
          if(fd.slots[0].count <= 0) fd.slots[0].type = null; if(fd.slots[1].count <= 0) fd.slots[1].type = null; if(fd.slots[2].count <= 0) fd.slots[2].type = null;
          let fIn = document.getElementById('f-input'); updateSlotDOM(fIn, fd.slots[0]); fIn.onmousedown = (e) => handleSlotAction(fd.slots, 0, e);
          let fFuel = document.getElementById('f-fuel'); updateSlotDOM(fFuel, fd.slots[1]); fFuel.onmousedown = (e) => handleSlotAction(fd.slots, 1, e, true); 
          let fOut = document.getElementById('f-output'); updateSlotDOM(fOut, fd.slots[2]); fOut.onmousedown = (e) => { 
              if(fd.slots[2].type && !dragItem) { playSound('click'); dragItem = {item: {...fd.slots[2]}, source: null, idx: -1}; fd.slots[2].type = null; fd.slots[2].count = 0; document.getElementById('drag-icon').style.display = 'block'; document.getElementById('drag-icon').innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); updateUI(); }
          };
          document.getElementById('f-fire-bar').style.height = fd.maxBurnTime > 0 ? `${(fd.burnTime / fd.maxBurnTime) * 100}%` : '0%';
          document.getElementById('f-progress-bar').style.width = fd.maxCookTime > 0 ? `${(fd.cookTime / fd.maxCookTime) * 100}%` : '0%';
      }
  }

  drawHUD();
}

function drawHUD() {
    const c = document.getElementById('hud-canvas'); const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    let isCreative = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'CREATIVE';
    let isSpectator = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'SPECTATOR';
    if(isCreative || isSpectator || gameState !== "PLAYING") return;

    let hFull = imgDataUrls['ui_heart_full_0'], hHalf = imgDataUrls['ui_heart_half_0'], hEmpty = imgDataUrls['ui_heart_empty_0'];
    let fFull = imgDataUrls['ui_food_full_0'], fHalf = imgDataUrls['ui_food_half_0'], fEmpty = imgDataUrls['ui_food_empty_0'];
    
    let drawIcon = (src, x, y) => { let img = new Image(); img.src = src; if(img.complete) ctx.drawImage(img, x, y, 16, 16); else img.onload = () => ctx.drawImage(img, x, y, 16, 16); };

    for(let i=0; i<10; i++) {
        let hX = i * 16, fX = 344 - (i * 16); let y = 20;
        drawIcon(hEmpty, hX, y);
        if (player.hp > i * 2 + 1) drawIcon(hFull, hX, y); else if (player.hp === i * 2 + 1) drawIcon(hHalf, hX, y);
        
        drawIcon(fEmpty, fX, y);
        if (player.food > i * 2 + 1) drawIcon(fFull, fX, y); else if (player.food === i * 2 + 1) drawIcon(fHalf, fX, y);
    }
}

const smeltingRecipes = {'cobblestone': 'stone', 'oak_log': 'charcoal', 'birch_log': 'charcoal', 'coal_ore': 'coal', 'raw_iron': 'iron_ingot', 'raw_gold': 'gold_ingot'};

function getFuelTime(item) {
    if(!item || !item.type) return 0;
    const base = {'oak_log': 150, 'birch_log': 150, 'oak_planks': 150, 'birch_planks': 150, 'stick': 50, 'charcoal': 800, 'coal': 800, 'coal_block': 8000, 'oak_sapling': 50, 'birch_sapling': 50}[item.type];
    if(base) return base; if(item.type.startsWith('wooden_')) return Math.floor(100 * Math.max(0.1, (59 - (item.damage || 0)) / 59)); return 0;
}

function handleSlotAction(arr, idx, e, isFuelSlot = false) {
  e.stopPropagation(); let slot = arr[idx]; let maxStack = (slot.type && (slot.type.endsWith('_pickaxe') || slot.type.endsWith('_axe') || slot.type.endsWith('_shovel') || slot.type.endsWith('_sword') || slot.type.endsWith('_hoe') || slot.type==='chest')) ? (slot.type==='chest'?64:1) : 64;
  if(dragItem && isFuelSlot && getFuelTime(dragItem.item) <= 0) return; 

  playSound('click');
  if (e.button === 0 && e.ctrlKey) {
      if (dragItem) {
          if (!slot.type || slot.type === dragItem.item.type) {
              let space = slot.type ? maxStack - slot.count : maxStack; let placeAmount = Math.ceil(dragItem.item.count / 2); let actualPlace = Math.min(placeAmount, space);
              if (actualPlace > 0) { if (!slot.type) { slot.type = dragItem.item.type; slot.damage = dragItem.item.damage; } slot.count += actualPlace; dragItem.item.count -= actualPlace; if (dragItem.item.count <= 0) { dragItem = null; document.getElementById('drag-icon').style.display = 'none'; } else { document.getElementById('drag-icon').innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); } }
          }
      } else if (slot.type) { let half = Math.ceil(slot.count / 2); dragItem = {item: {type: slot.type, count: half, damage: slot.damage}, source: arr, idx: idx}; slot.count -= half; if(slot.count <= 0) { slot.type = null; slot.damage = 0; } let icon = document.getElementById('drag-icon'); icon.style.display = 'block'; icon.innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); }
      updateUI(); return;
  }
  if (e.button === 0) { 
    if (dragItem) {
      if (!slot.type) { arr[idx] = {type: dragItem.item.type, count: dragItem.item.count, damage: dragItem.item.damage}; if(dragItem.source!=='CREATIVE'){dragItem = null; document.getElementById('drag-icon').style.display = 'none';} } 
      else if (slot.type === dragItem.item.type && slot.count < maxStack) { let space = maxStack - slot.count; if (space > 0) { let add = Math.min(space, dragItem.item.count); slot.count += add; if(dragItem.source!=='CREATIVE') { dragItem.item.count -= add; if (dragItem.item.count <= 0) { dragItem = null; document.getElementById('drag-icon').style.display = 'none'; } } } } 
      else { let temp = {...slot}; arr[idx] = {...dragItem.item}; if(dragItem.source!=='CREATIVE') { dragItem.item = temp; document.getElementById('drag-icon').innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); } }
    } else if (slot.type) { dragItem = {item: {...slot}, source: arr, idx: idx}; arr[idx] = {type: null, count: 0, damage: 0}; let icon = document.getElementById('drag-icon'); icon.style.display = 'block'; icon.innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); }
  } else if (e.button === 2) { 
    if (dragItem) { if (!slot.type || (slot.type === dragItem.item.type && slot.count < maxStack)) { if(!slot.type) { arr[idx] = {type: dragItem.item.type, count: 0, damage: dragItem.item.damage}; } arr[idx].count++; if(dragItem.source!=='CREATIVE') { dragItem.item.count--; if(dragItem.item.count <= 0) { dragItem = null; document.getElementById('drag-icon').style.display = 'none'; } } } } 
    else if (slot.type) { let half = Math.ceil(slot.count / 2); dragItem = {item: {type: slot.type, count: half, damage: slot.damage}, source: arr, idx: idx}; slot.count -= half; if(slot.count <= 0) { slot.type = null; slot.damage = 0; } let icon = document.getElementById('drag-icon'); icon.style.display = 'block'; icon.innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); }
  }
  updateUI();
}

document.addEventListener('mouseup', (e) => {
    if((gameState === "INV" || gameState === "CRAFTING" || gameState === "FURNACE" || gameState === "CREATIVE" || gameState === "CHEST") && dragItem) {
        let box = gameState === "INV" ? document.getElementById('inv-box') : (gameState === "CRAFTING" ? document.getElementById('ct-box') : (gameState === "CREATIVE" ? document.getElementById('c-inv-box') : (gameState === "CHEST" ? document.getElementById('ch-box') : document.getElementById('f-box'))));
        if(!box.contains(e.target) && e.target.id !== 'drag-icon') { 
            if (gameState === "CREATIVE" && e.target.closest('#c-item-grid')) { playSound('click'); } 
            else if(dragItem.source !== 'CREATIVE') { dropItemIntoWorld(dragItem.item.type, dragItem.item.count, dragItem.item.damage); }
            dragItem = null; document.getElementById('drag-icon').style.display = 'none'; updateUI(); 
        }
    }
});

function checkRecipes() {
  const out2 = document.getElementById('craft-output'); updateSlotDOM(out2, {type:null}); out2.onclick = null;
  let c2 = crafting2x2.map(s => s.type); let tot2 = crafting2x2.filter(c => c.type).length;
  if (tot2 === 1 && c2.includes('oak_log')) { updateSlotDOM(out2, {type:'oak_planks', count:4}); out2.onclick = () => processCraft(crafting2x2, 'oak_planks', 4); } 
  else if (tot2 === 1 && c2.includes('birch_log')) { updateSlotDOM(out2, {type:'birch_planks', count:4}); out2.onclick = () => processCraft(crafting2x2, 'birch_planks', 4); } 
  else if (tot2 === 2 && ((c2[0]&&c2[0].endsWith('_planks') && c2[2]&&c2[2].endsWith('_planks')) || (c2[1]&&c2[1].endsWith('_planks') && c2[3]&&c2[3].endsWith('_planks')))) { updateSlotDOM(out2, {type:'stick', count:4}); out2.onclick = () => processCraft(crafting2x2, 'stick', 4); } 
  else if (tot2 === 2 && ((c2[0]==='coal'||c2[0]==='charcoal') && c2[2]==='stick' || (c2[1]==='coal'||c2[1]==='charcoal') && c2[3]==='stick')) { updateSlotDOM(out2, {type:'torch', count:4}); out2.onclick = () => processCraft(crafting2x2, 'torch', 4); } 
  else if (tot2 === 4 && !c2.includes(null) && c2.every(v=>v&&v.endsWith('_planks'))) { updateSlotDOM(out2, {type:'crafting_table', count:1}); out2.onclick = () => processCraft(crafting2x2, 'crafting_table', 1); }

  const out3 = document.getElementById('ct-craft-output'); updateSlotDOM(out3, {type:null}); out3.onclick = null;
  let c3 = crafting3x3.map(s => s.type); let tot3 = crafting3x3.filter(c => c.type).length;
  if (tot3 === 1 && c3.includes('oak_log')) { updateSlotDOM(out3, {type:'oak_planks', count:4}); out3.onclick = () => processCraft(crafting3x3, 'oak_planks', 4); }
  else if (tot3 === 1 && c3.includes('birch_log')) { updateSlotDOM(out3, {type:'birch_planks', count:4}); out3.onclick = () => processCraft(crafting3x3, 'birch_planks', 4); }
  else if (tot3 === 1 && c3.includes('coal_block')) { updateSlotDOM(out3, {type:'coal', count:9}); out3.onclick = () => processCraft(crafting3x3, 'coal', 9); }
  else if (tot3 === 1 && c3.includes('iron_block')) { updateSlotDOM(out3, {type:'iron_ingot', count:9}); out3.onclick = () => processCraft(crafting3x3, 'iron_ingot', 9); }
  else if (tot3 === 1 && c3.includes('gold_block')) { updateSlotDOM(out3, {type:'gold_ingot', count:9}); out3.onclick = () => processCraft(crafting3x3, 'gold_ingot', 9); }
  else if (tot3 === 1 && c3.includes('diamond_block')) { updateSlotDOM(out3, {type:'diamond', count:9}); out3.onclick = () => processCraft(crafting3x3, 'diamond', 9); }
  else if (tot3 === 1 && c3.includes('lapis_block')) { updateSlotDOM(out3, {type:'lapis_lazuli', count:9}); out3.onclick = () => processCraft(crafting3x3, 'lapis_lazuli', 9); }
  else if (tot3 === 1 && c3.includes('emerald_block')) { updateSlotDOM(out3, {type:'emerald', count:9}); out3.onclick = () => processCraft(crafting3x3, 'emerald', 9); }
  else if (tot3 === 1 && c3.includes('redstone_block')) { updateSlotDOM(out3, {type:'redstone', count:9}); out3.onclick = () => processCraft(crafting3x3, 'redstone', 9); }
  else if (tot3 === 2 && (((c3[0]&&c3[0].endsWith('_planks'))&&(c3[3]&&c3[3].endsWith('_planks')))||((c3[1]&&c3[1].endsWith('_planks'))&&(c3[4]&&c3[4].endsWith('_planks')))||((c3[2]&&c3[2].endsWith('_planks'))&&(c3[5]&&c3[5].endsWith('_planks')))||((c3[3]&&c3[3].endsWith('_planks'))&&(c3[6]&&c3[6].endsWith('_planks')))||((c3[4]&&c3[4].endsWith('_planks'))&&(c3[7]&&c3[7].endsWith('_planks')))||((c3[5]&&c3[5].endsWith('_planks'))&&(c3[8]&&c3[8].endsWith('_planks'))))) { updateSlotDOM(out3, {type:'stick', count:4}); out3.onclick = () => processCraft(crafting3x3, 'stick', 4); }
  else if (tot3 === 2 && (((c3[0]==='coal'||c3[0]==='charcoal')&&c3[3]==='stick')||((c3[1]==='coal'||c3[1]==='charcoal')&&c3[4]==='stick')||((c3[2]==='coal'||c3[2]==='charcoal')&&c3[5]==='stick')||((c3[3]==='coal'||c3[3]==='charcoal')&&c3[6]==='stick')||((c3[4]==='coal'||c3[4]==='charcoal')&&c3[7]==='stick')||((c3[5]==='coal'||c3[5]==='charcoal')&&c3[8]==='stick'))) { updateSlotDOM(out3, {type:'torch', count:4}); out3.onclick = () => processCraft(crafting3x3, 'torch', 4); }
  else if (tot3 === 4) { let p = (s)=>s&&s.endsWith('_planks'); if ((p(c3[0])&&p(c3[1])&&p(c3[3])&&p(c3[4])) || (p(c3[1])&&p(c3[2])&&p(c3[4])&&p(c3[5])) || (p(c3[3])&&p(c3[4])&&p(c3[6])&&p(c3[7])) || (p(c3[4])&&p(c3[5])&&p(c3[7])&&p(c3[8]))) { updateSlotDOM(out3, {type:'crafting_table', count:1}); out3.onclick = () => processCraft(crafting3x3, 'crafting_table', 1); } }
  else if (tot3 === 8 && c3[4] === null && c3.every((v, i) => i === 4 || v === 'cobblestone')) { updateSlotDOM(out3, {type:'furnace', count:1}); out3.onclick = () => processCraft(crafting3x3, 'furnace', 1); }
  else if (tot3 === 8 && c3[4] === null && c3.every((v, i) => i === 4 || (v&&v.endsWith('_planks')))) { updateSlotDOM(out3, {type:'chest', count:1}); out3.onclick = () => processCraft(crafting3x3, 'chest', 1); }
  else if (tot3 === 9 && !c3.includes(null) && c3.every(v=>v==='coal')) { updateSlotDOM(out3, {type:'coal_block', count:1}); out3.onclick = () => processCraft(crafting3x3, 'coal_block', 1); }
  else if (tot3 === 9 && !c3.includes(null) && c3.every(v=>v==='iron_ingot')) { updateSlotDOM(out3, {type:'iron_block', count:1}); out3.onclick = () => processCraft(crafting3x3, 'iron_block', 1); }
  else if (tot3 === 9 && !c3.includes(null) && c3.every(v=>v==='gold_ingot')) { updateSlotDOM(out3, {type:'gold_block', count:1}); out3.onclick = () => processCraft(crafting3x3, 'gold_block', 1); }
  else if (tot3 === 9 && !c3.includes(null) && c3.every(v=>v==='diamond')) { updateSlotDOM(out3, {type:'diamond_block', count:1}); out3.onclick = () => processCraft(crafting3x3, 'diamond_block', 1); }
  else if (tot3 === 9 && !c3.includes(null) && c3.every(v=>v==='lapis_lazuli')) { updateSlotDOM(out3, {type:'lapis_block', count:1}); out3.onclick = () => processCraft(crafting3x3, 'lapis_block', 1); }
  else if (tot3 === 9 && !c3.includes(null) && c3.every(v=>v==='emerald')) { updateSlotDOM(out3, {type:'emerald_block', count:1}); out3.onclick = () => processCraft(crafting3x3, 'emerald_block', 1); }
  else if (tot3 === 9 && !c3.includes(null) && c3.every(v=>v==='redstone')) { updateSlotDOM(out3, {type:'redstone_block', count:1}); out3.onclick = () => processCraft(crafting3x3, 'redstone_block', 1); }
  
  let p='_planks', s='stick';
  let checkPick = (m1, m2) => (c3[0]&&(c3[0]===m1||c3[0].endsWith(m2))) && (c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && (c3[2]&&(c3[2]===m1||c3[2].endsWith(m2))) && c3[4]===s && c3[7]===s && !c3[3] && !c3[5] && !c3[6] && !c3[8];
  let checkAxe = (m1, m2) => ((c3[0]&&(c3[0]===m1||c3[0].endsWith(m2))) && (c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && (c3[3]&&(c3[3]===m1||c3[3].endsWith(m2))) && c3[4]===s && c3[7]===s && !c3[2] && !c3[5] && !c3[6] && !c3[8]) || ((c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && (c3[2]&&(c3[2]===m1||c3[2].endsWith(m2))) && (c3[4]&&(c3[4]===m1||c3[4].endsWith(m2))) && c3[5]===s && c3[8]===s && !c3[0] && !c3[3] && !c3[6] && !c3[7]) || ((c3[0]&&(c3[0]===m1||c3[0].endsWith(m2))) && (c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && (c3[4]&&(c3[4]===m1||c3[4].endsWith(m2))) && c3[3]===s && c3[6]===s && !c3[2] && !c3[5] && !c3[7] && !c3[8]) || ((c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && (c3[2]&&(c3[2]===m1||c3[2].endsWith(m2))) && (c3[5]&&(c3[5]===m1||c3[5].endsWith(m2))) && c3[4]===s && c3[7]===s && !c3[0] && !c3[3] && !c3[6] && !c3[8]);
  let checkHoe = (m1, m2) => ((c3[0]&&(c3[0]===m1||c3[0].endsWith(m2))) && (c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && c3[4]===s && c3[7]===s && !c3[2] && !c3[3] && !c3[5] && !c3[6] && !c3[8]) || ((c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && (c3[2]&&(c3[2]===m1||c3[2].endsWith(m2))) && c3[4]===s && c3[7]===s && !c3[0] && !c3[3] && !c3[5] && !c3[6] && !c3[8]) || ((c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && (c3[2]&&(c3[2]===m1||c3[2].endsWith(m2))) && c3[5]===s && c3[8]===s && !c3[0] && !c3[3] && !c3[4] && !c3[6] && !c3[7]) || ((c3[0]&&(c3[0]===m1||c3[0].endsWith(m2))) && (c3[1]&&(c3[1]===m1||c3[1].endsWith(m2))) && c3[3]===s && c3[6]===s && !c3[2] && !c3[4] && !c3[5] && !c3[7] && !c3[8]);
  let checkShovel = (m1, m2) => { for(let i=0; i<3; i++) { if((c3[i]&&(c3[i]===m1||c3[i].endsWith(m2))) && c3[i+3]===s && c3[i+6]===s) { let empty=true; for(let j=0; j<9; j++) if(j!==i && j!==i+3 && j!==i+6 && c3[j]!==null) empty=false; if(empty) return true; } } return false; }
  let checkSword = (m1, m2) => { for(let i=0; i<3; i++) { if((c3[i]&&(c3[i]===m1||c3[i].endsWith(m2))) && (c3[i+3]&&(c3[i+3]===m1||c3[i+3].endsWith(m2))) && c3[i+6]===s) { let empty=true; for(let j=0; j<9; j++) if(j!==i && j!==i+3 && j!==i+6 && c3[j]!==null) empty=false; if(empty) return true; } } return false; }

  if(checkPick('?',p)) { updateSlotDOM(out3, {type:'wooden_pickaxe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'wooden_pickaxe', 1); }
  else if(checkPick('cobblestone','stone')) { updateSlotDOM(out3, {type:'stone_pickaxe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'stone_pickaxe', 1); }
  else if(checkPick('iron_ingot','iron_ingot')) { updateSlotDOM(out3, {type:'iron_pickaxe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'iron_pickaxe', 1); }
  else if(checkPick('gold_ingot','gold_ingot')) { updateSlotDOM(out3, {type:'golden_pickaxe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'golden_pickaxe', 1); }
  else if(checkPick('diamond','diamond')) { updateSlotDOM(out3, {type:'diamond_pickaxe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'diamond_pickaxe', 1); }
  
  else if(checkAxe('?',p)) { updateSlotDOM(out3, {type:'wooden_axe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'wooden_axe', 1); }
  else if(checkAxe('cobblestone','stone')) { updateSlotDOM(out3, {type:'stone_axe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'stone_axe', 1); }
  else if(checkAxe('iron_ingot','iron_ingot')) { updateSlotDOM(out3, {type:'iron_axe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'iron_axe', 1); }
  else if(checkAxe('gold_ingot','gold_ingot')) { updateSlotDOM(out3, {type:'golden_axe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'golden_axe', 1); }
  else if(checkAxe('diamond','diamond')) { updateSlotDOM(out3, {type:'diamond_axe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'diamond_axe', 1); }
  
  else if(checkHoe('?',p)) { updateSlotDOM(out3, {type:'wooden_hoe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'wooden_hoe', 1); }
  else if(checkHoe('cobblestone','stone')) { updateSlotDOM(out3, {type:'stone_hoe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'stone_hoe', 1); }
  else if(checkHoe('iron_ingot','iron_ingot')) { updateSlotDOM(out3, {type:'iron_hoe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'iron_hoe', 1); }
  else if(checkHoe('gold_ingot','gold_ingot')) { updateSlotDOM(out3, {type:'golden_hoe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'golden_hoe', 1); }
  else if(checkHoe('diamond','diamond')) { updateSlotDOM(out3, {type:'diamond_hoe', count:1}); out3.onclick = () => processCraft(crafting3x3, 'diamond_hoe', 1); }
  
  else if(checkShovel('?',p)) { updateSlotDOM(out3, {type:'wooden_shovel', count:1}); out3.onclick = () => processCraft(crafting3x3, 'wooden_shovel', 1); }
  else if(checkShovel('cobblestone','stone')) { updateSlotDOM(out3, {type:'stone_shovel', count:1}); out3.onclick = () => processCraft(crafting3x3, 'stone_shovel', 1); }
  else if(checkShovel('iron_ingot','iron_ingot')) { updateSlotDOM(out3, {type:'iron_shovel', count:1}); out3.onclick = () => processCraft(crafting3x3, 'iron_shovel', 1); }
  else if(checkShovel('gold_ingot','gold_ingot')) { updateSlotDOM(out3, {type:'golden_shovel', count:1}); out3.onclick = () => processCraft(crafting3x3, 'golden_shovel', 1); }
  else if(checkShovel('diamond','diamond')) { updateSlotDOM(out3, {type:'diamond_shovel', count:1}); out3.onclick = () => processCraft(crafting3x3, 'diamond_shovel', 1); }
  
  else if(checkSword('?',p)) { updateSlotDOM(out3, {type:'wooden_sword', count:1}); out3.onclick = () => processCraft(crafting3x3, 'wooden_sword', 1); }
  else if(checkSword('cobblestone','stone')) { updateSlotDOM(out3, {type:'stone_sword', count:1}); out3.onclick = () => processCraft(crafting3x3, 'stone_sword', 1); }
  else if(checkSword('iron_ingot','iron_ingot')) { updateSlotDOM(out3, {type:'iron_sword', count:1}); out3.onclick = () => processCraft(crafting3x3, 'iron_sword', 1); }
  else if(checkSword('gold_ingot','gold_ingot')) { updateSlotDOM(out3, {type:'golden_sword', count:1}); out3.onclick = () => processCraft(crafting3x3, 'golden_sword', 1); }
  else if(checkSword('diamond','diamond')) { updateSlotDOM(out3, {type:'diamond_sword', count:1}); out3.onclick = () => processCraft(crafting3x3, 'diamond_sword', 1); }
}

function processCraft(arr, resultType, amount) { playSound('click'); arr.forEach(c => { if(c.count > 0) c.count--; }); addToInventory(resultType, amount, 0); }
