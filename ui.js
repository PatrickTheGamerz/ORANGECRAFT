let inventory = Array(36).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let crafting2x2 = Array(4).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let crafting3x3 = Array(9).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let activeSlot = 0, dragItem = null, gameState = "MAIN_MENU", drops = [];
let miningTarget = null, miningProgress = 0, miningSoundTimer = 0;
let activeChestPos = null, activeFurnacePos = null;

let chatLog = [];
function addChatMessage(msg, color="white") {
    chatLog.push({msg: `<span style="color:${color}">${msg}</span>`, time: Date.now()});
    if(chatLog.length > 20) chatLog.shift();
    updateChatDOM();
}

function updateChatDOM() {
    let logEl = document.getElementById('chat-log');
    let html = ''; let now = Date.now();
    chatLog.forEach(c => { let diff = now - c.time; let op = diff < 5000 ? 1 : Math.max(0, 1 - (diff-5000)/2000); if(gameState === "CHAT") op = 1; if(op > 0) html += `<div style="opacity:${op}">${c.msg}</div>`; });
    logEl.innerHTML = html; logEl.scrollTop = logEl.scrollHeight;
}

function processCommand(cmd) {
    addChatMessage(cmd, "#aaa");
    if(savedWorlds[activeWorldId] && !savedWorlds[activeWorldId].cheats) { addChatMessage("Cheats are disabled on this level.", "red"); return; }
    let args = cmd.toLowerCase().split(' ');
    if(args[0] === '/gamemode') {
        let m = args[1]; if(m==='0'||m==='s') m='survival'; if(m==='1'||m==='c') m='creative'; if(m==='2'||m==='a') m='adventure'; if(m==='3'||m==='sp') m='spectator';
        if(['survival','creative','spectator','adventure'].includes(m)) { savedWorlds[activeWorldId].mode = m.toUpperCase(); addChatMessage(`Set own game mode to ${m.charAt(0).toUpperCase() + m.slice(1)}`, "#aaa"); } else { addChatMessage(`Unknown game mode: ${args[1]}`, "red"); }
    } else if (args[0] === '/gamerule') {
        if(args[1] === 'keepinventory') { if(args[2] === 'true') { gamerules.keepInventory = true; addChatMessage("Game rule keepInventory updated to true", "#aaa"); } else if (args[2] === 'false') { gamerules.keepInventory = false; addChatMessage("Game rule keepInventory updated to false", "#aaa"); } }
    } else if (args[0] === '/kill') { player.hp = 0; addChatMessage("Player fell out of the world", "#aaa");
    } else if (args[0] === '/help') { addChatMessage(`Commands: /gamemode <mode>, /gamerule keepInventory <true|false>, /kill`, "yellow");
    } else { addChatMessage(`Unknown command: ${args[0]}.`, "red"); }
}

const commandList = ['/gamemode survival', '/gamemode creative', '/gamemode spectator', '/gamemode adventure', '/gamerule keepInventory true', '/gamerule keepInventory false', '/kill', '/help', '@a', '@e', '@p', '@r', '@s'];
document.getElementById('chat-input').addEventListener('input', (e) => {
    let val = e.target.value; let suggBox = document.getElementById('chat-suggestions');
    if(val.startsWith('/') || val.includes('@')) {
        let parts = val.split(' '); let last = parts[parts.length-1];
        let matches = commandList.filter(c => c.startsWith(last));
        if(matches.length > 0) { suggBox.style.display = 'flex'; suggBox.innerHTML = matches.map(m => `<div class="chat-sugg" onclick="let parts=document.getElementById('chat-input').value.split(' '); parts.pop(); document.getElementById('chat-input').value=parts.join(' ')+(parts.length>0?' ':'')+ '${m}'; document.getElementById('chat-suggestions').style.display='none'; document.getElementById('chat-input').focus();">${m}</div>`).join(''); } else { suggBox.style.display = 'none'; }
    } else { suggBox.style.display = 'none'; }
});

let advScreen = document.createElement('div'); advScreen.id = 'advancements-screen'; advScreen.className = 'menu-overlay'; advScreen.innerHTML = '<div class="inv-container" style="width:600px; height:400px;"><div style="font-size:24px; font-weight:bold; margin-bottom:20px;">Advancements</div><div id="adv-list" style="display:flex; flex-direction:column; gap:10px; overflow-y:auto; height:100%;"></div><div class="btn" style="align-self:center; margin-top:20px;" onclick="setMenu(\'PLAYING\')">Done</div></div>'; document.body.appendChild(advScreen);

function checkAchievement(id) {
    let isCreative = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'CREATIVE';
    let isCheats = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].cheats;
    if (isCreative || isCheats || achievements[id]) return;
    achievements[id] = true;
    let names = {'wood': 'Getting Wood', 'stone': 'Time to Mine!', 'iron': 'Acquire Hardware', 'diamond': 'DIAMONDS!', 'stone_age': 'Stone Age'};
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
    let is2D = (type === 'stick' || type === 'charcoal' || type === 'coal' || type.endsWith('_ingot') || type.startsWith('raw_') || type === 'diamond' || type === 'emerald' || type === 'lapis_lazuli' || type === 'redstone' || type === 'torch' || type === 'apple' || transparentBlocks.includes(type) || type === 'chest' || type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe'));
    if(is2D) { let cacheKey = (type==='chest'?'chest_item':type) + '_' + dmgLevel + suf; html = `<div class="item-2d" style="background-image:url(${imgDataUrls[cacheKey]})"></div>`; }
    else { let top = type.endsWith('_log') ? type.replace('log','top') : (type === 'crafting_table' ? 'ctTop' : (type === 'grass' ? 'grass' : (type === 'farmland' ? 'farmlandTop' : (type === 'furnace' ? 'furnaceTop' : type)))); let side = type === 'crafting_table' ? 'ctSide' : (type === 'grass' ? 'grassSide' : (type === 'farmland' ? 'dirt' : (type === 'furnace' ? 'furnaceFront' : type))); html = `<div class="item-3d"><div class="face top" style="background-image:url(${imgDataUrls[top+'_0'+suf]})"></div><div class="face right" style="background-image:url(${imgDataUrls[side+'_0'+suf]})"></div><div class="face front" style="background-image:url(${imgDataUrls[side+'_0'+suf]})"></div></div>`; }
    if(type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe')) { let maxD = type.startsWith('diamond_') ? 1561 : type.startsWith('iron_') ? 250 : (type.startsWith('stone_') ? 131 : (type.startsWith('golden_') ? 32 : 59)); if (damage > 0) { let pct = (maxD - damage) / maxD; let color = pct > 0.5 ? '#0f0' : (pct > 0.2 ? '#fa0' : '#f00'); html += `<div style="position:absolute;bottom:2px;left:4px;width:28px;height:4px;background:#000;border:1px solid #222;box-sizing:border-box;"><div style="width:${pct*100}%;height:100%;background:${color};"></div></div>`; } }
    return html;
}

function addToInventory(type, amount, damage=0) {
    let maxStack = (type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe')) ? 1 : 64;
    for(let i=0; i<36; i++) { if(inventory[i].type === type && inventory[i].count < maxStack) { let add = Math.min(maxStack - inventory[i].count, amount); inventory[i].count += add; amount -= add; if(amount <= 0) break; } }
    if(amount > 0) { for(let i=0; i<36; i++) { if(!inventory[i].type) { inventory[i].type = type; inventory[i].count = amount; inventory[i].damage = damage; amount = 0; break; } } }
    if(type.endsWith('_log')) checkAchievement('wood'); if(type === 'cobblestone') checkAchievement('stone'); if(type === 'iron_ingot') checkAchievement('iron'); if(type === 'diamond') checkAchievement('diamond'); if(type.startsWith('stone_')) checkAchievement('stone_age');
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
    if(i < 9) { hInv.appendChild(slot); ctHInv.appendChild(slot2); fHInv.appendChild(slot3); crHInv.appendChild(slot4); chHInv.appendChild(slot5); let hs = document.createElement('div'); hs.className = 'slot' + (i === activeSlot ? ' active' : ''); if(item.type) { hs.innerHTML = getIconHTML(item.type, item.damage) + (item.count > 1 ? `<span class="item-count">${item.count}</span>` : ''); } hDisp.appendChild(hs); } else { mInv.appendChild(slot); ctMInv.appendChild(slot2); fMInv.appendChild(slot3); chMInv.appendChild(slot5); }
  });
  Array.from(cGrid2.children).forEach((slot, i) => { if(crafting2x2[i].count <= 0) { crafting2x2[i].type = null; crafting2x2[i].count = 0; } updateSlotDOM(slot, crafting2x2[i]); slot.onmousedown = (e) => handleSlotAction(crafting2x2, i, e); });
  Array.from(cGrid3.children).forEach((slot, i) => { if(crafting3x3[i].count <= 0) { crafting3x3[i].type = null; crafting3x3[i].count = 0; } updateSlotDOM(slot, crafting3x3[i]); slot.onmousedown = (e) => handleSlotAction(crafting3x3, i, e); });
  checkRecipes();

  if(gameState === "CREATIVE") {
      crItemGrid.innerHTML = ''; let itemsToShow = [];
      if(activeCreativeTab === 'search') { let q = document.getElementById('c-search-input').value.toLowerCase(); itemsToShow = [...creativeCategories['blocks'], ...creativeCategories['items']].filter(i => i.replace(/_/g, ' ').includes(q)); }
      else { itemsToShow = creativeCategories[activeCreativeTab]; }
      itemsToShow.forEach(type => {
          let fakeItem = {type: type, count: 1, damage: 0};
          let slot = createSlot(fakeItem, (e) => { playSound('click'); let maxStack = (type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe')) ? 1 : 64; if(!dragItem) { dragItem = {item: {type: type, count: e.ctrlKey?maxStack:1, damage: 0}, source: 'CREATIVE', idx: -1}; document.getElementById('drag-icon').style.display = 'block'; document.getElementById('drag-icon').innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); } });
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
          let fOut = document.getElementById('f-output'); updateSlotDOM(fOut, fd.slots[2]); fOut.onmousedown = (e) => { if(fd.slots[2].type && !dragItem) { playSound('click'); dragItem = {item: {...fd.slots[2]}, source: null, idx: -1}; fd.slots[2].type = null; fd.slots[2].count = 0; document.getElementById('drag-icon').style.display = 'block'; document.getElementById('drag-icon').innerHTML = getIconHTML(dragItem.item.type, dragItem.item.damage); updateUI(); } };
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
    if(isCreative || isSpectator) return;
    let hFull = imgDataUrls['ui_heart_full_0'], hHalf = imgDataUrls['ui_heart_half_0'], hEmpty = imgDataUrls['ui_heart_empty_0'];
    let fFull = imgDataUrls['ui_food_full_0'], fHalf = imgDataUrls['ui_food_half_0'], fEmpty = imgDataUrls['ui_food_empty_0'];
    let drawIcon = (src, x, y) => { let img = new Image(); img.src = src; if(img.complete) ctx.drawImage(img, x, y, 16, 16); else img.onload = () => ctx.drawImage(img, x, y, 16, 16); };
    for(let i=0; i<10; i++) {
        let hX = i * 16, fX = 344 - (i * 16); let y = 20;
        drawIcon(hEmpty, hX, y); if (player.hp > i * 2 + 1) drawIcon(hFull, hX, y); else if (player.hp === i * 2 + 1) drawIcon(hHalf, hX, y);
        drawIcon(fEmpty, fX, y); if (player.food > i * 2 + 1) drawIcon(fFull, fX, y); else if (player.food === i * 2 + 1) drawIcon(fHalf, fX, y);
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
  } updateUI();
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

function saveSettings() {
    appSettings = { fov: optFov, render: optRender, graphics: optGraphics, lighting: optLighting, music: optMusic, packs: isProgrammerArt ? ['programmer_art'] : [] };
    localStorage.setItem('orangecraft_settings', JSON.stringify(appSettings));
    if(isProgrammerArt) document.body.classList.add('prog-art'); else document.body.classList.remove('prog-art');
}
if(isProgrammerArt) { document.getElementById('selected-packs').appendChild(document.getElementById('pack-programmer-art')); document.body.classList.add('prog-art'); }

function loadWorldList() {
    let container = document.getElementById('world-list-container'); container.innerHTML = ''; let keys = Object.keys(savedWorlds);
    if(keys.length === 0) { container.innerHTML = '<div style="color:#aaa; text-align:center; margin-top:20px;">No worlds found. Create one!</div>'; return; }
    keys.forEach(k => {
        let w = savedWorlds[k]; let div = document.createElement('div'); div.className = 'world-item' + (selectedWorldListId === k ? ' selected' : '');
        div.innerHTML = `<div class="world-item-title">${w.name}</div><div class="world-item-desc">${w.type} Mode • ${w.mode} • ${w.diff===1?'Normal':(w.diff===0?'Peaceful':'Hard')}</div>`;
        div.onclick = () => { selectedWorldListId = k; loadWorldList(); }; div.ondblclick = () => { selectedWorldListId = k; playSelectedWorld(); };
        container.appendChild(div);
    });
    if(!selectedWorldListId && keys.length > 0) selectedWorldListId = keys[0];
}

function cycleWorldMode() {
    const modes = ["SURVIVAL", "CREATIVE", "SPECTATOR", "HARDCORE", "ADVENTURE"]; newWorldMode = modes[(modes.indexOf(newWorldMode) + 1) % modes.length]; document.getElementById('btn-world-mode').innerText = "Game Mode: " + newWorldMode.charAt(0) + newWorldMode.slice(1).toLowerCase();
    let desc = "Resources, crafting, gain levels, health and hunger";
    if(newWorldMode === "CREATIVE") desc = "Unlimited resources, free flying and destroy blocks instantly"; if(newWorldMode === "HARDCORE") desc = "Same as survival mode, locked at hardest difficulty, and one life only"; if(newWorldMode === "SPECTATOR") desc = "Look but don't touch, fly through blocks"; if(newWorldMode === "ADVENTURE") desc = "Exploration and interaction only, blocks cannot be broken";
    document.getElementById('mode-desc').innerText = desc;
}
function cycleWorldType() { const types = ["DEFAULT", "SUPERFLAT", "AMPLIFIED"]; newWorldType = types[(types.indexOf(newWorldType) + 1) % types.length]; document.getElementById('btn-world-type').innerText = "World Type: " + newWorldType.charAt(0) + newWorldType.slice(1).toLowerCase(); }
function toggleWorldDiff() { newWorldDiff = 1 - newWorldDiff; document.getElementById('btn-world-diff').innerText = "Difficulty: " + (newWorldDiff ? "Normal" : "Peaceful"); }
function toggleChest() { newWorldChest = !newWorldChest; document.getElementById('btn-world-chest').innerText = "Bonus Chest: " + (newWorldChest ? "ON" : "OFF"); }
function toggleCheats() { newWorldCheats = !newWorldCheats; document.getElementById('btn-world-cheats').innerText = "Allow Cheats: " + (newWorldCheats ? "ON" : "OFF"); }

function createNewWorld() {
    let name = document.getElementById('new-world-name').value.trim() || "New World"; let id = 'world_' + Date.now();
    savedWorlds[id] = { name: name, type: newWorldType, mode: newWorldMode, diff: newWorldMode==='HARDCORE'? 2 : newWorldDiff, chest: newWorldChest, cheats: newWorldCheats || newWorldMode==='CREATIVE', inventory: null, pos: null, modifiedBlocks: {}, chests: {}, playerParams: null, gamerules: {keepInventory: false}, achievements: {} };
    localStorage.setItem('orangecraft_worlds', JSON.stringify(savedWorlds)); selectedWorldListId = id; playSelectedWorld();
}
function deleteSelectedWorld() { if(selectedWorldListId && savedWorlds[selectedWorldListId]) { if(confirm("Are you sure you want to delete this world? This cannot be undone!")) { delete savedWorlds[selectedWorldListId]; localStorage.setItem('orangecraft_worlds', JSON.stringify(savedWorlds)); selectedWorldListId = null; loadWorldList(); } } }

function saveGame() {
    if(activeWorldId && savedWorlds[activeWorldId] && !player.dead) {
        savedWorlds[activeWorldId].inventory = inventory;
        savedWorlds[activeWorldId].pos = { x: cameraGroup.position.x, y: cameraGroup.position.y, z: cameraGroup.position.z, rotX: cam.rotation.x, rotY: targetRotation.y };
        savedWorlds[activeWorldId].modifiedBlocks = modifiedBlocks;
        let savedChests = {}; dynamicBlocks.forEach((v,k)=>{if(v.type==='chest') savedChests[k] = v.slots;});
        savedWorlds[activeWorldId].chests = savedChests; savedWorlds[activeWorldId].playerParams = player; savedWorlds[activeWorldId].gamerules = gamerules; savedWorlds[activeWorldId].achievements = achievements;
        localStorage.setItem('orangecraft_worlds', JSON.stringify(savedWorlds));
    }
}

function startFovDrag(e) { isDraggingFov = true; updateFovDrag(e); }
document.addEventListener('mousemove', e => { if(isDraggingFov) updateFovDrag(e); }); document.addEventListener('mouseup', () => { isDraggingFov = false; });
function updateFovDrag(e) {
    let bg = document.getElementById('fov-slider').getBoundingClientRect(); let pct = Math.max(0, Math.min(1, (e.clientX - bg.left) / bg.width)); optFov = Math.floor(30 + (pct * 80)); 
    document.getElementById('fov-fill').style.width = (pct * 100) + '%'; document.getElementById('fov-handle').style.left = (pct * 100) + '%'; document.getElementById('fov-label').innerText = "FOV: " + (optFov === 110 ? "Quake Pro" : (optFov === 70 ? "Normal" : optFov));
    if(cam) { cam.fov = optFov; cam.updateProjectionMatrix(); }
}
function updateOptionsUI() { let pct = (optFov - 30) / 80; document.getElementById('fov-fill').style.width = (pct * 100) + '%'; document.getElementById('fov-handle').style.left = (pct * 100) + '%'; document.getElementById('fov-label').innerText = "FOV: " + (optFov === 110 ? "Quake Pro" : (optFov === 70 ? "Normal" : optFov)); }
function toggleOptionClass(el) { if(el.innerText.includes('ON') || el.innerText.includes('Fancy') || el.innerText.includes('Max')) { el.innerText = el.innerText.replace('ON', 'OFF').replace('Fancy', 'Fast').replace('Max', 'Off'); el.classList.remove('btn-active'); } else { el.innerText = el.innerText.replace('OFF', 'ON').replace('Fast', 'Fancy').replace('Off', 'Max'); el.classList.add('btn-active'); } }

function setSubMenu(type) {
    let title = "Settings", content = "";
    if(type === 'video') { title = "Video Settings"; content = `<div class="btn btn-half ${optGraphics?'btn-active':''}" onclick="playSound('click'); cycleOpt('graphics', this)">Graphics: ${optGraphics?"Fancy":"Fast"}</div><div class="btn btn-half" onclick="playSound('click'); cycleOpt('render', this)">Render Distance: ${optRender}</div><div class="btn btn-half ${optLighting?'btn-active':''}" onclick="playSound('click'); cycleOpt('lighting', this)">Smooth Lighting: ${optLighting?"Max":"Off"}</div><div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">View Bobbing: ON</div>`; }
    else if (type === 'controls') { title = "Controls"; content = `<div class="btn btn-half" onclick="playSound('click')">Mouse Sensitivity: 100%</div><div class="btn btn-half" onclick="playSound('click'); toggleOptionClass(this)">Invert Mouse: OFF</div><div class="btn btn-half" onclick="playSound('click')">Forward: W</div><div class="btn btn-half" onclick="playSound('click')">Inventory: E</div>`; }
    else if (type === 'language') { title = "Language"; content = `<div style="color:#aaa; text-align:center; width:100%; margin-bottom:10px;">Language selection simulated.</div><div class="btn btn-half btn-active" onclick="playSound('click')">English (US)</div><div class="btn btn-half" onclick="playSound('click')">Pirate Speak</div>`; }
    else if (type === 'skin') { title = "Skin Customization"; content = `<div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Cape: ON</div><div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Jacket: ON</div><div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Left Sleeve: ON</div><div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Right Sleeve: ON</div>`; }
    else if (type === 'chat') { title = "Chat Settings"; content = `<div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Chat: Shown</div><div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Colors: ON</div>`; }
    else if (type === 'music') { title = "Music & Sounds"; content = `<div class="btn btn-half ${optMusic?'btn-active':''}" onclick="playSound('click'); cycleOpt('music', this)">Music: ${optMusic?"ON":"OFF"}</div><div class="btn btn-half btn-active" onclick="playSound('click'); toggleOptionClass(this)">Master Volume: 100%</div>`; }
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
function importPack(e) { let file = e.target.files[0]; if(file) alert("Simulated import successful!\nLoaded: " + file.name); }
function applyTexturePacks() {
    let programmerArtActive = document.getElementById('selected-packs').contains(document.getElementById('pack-programmer-art'));
    if(isProgrammerArt !== programmerArtActive) {
        isProgrammerArt = programmerArtActive; saveSettings();
        for(let k in texCache) delete texCache[k]; for(let k in imgDataUrls) delete imgDataUrls[k];
        for(let [k, c] of chunks.entries()) { c.dirty = true; }
        updateUI(); initPackIcons();
    } setMenu('OPTIONS');
}

function setMenu(s) {
    if(gameState === "INV" || gameState === "CRAFTING" || gameState === "CREATIVE") { let arr = gameState === "INV" ? crafting2x2 : crafting3x3; arr.forEach(c => { if(c.count > 0) { dropItemIntoWorld(c.type, c.count, c.damage); c.count = 0; c.type = null; c.damage = 0; } }); }
    if(gameState === "FURNACE") { activeFurnacePos = null; }
    if(gameState === "CHEST") { if(activeChestPos && dynamicBlocks.get(activeChestPos)) { let ch = dynamicBlocks.get(activeChestPos); if(ch.type === 'chest') { ch.isOpen = false; ch.lid.rotation.x = 0; playSound('click'); } } activeChestPos = null; }
    if(s === "OPTIONS" || s === "TEXTURE_PACKS" || s === "SUB_MENU") { if(gameState === "PAUSE_MENU" || gameState === "PLAYING") previousMenu = "PAUSE_MENU"; else if (gameState !== "OPTIONS" && gameState !== "SUB_MENU" && gameState !== "TEXTURE_PACKS") previousMenu = "MAIN_MENU"; }

    if(s !== "LOADING") {
        gameState = s; document.querySelectorAll('.menu-overlay').forEach(m => m.style.display = 'none'); advScreen.style.display = 'none';
        document.getElementById('hud').style.display = (s === "PLAYING" || s === "INV" || s === "CRAFTING" || s === "FURNACE" || s === "CREATIVE" || s === "CHAT" || s === "CHEST") ? 'block' : 'none';
        document.getElementById('crosshair').style.display = s === "PLAYING" ? 'block' : 'none';
        document.getElementById('chat-container').style.display = (s === "PLAYING" || s === "CHAT") ? 'flex' : 'none';
        document.getElementById('chat-input-wrapper').style.display = s === "CHAT" ? 'block' : 'none';
        
        if(s === "OPTIONS") updateOptionsUI();
        if(s === "PLAYING") { document.body.requestPointerLock(); cam.fov = optFov; cam.updateProjectionMatrix(); }
        else { 
            document.exitPointerLock(); 
            if(s === "CHAT") { setTimeout(()=>document.getElementById('chat-input').focus(), 10); }
            else if(s === "PAUSE_MENU") document.getElementById('pause-menu').style.display = 'flex'; 
            else if(s === "INV") { if(savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'CREATIVE') { document.getElementById('creative-screen').style.display = 'flex'; gameState = "CREATIVE"; } else { document.getElementById('inventory-screen').style.display = 'flex'; } }
            else if(s === "CRAFTING") document.getElementById('crafting-table-screen').style.display = 'flex'; 
            else if (s === "FURNACE") document.getElementById('furnace-screen').style.display = 'flex'; 
            else if (s === "CHEST") { document.getElementById('chest-screen').style.display = 'flex'; if(activeChestPos && dynamicBlocks.get(activeChestPos)) { let ch = dynamicBlocks.get(activeChestPos); if(ch.type === 'chest') { ch.isOpen = true; ch.lid.rotation.x = -Math.PI/4; playSound('click'); } } } 
            else if (s === "ADVANCEMENTS") { advScreen.style.display = 'flex'; let aHtml=''; for(let k in achievements){ if(achievements[k]) aHtml+=`<div style="color:#5f5">[Unlocked] ${formatName(k)}</div>`; else aHtml+=`<div style="color:#888">[Locked] ${formatName(k)}</div>`; } document.getElementById('adv-list').innerHTML=aHtml; }
            else if(s === "MAIN_MENU") document.getElementById('main-menu').style.display = 'flex'; 
            else if(s === "SINGLEPLAYER") document.getElementById('singleplayer-menu').style.display = 'flex'; 
            else if(s === "CREATE_WORLD") document.getElementById('create-world-menu').style.display = 'flex'; 
            else if(s === "MULTIPLAYER") document.getElementById('multiplayer-menu').style.display = 'flex'; 
            else if(s === "TEXTURE_PACKS") document.getElementById('texture-packs-menu').style.display = 'flex'; 
            else if(s === "OPTIONS") document.getElementById('options-menu').style.display = 'flex'; 
            else if(s === "SUB_MENU") document.getElementById('sub-menu').style.display = 'flex'; 
            else if(s === "DEATH") document.getElementById('death-screen').style.display = 'flex';
        }
        if(s !== "CHAT" && s !== "PLAYING") updateUI();
    }
}
