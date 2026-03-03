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
        for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1; let noise = audioCtx.createBufferSource(); noise.buffer = buffer; 
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
        for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1; let noise = audioCtx.createBufferSource(); noise.buffer = buffer; noise.playbackRate.value = 0.85 + Math.random() * 0.3;
        let filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; 
        if (['stone', 'cobblestone', 'bedrock', 'furnace', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'redstone_ore', 'lapis_ore', 'emerald_ore'].includes(blockName) || blockName.endsWith('_block')) { filter.frequency.value = 1800; filter.type = 'highpass'; } 
        else if (blockName.endsWith('_log') || blockName.endsWith('_planks') || blockName === 'crafting_table' || blockName === 'torch' || blockName === 'chest') { filter.frequency.value = 600; } 
        else if (blockName.endsWith('_leaves') || blockName.endsWith('_sapling') || blockName === 'dead_bush' || blockName === 'short_grass' || blockName === 'rose' || blockName === 'dandelion' || blockName === 'wheat' || blockName === 'seeds') { filter.frequency.value = 2500; filter.type = 'bandpass'; } 
        else if (blockName === 'sand' || blockName === 'gravel') { filter.frequency.value = 800; filter.type = 'lowpass'; noise.playbackRate.value = 0.6; } else { filter.frequency.value = 350; } 
        g.gain.setValueAtTime(type==='step' || type==='dig' ? 0.15 : 0.4, now); g.gain.exponentialRampToValueAtTime(0.01, now + (type==='step'||type==='dig'?0.1:0.25)); 
        noise.connect(filter); filter.connect(g); noise.start(now);
    }
}

function playMusic() {
    initAudio(); if(isPlayingMusic || !optMusic) return; isPlayingMusic = true;
    const seq = [ {n: 369.99, d: 800, wait: 800}, {n: 415.30, d: 800, wait: 800}, {n: 440.00, d: 1600, wait: 1600}, {n: 659.25, d: 2000, wait: 2000}, {n: 554.37, d: 1200, wait: 1200}, {n: 440.00, d: 800, wait: 800}, {n: 415.30, d: 800, wait: 800}, {n: 329.63, d: 3000, wait: 4500} ];
    let idx = 0;
    function playNextNote() {
        if(!optMusic) { isPlayingMusic = false; return; } if(idx >= seq.length) { idx = 0; setTimeout(playNextNote, 8000); return; }
        let note = seq[idx]; idx++; let now = audioCtx.currentTime;
        [-0.01, 0, 0.01].forEach(detune => {
            let o = audioCtx.createOscillator(); o.type = 'sine'; let g = audioCtx.createGain(); let filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
            o.frequency.value = note.n * (1 + detune); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.12, now + 0.3); g.gain.linearRampToValueAtTime(0, now + (note.d/1000) + 1.5);
            o.connect(filter); filter.connect(g); g.connect(audioCtx.destination); g.connect(reverbNode); o.start(now); o.stop(now + (note.d/1000) + 1.5);
        }); setTimeout(playNextNote, note.wait);
    } playNextNote();
}

function playSelectedWorld() {
    if(selectedWorldListId && savedWorlds[selectedWorldListId]) {
        activeWorldId = selectedWorldListId; let w = savedWorlds[activeWorldId]; modifiedBlocks = w.modifiedBlocks || {}; if(w.inventory) { inventory = w.inventory; } 
        if(w.playerParams) { player = {...w.playerParams}; player.dead = false; } else { player = { hp: 20, maxHp: 20, food: 20, maxFood: 20, saturation: 5.0, dead: false, flying: false, exhaustion: 0 }; }
        if(w.gamerules) gamerules = {...w.gamerules}; if(w.achievements) achievements = {...w.achievements};
        startGame(w);
    }
}

let initialLoadQueue = []; let initialLoadTotal = 0; let gameplayChunkQueue = [];
for(let cx = -3; cx <= 3; cx++) { for(let cz = -3; cz <= 3; cz++) { generateChunkVolume(cx, cz); chunks.set(`${cx},${cz}`, new Chunk(cx, cz)); } }
chunks.forEach(c => c.update()); cameraGroup.position.set(0, getSurfaceH(0, 0) + 10, 0);

function startGame(saveData = null) { 
    initAudio(); 
    voxels.clear(); dynamicBlocks.forEach((v,k)=>sc.remove(v.light)); dynamicBlocks.clear();
    for(let [k, chunk] of chunks.entries()) { for(let t in chunk.meshes) { chunk.group.remove(chunk.meshes[t].mesh); chunk.meshes[t].mesh.dispose(); } sc.remove(chunk.group); }
    chunks.clear(); drops.forEach(d=>sc.remove(d.mesh)); drops = []; fallingBlocks.forEach(b=>sc.remove(b.mesh)); fallingBlocks = [];
    
    document.querySelectorAll('.menu-overlay').forEach(m => m.style.display = 'none'); document.getElementById('loading-screen').style.display = 'flex';
    gameState = "LOADING"; initialLoadQueue = []; chatLog = []; updateChatDOM();
    
    if(saveData && saveData.pos) { cameraGroup.position.set(saveData.pos.x, saveData.pos.y, saveData.pos.z); cam.rotation.x = saveData.pos.rotX || 0; targetRotation.y = saveData.pos.rotY || 0; }
    else {
        cameraGroup.position.set(0, getSurfaceH(0, 0) + 2, 0); targetRotation.y = 0; cam.rotation.x = 0; inventory = Array(36).fill(null).map(() => ({type: null, count: 0, damage: 0}));
        if(saveData && saveData.chest) { 
            let cX = 0, cZ = 2; let cY = getSurfaceH(cX, cZ) + 1; modifiedBlocks[`${cX},${cY},${cZ}`] = 'chest';
            modifiedBlocks[`${cX+1},${cY},${cZ}`] = 'torch'; modifiedBlocks[`${cX-1},${cY},${cZ}`] = 'torch'; modifiedBlocks[`${cX},${cY},${cZ+1}`] = 'torch'; modifiedBlocks[`${cX},${cY},${cZ-1}`] = 'torch';
            let startChest = Array(27).fill(null).map(() => ({type: null, count: 0, damage: 0}));
            let rSlot = () => Math.floor(Math.random() * 27);
            startChest[rSlot()] = {type:'wooden_pickaxe', count:1, damage:0}; startChest[rSlot()] = {type:'apple', count:5, damage:0}; startChest[rSlot()] = {type:'oak_log', count:10, damage:0};
            if(!saveData.chests) saveData.chests = {}; saveData.chests[`${cX},${cY},${cZ}`] = startChest;
        }
    }
    for(let k in modifiedBlocks) {
        if(modifiedBlocks[k] !== 'AIR') voxels.set(k, modifiedBlocks[k]);
        if(modifiedBlocks[k] === 'torch' || modifiedBlocks[k].endsWith('_sapling') || modifiedBlocks[k] === 'dead_bush' || modifiedBlocks[k] === 'furnace' || modifiedBlocks[k] === 'chest' || modifiedBlocks[k] === 'short_grass' || modifiedBlocks[k] === 'dandelion' || modifiedBlocks[k] === 'rose' || modifiedBlocks[k] === 'seeds' || modifiedBlocks[k] === 'wheat') { let coords = k.split(',').map(Number); addDynamicBlock(coords[0], coords[1], coords[2], modifiedBlocks[k], new THREE.Vector3(0,1,0)); }
    }
    let pX = Math.floor(cameraGroup.position.x / CHUNK_SIZE); let pZ = Math.floor(cameraGroup.position.z / CHUNK_SIZE);
    for(let x = pX - RENDER_DIST; x <= pX + RENDER_DIST; x++) { for(let z = pZ - RENDER_DIST; z <= pZ + RENDER_DIST; z++) { if(!chunks.has(`${x},${z}`)) initialLoadQueue.push({x, z}); } }
    initialLoadQueue.sort((a,b) => ((a.x-pX)*(a.x-pX) + (a.z-pZ)*(a.z-pZ)) - ((b.x-pX)*(b.x-pX) + (b.z-pZ)*(b.z-pZ))); initialLoadTotal = initialLoadQueue.length;
    if(initialLoadTotal === 0) { setTimeout(() => { document.getElementById('loading-screen').style.display = 'none'; playMusic(); setMenu('PLAYING'); }, 300); } else { processLoad(); }
}
function processLoad() {
    let start = performance.now();
    while(initialLoadQueue.length > 0 && performance.now() - start < 20) { let c = initialLoadQueue.shift(); let cKey = `${c.x},${c.z}`; if(!chunks.has(cKey)) { generateChunkVolume(c.x, c.z); chunks.set(cKey, new Chunk(c.x, c.z)); } }
    document.getElementById('loading-bar-fill').style.width = (((initialLoadTotal - initialLoadQueue.length) / initialLoadTotal) * 100) + '%';
    if(initialLoadQueue.length > 0) { requestAnimationFrame(processLoad); } 
    else { chunks.forEach(c => c.update()); setTimeout(() => { document.getElementById('loading-screen').style.display = 'none'; playMusic(); setMenu('PLAYING'); }, 300); }
}

document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && gameState === "PLAYING") setMenu('PAUSE_MENU'); });

function fastVoxelRaycast(origin, dir, maxDist) {
    let pos = origin.clone(); let step = 0.05; 
    let lastBx = Math.round(pos.x), lastBy = Math.round(pos.y), lastBz = Math.round(pos.z);
    for(let d = 0; d < maxDist; d += step) {
        pos.addScaledVector(dir, step);
        let bx = Math.round(pos.x), by = Math.round(pos.y), bz = Math.round(pos.z); let k = `${bx},${by},${bz}`;
        if(voxels.has(k) && voxels.get(k) !== 'AIR') {
            if(voxels.get(k) === 'torch' || voxels.get(k).endsWith('_sapling') || voxels.get(k) === 'dead_bush' || voxels.get(k) === 'short_grass' || voxels.get(k) === 'dandelion' || voxels.get(k) === 'rose' || voxels.get(k) === 'seeds' || voxels.get(k) === 'wheat') { if (Math.abs(pos.x - bx) > 0.25 || Math.abs(pos.z - bz) > 0.25) continue; }
            if(voxels.get(k) === 'cactus' && (Math.abs(pos.x - bx) > 0.4 || Math.abs(pos.z - bz) > 0.4)) continue;
            let nx = Math.max(-1, Math.min(1, lastBx - bx)), ny = Math.max(-1, Math.min(1, lastBy - by)), nz = Math.max(-1, Math.min(1, lastBz - bz));
            if(Math.abs(nx) + Math.abs(ny) + Math.abs(nz) !== 1) { if (Math.abs(dir.x) > Math.abs(dir.y) && Math.abs(dir.x) > Math.abs(dir.z)) { nx = -Math.sign(dir.x); ny=0; nz=0; } else if (Math.abs(dir.y) > Math.abs(dir.z)) { ny = -Math.sign(dir.y); nx=0; nz=0; } else { nz = -Math.sign(dir.z); nx=0; ny=0; } }
            return {x: bx, y: by, z: bz, name: voxels.get(k), normal: new THREE.Vector3(nx, ny, nz)};
        } lastBx = bx; lastBy = by; lastBz = bz;
    } return null;
}

function dropItemIntoWorld(type, amount = 1, damage = 0) {
    let dmgLevel = getDmgLevel(type, damage);
    for(let j=0; j<amount; j++) {
        let dir = new THREE.Vector3(); cam.getWorldDirection(dir); let dropPos = cameraGroup.position.clone().addScaledVector(dir, 1.2); dropPos.y += 0.2; 
        let drop, mat; let em = { emissive: 0x050505 };
        let is2D = (type === 'stick' || type === 'charcoal' || type === 'coal' || type.endsWith('_ingot') || type.startsWith('raw_') || type === 'diamond' || type === 'emerald' || type === 'lapis_lazuli' || type === 'redstone' || type === 'torch' || type === 'apple' || transparentBlocks.includes(type) || type === 'chest' || type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe'));
        if (is2D) { 
            let group = new THREE.Group(); let tex = genTex(type, dmgLevel);
            let matFront = new THREE.MeshLambertMaterial({map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, ...em}); let pGeo = new THREE.PlaneGeometry(0.5, 0.5);
            for(let i=0; i<5; i++) { let mesh = new THREE.Mesh(pGeo, matFront); mesh.position.z = (i - 2.0) * 0.015; mesh.castShadow = true; group.add(mesh); } drop = group;
        } else { 
            if (type.endsWith('_log')) { mat = [new THREE.MeshLambertMaterial({map: genTex(type), ...em}), new THREE.MeshLambertMaterial({map: genTex(type), ...em}), new THREE.MeshLambertMaterial({map: genTex(type.replace('log','top')), ...em}), new THREE.MeshLambertMaterial({map: genTex(type.replace('log','top')), ...em}), new THREE.MeshLambertMaterial({map: genTex(type), ...em}), new THREE.MeshLambertMaterial({map: genTex(type), ...em})]; }
            else if (type === 'crafting_table') { mat = [new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('oak_planks'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em})]; }
            else if (type === 'grass') { mat = [new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grass'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em})]; }
            else if (type === 'farmland') { mat = [new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('farmlandTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em})]; }
            else if (type === 'furnace') { mat = [new THREE.MeshLambertMaterial({map: genTex('furnaceSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceFront'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceSide'), ...em})]; }
            else { mat = new THREE.MeshLambertMaterial({map: genTex(type), ...em}); }
            drop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat); drop.castShadow = true;
        }
        drop.position.copy(dropPos); sc.add(drop); drops.push({mesh: drop, type: type, damage: damage, velY: 0.15, is2D: is2D, velDir: dir.multiplyScalar(0.25).add(new THREE.Vector3((Math.random()-0.5)*0.1, 0, (Math.random()-0.5)*0.1)), spawnTime: Date.now()});
    }
}

const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), crackMats[0]); crackMesh.renderOrder = 1; sc.add(crackMesh); crackMesh.visible = false;

let keys = {}, pVel = new THREE.Vector3(), yVel = 0, stepTimer = 0, globalTick = 0; let highestY = 0; let lastSpacePress = 0;

function applyDamage(amount, sourceStr) {
    if(savedWorlds[activeWorldId] && (savedWorlds[activeWorldId].mode === 'CREATIVE' || savedWorlds[activeWorldId].mode === 'SPECTATOR')) return;
    if(player.dead) return;
    playSound('damage'); player.hp -= amount; cam.rotation.z = 0.2; setTimeout(() => cam.rotation.z = 0, 200);
    if(player.hp <= 0) { player.hp = 0; player.dead = true; addChatMessage(`Player ${sourceStr}`, "#aaa"); if(!gamerules.keepInventory) { inventory.forEach(s => { if(s.count>0) { dropItemIntoWorld(s.type, s.count, s.damage); s.type=null; s.count=0; } }); } setMenu('DEATH'); }
    updateUI();
}

function respawnPlayer() {
    if(savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'HARDCORE') { savedWorlds[activeWorldId].mode = 'SPECTATOR'; player.hp = 20; player.food = 20; player.dead = false; setMenu('PLAYING'); return; }
    player.hp = 20; player.food = 20; player.dead = false; player.flying = false; yVel = 0; pVel.set(0,0,0);
    cameraGroup.position.set(0, getSurfaceH(0, 0) + 2, 0); document.getElementById('vhs-scanlines').style.background = 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.5) 50%)'; setMenu('PLAYING');
}

function animate() {
    requestAnimationFrame(animate); if(gameState === "LOADING") return;
    let isPaused = (gameState === "PAUSE_MENU" || gameState === "OPTIONS" || gameState === "SUB_MENU" || gameState === "TEXTURE_PACKS" || gameState === "DEATH" || gameState === "MAIN_MENU");

    if(!isPaused) {
        cam.rotation.x += (targetRotation.x - cam.rotation.x) * 0.22; cam.rotation.y += (targetRotation.y - cam.rotation.y) * 0.22;
        globalTick++; updateChatDOM();
        let camIntX = Math.floor(cameraGroup.position.x); let camIntZ = Math.floor(cameraGroup.position.z);
        sun.position.set(camIntX + 30, 100, camIntZ + 30); sun.target.position.set(camIntX, 0, camIntZ); sun.target.updateMatrixWorld();
        
        let pY = Math.floor(cameraGroup.position.y); let sY = getSurfaceH(camIntX, camIntZ); let isEnclosed = false;
        for(let cy = pY; cy <= sY + 1; cy++) { let t = voxels.get(`${camIntX},${cy},${camIntZ}`); if(t && t !== 'AIR' && !transparentBlocks.includes(t)) { isEnclosed = true; break; } }
        let targetAmbient = optLighting === 1 ? 0.45 : 0.8; let targetFogColor = new THREE.Color(skyColor); let depth = (sY - pY);
        if (isEnclosed && depth >= 0 && optLighting === 1) { let darkness = Math.max(0.04, 0.25 - (depth * 0.015)); targetAmbient = darkness; targetFogColor.setHex(0x050505); }
        amb.intensity = THREE.MathUtils.lerp(amb.intensity, targetAmbient, 0.05); sc.fog.color.lerp(targetFogColor, 0.05); sc.background.lerp(targetFogColor, 0.05);

        if(gameplayChunkQueue.length > 0) { let c = gameplayChunkQueue.shift(); generateChunkVolume(c.x, c.z); let chunk = new Chunk(c.x, c.z); chunk.update(); chunks.set(`${c.x},${c.z}`, chunk); }

        if(globalTick % 60 === 0) {
            let pX = Math.floor(cameraGroup.position.x / CHUNK_SIZE); let pZ = Math.floor(cameraGroup.position.z / CHUNK_SIZE);
            for(let [k, chunk] of chunks.entries()) { if (Math.abs(chunk.cx - pX) > RENDER_DIST + 1 || Math.abs(chunk.cz - pZ) > RENDER_DIST + 1) { for(let t in chunk.meshes) { chunk.group.remove(chunk.meshes[t].mesh); chunk.meshes[t].mesh.dispose(); } sc.remove(chunk.group); chunks.delete(k); } }
        }

        let dirtyUpdateCount = 0; for (let [k, c] of chunks.entries()) { if (c.dirty && dirtyUpdateCount < 1) { c.update(); dirtyUpdateCount++; } }

        if(globalTick % 2 === 0) { 
            let uiNeedsUpdate = false;
            dynamicBlocks.forEach((fd, key) => {
                if(fd.type === 'furnace') {
                    let canSmelt = fd.slots[0].count > 0 && smeltingRecipes[fd.slots[0].type] && (!fd.slots[2].type || (fd.slots[2].type === smeltingRecipes[fd.slots[0].type] && fd.slots[2].count < 64));
                    if(fd.burnTime > 0) { fd.burnTime--; }
                    if(fd.burnTime <= 0 && canSmelt && fd.slots[1].count > 0) { fd.maxBurnTime = getFuelTime(fd.slots[1]); if(fd.maxBurnTime > 0) { fd.burnTime = fd.maxBurnTime; fd.slots[1].count--; if(fd.slots[1].count <= 0) fd.slots[1].type = null; } }
                    if(fd.burnTime > 0 && canSmelt) { fd.cookTime++; if(fd.cookTime >= fd.maxCookTime) { fd.cookTime = 0; let outType = smeltingRecipes[fd.slots[0].type]; fd.slots[0].count--; if(fd.slots[0].count <= 0) fd.slots[0].type = null; if(!fd.slots[2].type) { fd.slots[2].type = outType; fd.slots[2].count = 0; } fd.slots[2].count++; } } else { if (fd.cookTime > 0) fd.cookTime = Math.max(0, fd.cookTime - 2); }
                    let litNow = fd.burnTime > 0;
                    if (fd.lit !== litNow) {
                        fd.lit = litNow; fd.material[fd.frontIdx].map = genTex(litNow ? 'furnaceFrontLit' : 'furnaceFront'); fd.material[fd.frontIdx].needsUpdate = true;
                        if (litNow) { let coords = key.split(',').map(Number); let light = new THREE.PointLight(0xffa500, 2.0, 16, 1.2); light.position.set(coords[0], coords[1], coords[2]); sc.add(light); fd.light = light; } else { if (fd.light) { sc.remove(fd.light); fd.light = null; } }
                    }
                    if(gameState === "FURNACE" && activeFurnacePos === key) uiNeedsUpdate = true;
                }
            }); if(uiNeedsUpdate) updateUI();
        }

        let keysArr = Array.from(voxels.keys());
        for(let i=0; i<60; i++) {
            if(keysArr.length === 0) break;
            let rKey = keysArr[Math.floor(Math.random() * keysArr.length)]; let type = voxels.get(rKey); let coords = rKey.split(',').map(Number);
            if (type && type.endsWith('_leaves')) {
                let foundWood = false;
                for(let dx=-3; dx<=3 && !foundWood; dx++) for(let dy=-3; dy<=3 && !foundWood; dy++) for(let dz=-3; dz<=3 && !foundWood; dz++) { let k2=`${coords[0]+dx},${coords[1]+dy},${coords[2]+dz}`; let t2 = voxels.get(k2); if(t2 && t2.endsWith('_log')) foundWood = true; }
                if(!foundWood) { playSound('break', type); removeB(coords[0], coords[1], coords[2]); if(Math.random()<0.05) dropItemIntoWorld(type.replace('leaves','sapling'), 1, 0); if(type === 'oak_leaves' && Math.random()<0.05) dropItemIntoWorld('apple', 1, 0); }
            } else if (type === 'farmland') {
                if (Math.random() < 0.2) { removeB(coords[0],coords[1],coords[2]); placeB(coords[0],coords[1],coords[2], 'dirt'); }
            } else if (type === 'dirt') {
                if (Math.random() < 0.05 && !isSolidVoxel(coords[0], coords[1]+1, coords[2])) {
                    let hasGrass = false; for(let dx=-1; dx<=1; dx++) for(let dy=-1; dy<=1; dy++) for(let dz=-1; dz<=1; dz++) { if(voxels.get(`${coords[0]+dx},${coords[1]+dy},${coords[2]+dz}`) === 'grass') hasGrass = true; }
                    if(hasGrass) { removeB(coords[0],coords[1],coords[2]); placeB(coords[0],coords[1],coords[2], 'grass'); }
                }
            } else if (type && type.endsWith('_sapling')) {
                if (Math.random() < 0.02) { removeB(coords[0], coords[1], coords[2]); generateTree(coords[0], coords[1], coords[2], type.replace('_sapling','')); }
            } else if (type === 'cactus') {
                let below = voxels.get(`${coords[0]},${coords[1]-1},${coords[2]}`);
                if(below !== 'sand' && below !== 'cactus') removeB(coords[0], coords[1], coords[2]);
                else if(Math.random() < 0.02 && !voxels.has(`${coords[0]},${coords[1]+1},${coords[2]}`)) { let cHeight = 1; while(voxels.get(`${coords[0]},${coords[1]-cHeight},${coords[2]}`) === 'cactus') cHeight++; if(cHeight < 4) placeB(coords[0], coords[1]+1, coords[2], 'cactus'); }
            } else if (type === 'seeds') {
                if (Math.random() < 0.05) { removeB(coords[0], coords[1], coords[2]); placeB(coords[0], coords[1], coords[2], 'wheat'); }
            }
        }

        for(let i = fallingBlocks.length - 1; i >= 0; i--) {
            let b = fallingBlocks[i]; b.vel -= 0.02; b.mesh.position.y += b.vel;
            if (b.mesh.position.y < Math.floor(b.y)) { let destY = Math.floor(b.y) - 1; if (isSolidVoxel(b.x, destY, b.z) || destY < -60) { sc.remove(b.mesh); placeB(b.x, Math.floor(b.y), b.z, b.type); fallingBlocks.splice(i, 1); } else { b.y = destY; } }
        }

        if(gameState !== "CHAT") {
            let pX = Math.floor(cameraGroup.position.x / CHUNK_SIZE), pZ = Math.floor(cameraGroup.position.z / CHUNK_SIZE);
            for(let x = pX - RENDER_DIST; x <= pX + RENDER_DIST; x++) { for(let z = pZ - RENDER_DIST; z <= pZ + RENDER_DIST; z++) { let cKey = `${x},${z}`; if(!chunks.has(cKey)) { gameplayChunkQueue.push({x, z}); chunks.set(cKey, true); } } }

            let dir = new THREE.Vector3(); cam.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 0.0001) { dir.set(0, 0, -1); } dir.normalize(); 
            let side = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), dir).normalize();
            
            let isSpectator = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'SPECTATOR';
            let isCreative = savedWorlds[activeWorldId] && (savedWorlds[activeWorldId].mode === 'CREATIVE' || savedWorlds[activeWorldId].mode === 'SPECTATOR');
            if(!isCreative) player.flying = false;

            let isMoving = (keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD']); 
            let canSprint = player.food > 3 || isCreative; let isSprinting = (keys['ShiftLeft'] || keys['ShiftRight'] || keys['ControlLeft'] || keys['ControlRight']) && keys['KeyW'] && canSprint;
            cam.fov = THREE.MathUtils.lerp(cam.fov, isSprinting ? optFov+10 : optFov, 0.1); cam.updateProjectionMatrix();
            let accel = isSprinting ? 0.014 : 0.011; if(player.flying) accel *= 2; let friction = player.flying ? 0.9 : 0.85; pVel.x *= friction; pVel.z *= friction; 
            if(keys['KeyW']) { pVel.x += dir.x * accel; pVel.z += dir.z * accel; } if(keys['KeyS']) { pVel.x -= dir.x * accel; pVel.z -= dir.z * accel; }
            if(keys['KeyA']) { pVel.x += side.x * accel; pVel.z += side.z * accel; } if(keys['KeyD']) { pVel.x -= side.x * accel; pVel.z -= side.z * accel; }

            let px = cameraGroup.position.x, pz = cameraGroup.position.z; let footY = Math.round(cameraGroup.position.y - 1.5), headY = Math.round(cameraGroup.position.y - 0.5); let margin = 0.4; 
            
            if (isSpectator) {
                cameraGroup.position.x += pVel.x; cameraGroup.position.z += pVel.z;
                if(keys['Space']) cameraGroup.position.y += 0.4; if(keys['ShiftLeft']) cameraGroup.position.y -= 0.4; yVel = 0;
            } else if (player.flying) {
                if(!isSolidVoxel(Math.round(px + pVel.x + Math.sign(pVel.x)*margin), footY, Math.round(pz)) && !isSolidVoxel(Math.round(px + pVel.x + Math.sign(pVel.x)*margin), headY, Math.round(pz))) cameraGroup.position.x += pVel.x; else pVel.x = 0;
                if(!isSolidVoxel(Math.round(px), footY, Math.round(pz + pVel.z + Math.sign(pVel.z)*margin)) && !isSolidVoxel(Math.round(px), headY, Math.round(pz + pVel.z + Math.sign(pVel.z)*margin))) cameraGroup.position.z += pVel.z; else pVel.z = 0;
                if(keys['Space']) { if(!isSolidVoxel(Math.round(px), headY+1, Math.round(pz))) cameraGroup.position.y += 0.2; } if(keys['ShiftLeft']) { if(!isSolidVoxel(Math.round(px), footY-1, Math.round(pz))) cameraGroup.position.y -= 0.2; } yVel = 0;
            } else {
                if(!isSolidVoxel(Math.round(px + pVel.x + Math.sign(pVel.x)*margin), footY, Math.round(pz)) && !isSolidVoxel(Math.round(px + pVel.x + Math.sign(pVel.x)*margin), headY, Math.round(pz))) cameraGroup.position.x += pVel.x; else pVel.x = 0;
                if(!isSolidVoxel(Math.round(px), footY, Math.round(pz + pVel.z + Math.sign(pVel.z)*margin)) && !isSolidVoxel(Math.round(px), headY, Math.round(pz + pVel.z + Math.sign(pVel.z)*margin))) cameraGroup.position.z += pVel.z; else pVel.z = 0;
                yVel -= 0.01; let nextY = cameraGroup.position.y + yVel;
                if(yVel <= 0 && isSolidVoxel(Math.round(cameraGroup.position.x), Math.round(nextY - 1.6), Math.round(cameraGroup.position.z))) { 
                    let landY = Math.round(nextY - 1.6);
                    if(highestY - cameraGroup.position.y > 3) { let fallDist = Math.floor(highestY - cameraGroup.position.y) - 3; applyDamage(fallDist, "fell from a high place"); }
                    highestY = cameraGroup.position.y;
                    if (yVel < -0.1) { 
                        let landKey = `${Math.round(cameraGroup.position.x)},${landY},${Math.round(cameraGroup.position.z)}`; let topKey = `${Math.round(cameraGroup.position.x)},${landY+1},${Math.round(cameraGroup.position.z)}`;
                        let topT = voxels.get(topKey);
                        if(topT === 'seeds' || topT === 'wheat') { removeB(Math.round(cameraGroup.position.x), landY+1, Math.round(cameraGroup.position.z)); dropItemIntoWorld(topT, 1, 0); playSound('dig', 'grass'); }
                        else if (voxels.get(landKey) === 'farmland' && Math.random() < 0.5) { removeB(Math.round(cameraGroup.position.x), landY, Math.round(cameraGroup.position.z)); placeB(Math.round(cameraGroup.position.x), landY, Math.round(cameraGroup.position.z), 'dirt'); playSound('dig', 'dirt'); } 
                    }
                    yVel = 0; cameraGroup.position.y = landY + 2.1; if(keys['Space']) yVel = 0.16; 
                } else if (yVel > 0 && isSolidVoxel(Math.round(cameraGroup.position.x), Math.round(nextY), Math.round(cameraGroup.position.z))) { yVel = 0; cameraGroup.position.y = Math.round(nextY) - 0.75; 
                } else { cameraGroup.position.y = nextY; if(yVel > 0) highestY = cameraGroup.position.y; }
            }

            let cxInt = Math.round(cameraGroup.position.x), cyInt = Math.round(cameraGroup.position.y - 1.6), czInt = Math.round(cameraGroup.position.z);
            let footBlock = voxels.get(`${cxInt},${cyInt},${czInt}`); if(footBlock === 'cactus' && globalTick % 10 === 0) { applyDamage(1, "was pricked to death"); }
            
            let headBlock = voxels.get(`${cxInt},${cyInt+1},${czInt}`);
            if(isSolidVoxel(cxInt, cyInt+1, czInt) && !isSpectator) { document.getElementById('vhs-scanlines').style.background = 'black'; if(globalTick % 20 === 0) applyDamage(1, "suffocated in a wall"); } else { document.getElementById('vhs-scanlines').style.background = 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.5) 50%)'; }

            if(cameraGroup.position.y < -65) { if(globalTick % 20 === 0) applyDamage(4, "fell out of the world"); }
            cam.position.y = 0;

            if(!isSpectator && !player.flying && isSolidVoxel(Math.round(cameraGroup.position.x), Math.round(cameraGroup.position.y - 1.6), Math.round(cameraGroup.position.z)) && isMoving && gameState === "PLAYING") {
                let speed = Math.sqrt(pVel.x*pVel.x + pVel.z*pVel.z); stepTimer += speed; 
                if(stepTimer > (isSprinting ? 0.7 : 0.5)) { let bName = voxels.get(`${Math.round(cameraGroup.position.x)},${Math.round(cameraGroup.position.y - 1.6)},${Math.round(cameraGroup.position.z)}`); playSound('step', bName || 'grass'); stepTimer = 0; player.exhaustion += isSprinting ? 0.1 : 0.01; }
            } else { stepTimer = 0; }

            if(!isCreative && !isSpectator) {
                if(player.exhaustion >= 4.0) { player.exhaustion -= 4.0; if(player.saturation > 0) player.saturation = Math.max(0, player.saturation - 1); else player.food = Math.max(0, player.food - 1); updateUI(); }
                if(player.food >= 18 && player.hp < 20 && globalTick % 80 === 0) { player.hp++; player.exhaustion += 6.0; updateUI(); }
                if(player.food <= 0 && globalTick % 80 === 0 && player.hp > 1) { applyDamage(1, "starved to death"); }
            }

            drops.forEach((d, i) => {
                d.velY -= 0.01; d.mesh.position.y += d.velY;
                if(d.velDir) { d.mesh.position.x += d.velDir.x; d.mesh.position.z += d.velDir.z; d.velDir.multiplyScalar(0.9); }
                let floorType = voxels.get(`${Math.round(d.mesh.position.x)},${Math.floor(d.mesh.position.y - 0.2)},${Math.round(d.mesh.position.z)}`);
                if(isSolidVoxel(Math.round(d.mesh.position.x), Math.floor(d.mesh.position.y - 0.2), Math.round(d.mesh.position.z))) { 
                    if (!transparentBlocks.includes(floorType)) { d.velY = 0; d.mesh.position.y = Math.floor(d.mesh.position.y-0.2) + 0.65; d.velDir.x=0; d.velDir.z=0; }
                }
                if(!d.is2D) { d.mesh.rotation.y += 0.03; d.mesh.rotation.x += 0.01; } else { d.mesh.rotation.y += 0.05; }
                let pFeet = cameraGroup.position.clone(); pFeet.y -= 1.5;
                if(Date.now() - d.spawnTime > 1500 && pFeet.distanceTo(d.mesh.position) < 2.5 && !player.dead) { d.mesh.position.lerp(pFeet, 0.25); if(pFeet.distanceTo(d.mesh.position) < 0.7) { playSound('click'); sc.remove(d.mesh); drops.splice(i, 1); addToInventory(d.type, 1, d.damage); } }
            });

            if(miningTarget && gameState === "PLAYING" && !player.dead) {
                let activeItem = inventory[activeSlot]; let activeType = activeItem.type; 
                let lookDir = new THREE.Vector3(); cam.getWorldDirection(lookDir); lookDir.normalize(); let hit = fastVoxelRaycast(cameraGroup.position, lookDir, 6);
                if(!hit || hit.x !== miningTarget.x || hit.y !== miningTarget.y || hit.z !== miningTarget.z) { 
                    miningTarget = null; crackMesh.visible = false; redstoneGlow.visible = false;
                } else {
                    let name = miningTarget.name; if (name === 'redstone_ore') { redstoneGlow.position.set(miningTarget.x, miningTarget.y, miningTarget.z); redstoneGlow.visible = true; } else { redstoneGlow.visible = false; }
                    let baseHardness = 1.0; let isCorrectTool = false; let toolSpeed = 1.0; let canHarvest = false;
                    let activeSafeType = activeType || ''; let toolClass = 'hand';
                    if (activeSafeType.endsWith('_pickaxe')) toolClass = 'pickaxe'; if (activeSafeType.endsWith('_axe')) toolClass = 'axe'; if (activeSafeType.endsWith('_shovel')) toolClass = 'shovel'; if (activeSafeType.endsWith('_sword')) toolClass = 'sword'; if (activeSafeType.endsWith('_hoe')) toolClass = 'hoe';
                    if (activeSafeType.startsWith('wooden_')) toolSpeed = 2.0; if (activeSafeType.startsWith('stone_')) toolSpeed = 4.0; if (activeSafeType.startsWith('iron_')) toolSpeed = 6.0; if (activeSafeType.startsWith('diamond_')) toolSpeed = 8.0; if (activeSafeType.startsWith('golden_')) toolSpeed = 12.0; 

                    if (['stone', 'cobblestone', 'furnace'].includes(name)) { baseHardness = 1.5; if (toolClass === 'pickaxe') isCorrectTool = true; canHarvest = isCorrectTool; } 
                    else if (['coal_ore'].includes(name)) { baseHardness = 3.0; if (toolClass === 'pickaxe') isCorrectTool = true; canHarvest = isCorrectTool; } 
                    else if (['iron_ore', 'lapis_ore'].includes(name)) { baseHardness = 3.0; if (toolClass === 'pickaxe') { isCorrectTool = true; canHarvest = (activeSafeType.startsWith('stone_') || activeSafeType.startsWith('iron_') || activeSafeType.startsWith('diamond_')); } } 
                    else if (['gold_ore', 'redstone_ore'].includes(name)) { baseHardness = 3.0; if (toolClass === 'pickaxe') { isCorrectTool = true; canHarvest = (activeSafeType.startsWith('iron_') || activeSafeType.startsWith('diamond_')); } } 
                    else if (['diamond_ore', 'emerald_ore'].includes(name)) { baseHardness = 5.0; if (toolClass === 'pickaxe') { isCorrectTool = true; canHarvest = (activeSafeType.startsWith('iron_') || activeSafeType.startsWith('diamond_')); } } 
                    else if (['diamond_block', 'emerald_block'].includes(name)) { baseHardness = 25.0; if (toolClass === 'pickaxe') { isCorrectTool = true; canHarvest = (activeSafeType.startsWith('iron_') || activeSafeType.startsWith('diamond_')); } } 
                    else if (name.endsWith('_block')) { baseHardness = 5.0; if (toolClass === 'pickaxe') { isCorrectTool = true; canHarvest = activeSafeType !== 'wooden_pickaxe'; } } 
                    else if (['dirt', 'grass', 'farmland', 'sand', 'gravel'].includes(name)) { baseHardness = 0.5; if (toolClass === 'shovel') isCorrectTool = true; canHarvest = true; } 
                    else if (['oak_log', 'birch_log', 'oak_planks', 'birch_planks', 'crafting_table', 'chest'].includes(name)) { baseHardness = 1.0; if (toolClass === 'axe') isCorrectTool = true; canHarvest = true; } 
                    else if (name.endsWith('_leaves') || name === 'wheat') { baseHardness = 0.2; if (toolClass === 'hoe' || toolClass === 'sword') isCorrectTool = true; canHarvest = true; if (toolClass === 'sword') toolSpeed = 1.5; } 
                    else if (['torch', 'oak_sapling', 'birch_sapling', 'dead_bush', 'short_grass', 'dandelion', 'rose', 'seeds'].includes(name)) { baseHardness = 0.0; canHarvest = true; isCorrectTool = true; } 
                    else if (name === 'cactus') { baseHardness = 0.4; canHarvest = true; } else if (name === 'bedrock') { baseHardness = 9999; canHarvest = isCreative; }

                    let timeToMine;
                    if(isCreative) { timeToMine = 0; } else { timeToMine = isCorrectTool ? ((baseHardness * 1.5) / toolSpeed) : (baseHardness * 1.5); if (!isCorrectTool && toolClass !== 'hand' && ['stone', 'cobblestone', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'lapis_ore', 'redstone_ore', 'emerald_ore', 'furnace'].includes(name)) timeToMine = baseHardness * 5.0; if (baseHardness === 0.0) timeToMine = 0.05; }
                    let damagePerTick = isCreative ? 10.0 : (1.0 / (timeToMine * 60.0));
                    miningProgress += damagePerTick; miningSoundTimer += damagePerTick;
                    if(miningSoundTimer > 0.4 && !isCreative) { playSound('dig', name); miningSoundTimer = 0; }
                    
                    let stage = Math.floor((miningProgress) * 10);
                    if(stage >= 10) {
                        playSound('break', name); removeB(miningTarget.x, miningTarget.y, miningTarget.z); redstoneGlow.visible = false; player.exhaustion += 0.005;
                        if (!isCreative && ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'].includes(toolClass) && activeSafeType !== '') {
                            let dmgToTake = 1; if (toolClass === 'sword' && !name.endsWith('_leaves')) dmgToTake = 2; 
                            activeItem.damage = (activeItem.damage || 0) + dmgToTake;
                            let maxD = activeSafeType.startsWith('diamond_') ? 1561 : activeSafeType.startsWith('iron_') ? 250 : (activeSafeType.startsWith('stone_') ? 131 : (activeSafeType.startsWith('golden_') ? 32 : 59));
                            if (activeItem.damage >= maxD) { playSound('tool_break'); inventory[activeSlot] = {type: null, count: 0, damage: 0}; }
                            updateUI();
                        }
                        if(!isCreative && !name.endsWith('_leaves')) {
                            let dropName = name === 'stone' ? 'cobblestone' : (name === 'grass' || name === 'farmland' ? 'dirt' : (name === 'coal_ore' ? 'coal' : (name === 'iron_ore' ? 'raw_iron' : (name === 'gold_ore' ? 'raw_gold' : (name === 'diamond_ore' ? 'diamond' : (name === 'emerald_ore' ? 'emerald' : (name === 'dead_bush' || name === 'short_grass' ? 'stick' : name)))))));
                            let dropCount = 1;
                            if (name === 'lapis_ore') { dropName = 'lapis_lazuli'; dropCount = Math.floor(Math.random()*5)+4; }
                            if (name === 'redstone_ore') { dropName = 'redstone'; dropCount = Math.floor(Math.random()*2)+4; }
                            if (name === 'dead_bush') { dropCount = Math.floor(Math.random()*3); }
                            if (name === 'short_grass') { if(Math.random()<0.1) { dropName='seeds'; dropCount=1; } else dropName=null; }
                            if (name === 'wheat') { dropName = 'wheat'; dropCount=1; dropItemIntoWorld('seeds', Math.floor(Math.random()*3), 0); }
                            if (!canHarvest) dropName = null; 
                            if(dropName && dropCount > 0) { 
                                dropItemIntoWorld(dropName, dropCount, 0); 
                                for(let i=0; i<dropCount; i++) {
                                    let dObj = drops[drops.length-1-i]; dObj.mesh.position.set(miningTarget.x, miningTarget.y, miningTarget.z); 
                                    dObj.velDir = new THREE.Vector3().subVectors(cameraGroup.position, dObj.mesh.position).normalize().multiplyScalar(0.1); dObj.velY = 0.1; dObj.spawnTime = Date.now() - 1500; 
                                }
                            }
                        } miningTarget = null; crackMesh.visible = false;
                    } else { crackMesh.material = crackMats[Math.min(stage, 9)]; }
                }
            }
        }
    } else { if(gameState === "MAIN_MENU") targetRotation.y += 0.002; }
    rnd.render(sc, cam);
}

document.addEventListener('keydown', e => {
    if(gameState !== "CHAT") keys[e.code] = true;
    if(e.code === 'KeyE') { if(gameState === "CREATIVE" && document.activeElement === document.getElementById('c-search-input')) return; playSound('click'); if(gameState === "INV" || gameState === "CRAFTING" || gameState === "FURNACE" || gameState === "CREATIVE" || gameState === "CHEST") setMenu('PLAYING'); else if(gameState === "PLAYING") setMenu('INV'); }
    if(e.code === 'KeyL' && gameState === "PLAYING" && !player.dead) { playSound('click'); setMenu('ADVANCEMENTS'); }
    if(e.code === 'KeyT' && gameState === "PLAYING" && !player.dead) { e.preventDefault(); keys['KeyT'] = false; setMenu('CHAT'); }
    if(e.code === 'Slash' && gameState === "PLAYING" && !player.dead) { e.preventDefault(); keys['Slash'] = false; setMenu('CHAT'); document.getElementById('chat-input').value = '/'; }
    if(e.code === 'Enter' && gameState === "CHAT") {
        let v = document.getElementById('chat-input').value.trim();
        if(v) { if(v.startsWith('/')) processCommand(v); else addChatMessage("&lt;Player&gt; " + v); }
        document.getElementById('chat-input').value = ''; document.getElementById('chat-suggestions').style.display = 'none'; setMenu('PLAYING');
    }
    if(e.code === 'Escape' && gameState === "CHAT") { document.getElementById('chat-input').value = ''; document.getElementById('chat-suggestions').style.display = 'none'; setMenu('PLAYING'); }
    if(e.key >= '1' && e.key <= '9' && gameState !== "CHAT") { activeSlot = parseInt(e.key) - 1; updateUI(); }
    if(e.code === 'KeyQ' && gameState === "PLAYING" && !player.dead) { let slot = inventory[activeSlot]; if(slot.type && slot.count > 0) { let dropAmount = e.ctrlKey ? slot.count : 1; slot.count -= dropAmount; let type = slot.type; let dmg = slot.damage; if(slot.count <= 0) { slot.type = null; slot.damage = 0; } updateUI(); dropItemIntoWorld(type, dropAmount, dmg); } }
    if(e.code === 'Space' && gameState === "PLAYING" && !player.dead && savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'CREATIVE') { let now = Date.now(); if(now - lastSpacePress < 300) { player.flying = !player.flying; } lastSpacePress = now; }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('mousedown', e => {
    initAudio(); if(!isPlayingMusic && gameState === "PLAYING") playMusic(); if(gameState !== "PLAYING" || player.dead) return;
    let dir = new THREE.Vector3(); cam.getWorldDirection(dir); dir.normalize(); let hit = fastVoxelRaycast(cameraGroup.position, dir, 6);
    let isAdventure = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'ADVENTURE';
    let isSpectator = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'SPECTATOR';
    let isCreative = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'CREATIVE';

    if(hit) {
        let item = inventory[activeSlot];
        if(e.button === 2 && item.type && item.type.endsWith('_hoe') && (hit.name === 'dirt' || hit.name === 'grass') && hit.normal.y === 1 && !isAdventure && !isSpectator) {
            let topKey = `${hit.x},${hit.y+1},${hit.z}`;
            if(!voxels.has(topKey) || voxels.get(topKey) === 'AIR') {
                removeB(hit.x, hit.y, hit.z); placeB(hit.x, hit.y, hit.z, 'farmland'); playSound('dig', 'dirt');
                item.damage++; let maxD = item.type.startsWith('diamond_') ? 1561 : item.type.startsWith('iron_') ? 250 : (item.type.startsWith('stone_') ? 131 : (item.type.startsWith('golden_') ? 32 : 59)); if (item.damage >= maxD) { playSound('tool_break'); inventory[activeSlot] = {type: null, count: 0, damage: 0}; }
                updateUI(); return;
            }
        }

        if(e.button === 0 && !isAdventure && !isSpectator) { miningTarget = {x: hit.x, y: hit.y, z: hit.z, name: hit.name}; miningProgress = 0; miningSoundTimer = 0; crackMesh.position.set(hit.x, hit.y, hit.z); crackMesh.visible = true; }
        else if(e.button === 2 && !isSpectator) {
            if(hit.name === 'crafting_table') { setMenu('CRAFTING'); return; }
            if(hit.name === 'furnace') { activeFurnacePos = `${hit.x},${hit.y},${hit.z}`; setMenu('FURNACE'); return; }
            if(hit.name === 'chest') { activeChestPos = `${hit.x},${hit.y},${hit.z}`; setMenu('CHEST'); return; }
            if(item.type === 'apple' && player.food < 20) { playSound('eat'); player.food = Math.min(20, player.food + 4); player.saturation = Math.min(20, player.saturation + 2.4); if(!isCreative) item.count--; if(item.count<=0) item.type=null; updateUI(); return; }
            if((transparentBlocks.includes(item.type) && item.type !== 'torch' && !item.type.endsWith('_leaves')) && hit.normal.y !== 1) return;
            if(item.type === 'torch' && hit.normal.y === -1) return;
            if((item.type?.endsWith('_sapling') || item.type === 'dead_bush' || item.type === 'short_grass' || item.type === 'dandelion' || item.type === 'rose') && hit.name !== 'grass' && hit.name !== 'dirt' && hit.name !== 'sand') return;
            if(item.type === 'seeds' && hit.name !== 'farmland') return;

            if(!isAdventure && item.type && item.count > 0 && item.type !== 'stick' && item.type !== 'charcoal' && item.type !== 'coal' && !item.type.endsWith('_ingot') && !item.type.startsWith('raw_') && item.type !== 'diamond' && item.type !== 'lapis_lazuli' && item.type !== 'emerald' && item.type !== 'redstone' && item.type !== 'apple' && !item.type.endsWith('_pickaxe') && !item.type.endsWith('_axe') && !item.type.endsWith('_shovel') && !item.type.endsWith('_sword') && !item.type.endsWith('_hoe')) { 
                let pX = hit.x + hit.normal.x, pY = hit.y + hit.normal.y, pZ = hit.z + hit.normal.z;
                let dx = pX - cameraGroup.position.x, dy = pY - (cameraGroup.position.y - 1.6), dz = pZ - cameraGroup.position.z; let overlapY = (cameraGroup.position.y - 1.6) < (pY + 0.5) && (cameraGroup.position.y - 0.1) > (pY - 0.5);
                let insidePlayer = (Math.abs(dx) < 0.35 && Math.abs(dz) < 0.35 && overlapY);

                if((!voxels.has(`${pX},${pY},${pZ}`) || voxels.get(`${pX},${pY},${pZ}`) === 'AIR') && (!insidePlayer || transparentBlocks.includes(item.type))) { 
                    playSound('place', item.type); placeB(pX, pY, pZ, item.type, hit.normal); 
                    if(!isCreative) item.count--; 
                    let underKey = `${pX},${pY-1},${pZ}`; if(voxels.get(underKey) === 'grass' && item.type !== 'seeds') { removeB(pX, pY-1, pZ); placeB(pX, pY-1, pZ, 'dirt'); }
                    updateUI(); 
                }
            }
        }
    } else {
        let item = inventory[activeSlot];
        if(e.button === 2 && item.type === 'apple' && player.food < 20 && !isSpectator) { playSound('eat'); player.food = Math.min(20, player.food + 4); player.saturation = Math.min(20, player.saturation + 2.4); if(!isCreative) item.count--; if(item.count<=0) item.type=null; updateUI(); return; }
    }
});
document.addEventListener('mouseup', () => { miningTarget = null; crackMesh.visible = false; redstoneGlow.visible = false; });

document.getElementById('splash-text').innerText = authenticSplashes[Math.floor(Math.random() * authenticSplashes.length)]; updateUI(); animate();
