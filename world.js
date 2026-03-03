let savedWorlds = {};
let appSettings = { fov: 75, render: 4, graphics: 1, lighting: 1, music: true, packs: [] };
let achievements = { wood: false, stone: false, iron: false, diamond: false, stone_age: false };

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

let audioCtx = null, reverbNode = null, isPlayingMusic = false;
let texCache = {}; let imgDataUrls = {}; let isDraggingFov = false; let previousMenu = "MAIN_MENU";

const sc = new THREE.Scene(); let skyColor = isProgrammerArt ? 0x88aadd : 0x88BBEB; sc.background = new THREE.Color(skyColor); sc.fog = new THREE.Fog(skyColor, 4, isProgrammerArt? 25 : 30);
const cameraGroup = new THREE.Group(); sc.add(cameraGroup);
const cam = new THREE.PerspectiveCamera(optFov, window.innerWidth/window.innerHeight, 0.1, 1000); cameraGroup.add(cam); 
let targetRotation = new THREE.Euler(0, 0, 0, "YXZ"); cam.rotation.order = "YXZ";

const rnd = new THREE.WebGLRenderer({antialias:false}); rnd.setSize(window.innerWidth, window.innerHeight); 
rnd.shadowMap.enabled = true; rnd.shadowMap.type = THREE.PCFSoftShadowMap; document.body.appendChild(rnd.domElement);

const amb = new THREE.AmbientLight(0xffffff, 0.45); sc.add(amb); 
const sun = new THREE.DirectionalLight(0xffeedd, 0.9); sun.castShadow = true; 
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 250; sun.shadow.bias = -0.0005; sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
sc.add(sun); sc.add(sun.target);

let redstoneGlow = new THREE.PointLight(0xff0000, 1.5, 6, 1.2); sc.add(redstoneGlow); redstoneGlow.visible = false;

const boxG = new THREE.BoxGeometry(1, 1, 1); const voxels = new Map(); const dynamicBlocks = new Map(); const chunks = new Map();
let RENDER_DIST = optRender; const CHUNK_SIZE = 8; const transparentBlocks = ['oak_leaves', 'birch_leaves', 'torch', 'oak_sapling', 'birch_sapling', 'dead_bush', 'short_grass', 'dandelion', 'rose', 'seeds', 'wheat'];

const authenticSplashes = ["Polygons!", "Getting Wood!", "Don't starve!", "Chests added!", "Advancements!", "Now with Wheat!"];

function drawPixelMap(ctx, palette, mapStr) {
    for(let i=0; i<256; i++) { let char = mapStr[i]; if(palette[char]) { ctx.fillStyle = palette[char]; ctx.fillRect(i%16, Math.floor(i/16), 1, 1); } }
}

function getDmgLevel(type, damage) {
    if(!type || (!type.endsWith('_pickaxe') && !type.endsWith('_axe') && !type.endsWith('_shovel') && !type.endsWith('_sword') && !type.endsWith('_hoe'))) return 0;
    let maxD = type.startsWith('diamond_') ? 1561 : type.startsWith('iron_') ? 250 : (type.startsWith('stone_') ? 131 : (type.startsWith('golden_') ? 32 : 59));
    if (damage > maxD * 0.75) return 2; if (damage > maxD * 0.4) return 1; return 0;
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
    } else if (type === 'seeds') {
        drawPixelMap(ctx, {'A':'#e8d47b','B':'#c4ad3d','C':'#695911','_':null}, '________________'+'________________'+'________________'+'________________'+'________________'+'________________'+'________________'+'________________'+'_______BB_______'+'______BCC_______'+'______AA________'+'_____BA_CB______'+'____BCAA_C______'+'____CA_BA_______'+'_____ACA________'+'________________');
    } else if (type === 'wheat') {
        drawPixelMap(ctx, {'Y':'#e8d47b','G':'#63A32E','g':'#2d7a22','_':null}, '________________'+'________________'+'________Y_______'+'_______Y_Y______'+'______Y_G_Y_____'+'_______G_G______'+'______G_g_G_____'+'_____G_G_G______'+'____G_G_g_G_____'+'___G_G___G_G____'+'__G_g_____g_G___'+'___G_______G____'+'__G_________G___'+'_G___________G__'+'G_____________G_'+'g_____________g_');
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
    if((type.endsWith('_leaves') && !isProgrammerArt) || type === 'stick' || type === 'charcoal' || type === 'coal' || type.endsWith('_ingot') || type.startsWith('raw_') || type === 'diamond' || type === 'emerald' || type === 'lapis_lazuli' || type === 'redstone' || type === 'torch' || type === 'apple' || type === 'chest_item' || type.endsWith('_sapling') || type === 'dead_bush' || type === 'short_grass' || type === 'dandelion' || type === 'rose' || type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe') || type.startsWith('ui_') || type === 'seeds' || type === 'wheat') t.transparent = true; 
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
    genTex('ui_heart_full'); genTex('ui_heart_half'); genTex('ui_heart_empty');
    genTex('ui_food_full'); genTex('ui_food_half'); genTex('ui_food_empty');
}
initPackIcons();

const creativeCategories = {
    'blocks': ['stone', 'cobblestone', 'dirt', 'grass', 'sand', 'gravel', 'oak_log', 'birch_log', 'oak_planks', 'birch_planks', 'oak_leaves', 'birch_leaves', 'cactus', 'bedrock', 'coal_ore', 'iron_ore', 'gold_ore', 'lapis_ore', 'redstone_ore', 'diamond_ore', 'emerald_ore', 'coal_block', 'iron_block', 'gold_block', 'lapis_block', 'redstone_block', 'diamond_block', 'emerald_block', 'furnace', 'chest', 'crafting_table', 'torch', 'oak_sapling', 'birch_sapling', 'dead_bush', 'short_grass', 'dandelion', 'rose', 'wheat'],
    'items': ['coal', 'charcoal', 'raw_iron', 'iron_ingot', 'raw_gold', 'gold_ingot', 'lapis_lazuli', 'redstone', 'diamond', 'emerald', 'stick', 'apple', 'seeds', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe', 'diamond_pickaxe', 'wooden_axe', 'stone_axe', 'iron_axe', 'golden_axe', 'diamond_axe', 'wooden_shovel', 'stone_shovel', 'iron_shovel', 'golden_shovel', 'diamond_shovel', 'wooden_sword', 'stone_sword', 'iron_sword', 'golden_sword', 'diamond_sword', 'wooden_hoe', 'stone_hoe', 'iron_hoe', 'golden_hoe', 'diamond_hoe']
};
let activeCreativeTab = 'blocks';

function getBiome(x, z) {
    let n = Math.sin(x*0.01) + Math.cos(z*0.01) + Math.sin(x*0.05 + z*0.05);
    if(n < -0.4) return 'DESERT'; if(n > 0.4) return 'FOREST'; return 'PLAINS';
}

function getSurfaceH(x, z) {
    if(savedWorlds[activeWorldId] && savedWorlds[activeWorldId].type === 'SUPERFLAT') return 0;
    let isAmp = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].type === 'AMPLIFIED';
    let h = Math.sin(x*0.015)*15 + Math.cos(z*0.015)*15; 
    h += Math.sin(x*0.05 + z*0.04)*5; h += Math.sin(x*0.1)*2; 
    if(isAmp) { h *= 3.5; h += Math.sin(x*0.03)*20; }
    return Math.floor(h);
}

function isCaveNoise(x, y, z) {
    if(savedWorlds[activeWorldId] && savedWorlds[activeWorldId].type === 'SUPERFLAT') return false;
    let n1 = Math.sin(x*0.1) + Math.cos(y*0.1) + Math.sin(z*0.1); let n2 = Math.cos(x*0.15) + Math.sin(y*0.15) - Math.cos(z*0.15); let n3 = Math.sin(x*0.05) * Math.sin(y*0.02) * Math.cos(z*0.05);
    return (Math.abs(n1 + n2) < 0.2 || (n3 > 0.1 && Math.abs(n1 + n2) < 0.5)) && y < getSurfaceH(x,z) - 10; 
}
function isSolidVoxel(x, y, z) { let t = voxels.get(`${x},${y},${z}`); return t && !transparentBlocks.includes(t) && t !== 'AIR'; }

class Chunk {
    constructor(cx, cz) { this.cx = cx; this.cz = cz; this.group = new THREE.Group(); sc.add(this.group); this.dirty = true; this.meshes = {}; }
    update() {
        while(this.group.children.length > 0) { let m = this.group.children[0]; this.group.remove(m); if(m.dispose) m.dispose(); }
        this.meshes = {}; let counts = {}; let blocks = [];
        for(let x=0; x<CHUNK_SIZE; x++){
            for(let z=0; z<CHUNK_SIZE; z++){
                let ax = this.cx*CHUNK_SIZE + x; let az = this.cz*CHUNK_SIZE + z;
                for(let y=getSurfaceH(ax,az)+8; y>=-60; y--){
                    let t = voxels.get(`${ax},${y},${az}`);
                    if(t && !transparentBlocks.includes(t) && t !== 'furnace' && t !== 'chest' && t !== 'AIR') {
                        let exposed = false; const adjs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
                        for(let off of adjs) { let nType = voxels.get(`${ax+off[0]},${y+off[1]},${az+off[2]}`); if(!nType || nType === 'AIR' || transparentBlocks.includes(nType)) { exposed = true; break; } }
                        if(exposed) { counts[t] = (counts[t] || 0) + 1; blocks.push({x: ax, y: y, z: az, t: t}); }
                    }
                }
            }
        }
        for(let t in counts) {
            let mat; let em = { emissive: 0x050505 }; 
            if(t.endsWith('_log')){ mat = [new THREE.MeshLambertMaterial({map: genTex(t), ...em}), new THREE.MeshLambertMaterial({map: genTex(t), ...em}), new THREE.MeshLambertMaterial({map: genTex(t.replace('log','top')), ...em}), new THREE.MeshLambertMaterial({map: genTex(t.replace('log','top')), ...em}), new THREE.MeshLambertMaterial({map: genTex(t), ...em}), new THREE.MeshLambertMaterial({map: genTex(t), ...em})]; }
            else if (t === 'crafting_table') { mat = [new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('oak_planks'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em})]; }
            else if (t === 'farmland') { mat = [new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('farmlandTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em})]; }
            else if (t === 'grass') { mat = [new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grass'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em})]; }
            else if (t === 'cactus') { mat = [new THREE.MeshLambertMaterial({map: genTex('cactusSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('cactusSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('cactusTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('cactusTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('cactusSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('cactusSide'), ...em})]; }
            else { mat = new THREE.MeshLambertMaterial({map: genTex(t), transparent: t.endsWith('_leaves')&&!isProgrammerArt, alphaTest: 0.5, ...em}); }
            let im = new THREE.InstancedMesh(boxG, mat, counts[t]); im.castShadow = true; im.receiveShadow = true; this.group.add(im); this.meshes[t] = { mesh: im, idx: 0 };
        }
        let dummy = new THREE.Object3D();
        for(let b of blocks) {
            dummy.position.set(b.x, b.y, b.z); 
            if(b.t === 'cactus') { dummy.scale.set(0.875, 1, 0.875); } else { dummy.scale.set(1,1,1); }
            dummy.updateMatrix(); let minfo = this.meshes[b.t]; minfo.mesh.setMatrixAt(minfo.idx, dummy.matrix); minfo.idx++;
        }
        for(let t in this.meshes) { this.meshes[t].mesh.instanceMatrix.needsUpdate = true; }
        this.dirty = false;
    }
}

function markChunkDirty(ax, az) { let cx = Math.floor(ax / CHUNK_SIZE); let cz = Math.floor(az / CHUNK_SIZE); let k = `${cx},${cz}`; if(chunks.has(k)) chunks.get(k).dirty = true; }

function addDynamicBlock(x, y, z, type, faceNormal=null) {
    let key = `${x},${y},${z}`; let b; let em = { emissive: 0x050505 };
    if (type === 'torch' || type.endsWith('_sapling') || type === 'dead_bush' || type === 'short_grass' || type === 'dandelion' || type === 'rose' || type === 'seeds' || type === 'wheat') {
        b = new THREE.Group(); let tex = genTex(type);
        let mat = new THREE.MeshLambertMaterial({map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, emissive: type==='torch'?0x222222:0x00});
        let p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, type==='torch'?0.6:0.8), mat); p1.rotation.y = Math.PI/4;
        let p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, type==='torch'?0.6:0.8), mat); p2.rotation.y = -Math.PI/4;
        if(type!=='torch'){p1.castShadow = true; p2.castShadow = true;} b.add(p1); b.add(p2);
        let tX = x, tY = y, tZ = z;
        if(faceNormal && type === 'torch') {
            let nx = Math.round(faceNormal.x); let nz = Math.round(faceNormal.z);
            if (nx > 0) { tX -= 0.35; b.rotation.z = -0.3; } else if (nx < 0) { tX += 0.35; b.rotation.z = 0.3; } else if (nz > 0) { tZ -= 0.35; b.rotation.x = 0.3; } else if (nz < 0) { tZ += 0.35; b.rotation.x = -0.3; } else { tY -= 0.2; }
        } else { tY -= (type==='torch'?0.2:0.1); if(type==='seeds'||type==='wheat') tY-=0.2; }
        b.position.set(tX, tY, tZ);
        if(type==='torch'){ let tLight = new THREE.PointLight(0xffcd88, 2.5, 20, 1.2); b.add(tLight); b.light = tLight; } b.type = type;
    } else if (type === 'furnace') {
        let dir = new THREE.Vector3(); cam.getWorldDirection(dir);
        let mSide = new THREE.MeshLambertMaterial({map: genTex('furnaceSide'), ...em}), mTop = new THREE.MeshLambertMaterial({map: genTex('furnaceTop'), ...em}), mFront = new THREE.MeshLambertMaterial({map: genTex('furnaceFront'), ...em});
        let mat = [mSide, mSide, mTop, mTop, mSide, mSide];
        let fIdx = 4; if(Math.abs(dir.x) > Math.abs(dir.z)) { if(dir.x > 0) fIdx = 1; else fIdx = 0; } else { if(dir.z > 0) fIdx = 5; else fIdx = 4; } mat[fIdx] = mFront;
        b = new THREE.Mesh(boxG, mat); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true;
        b.type = 'furnace'; b.slots = [{type:null, count:0, damage:0}, {type:null, count:0, damage:0}, {type:null, count:0, damage:0}];
        b.burnTime = 0; b.maxBurnTime = 0; b.cookTime = 0; b.maxCookTime = 100; b.frontIdx = fIdx; b.lit = false; b.light = null;
    } else if (type === 'chest') {
        let dir = new THREE.Vector3(); cam.getWorldDirection(dir);
        let mSide = new THREE.MeshLambertMaterial({map: genTex('chestSide'), ...em}), mTop = new THREE.MeshLambertMaterial({map: genTex('chestTop'), ...em}), mFront = new THREE.MeshLambertMaterial({map: genTex('chestFront'), ...em});
        let mat = [mSide, mSide, mTop, mTop, mSide, mSide];
        let fIdx = 4; if(Math.abs(dir.x) > Math.abs(dir.z)) { if(dir.x > 0) fIdx = 1; else fIdx = 0; } else { if(dir.z > 0) fIdx = 5; else fIdx = 4; } mat[fIdx] = mFront;
        
        b = new THREE.Group();
        let baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.875, 0.4375, 0.875), mat); baseMesh.position.y = -0.21875;
        let lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.875, 0.4375, 0.875), mat); lidMesh.position.y = 0.21875;
        b.add(baseMesh); b.add(lidMesh); b.position.set(x, y, z);
        b.type = 'chest'; b.lid = lidMesh; b.isOpen = false; b.slots = Array(27).fill(null).map(() => ({type: null, count: 0, damage: 0}));
        if(savedWorlds[activeWorldId] && savedWorlds[activeWorldId].chests && savedWorlds[activeWorldId].chests[key]) b.slots = savedWorlds[activeWorldId].chests[key];
    }
    sc.add(b); dynamicBlocks.set(key, b);
}

function checkFall(x, y, z) {
    let t = voxels.get(`${x},${y},${z}`);
    if(t === 'sand' || t === 'gravel') {
        let below = voxels.get(`${x},${y-1},${z}`);
        if(!below || below === 'AIR' || transparentBlocks.includes(below)) {
            removeB(x, y, z); let mat = new THREE.MeshLambertMaterial({map: genTex(t), emissive: 0x050505});
            let mesh = new THREE.Mesh(boxG, mat); mesh.position.set(x, y, z); mesh.castShadow = true; sc.add(mesh);
            fallingBlocks.push({mesh: mesh, type: t, x: x, y: y, z: z, vel: 0});
        }
    }
}

function placeB(x, y, z, type, faceNormal=null) {
    let key = `${x},${y},${z}`; voxels.set(key, type); modifiedBlocks[key] = type;
    if(transparentBlocks.includes(type) || type === 'furnace' || type === 'chest') { addDynamicBlock(x,y,z,type, faceNormal); }
    else { markChunkDirty(x, z); markChunkDirty(x+1, z); markChunkDirty(x-1, z); markChunkDirty(x, z+1); markChunkDirty(x, z-1); }
    if(type === 'sand' || type === 'gravel') checkFall(x, y, z);
}

function removeB(x, y, z) {
    let key = `${x},${y},${z}`; let type = voxels.get(key);
    if(transparentBlocks.includes(type) || type === 'furnace' || type === 'chest') {
        let b = dynamicBlocks.get(key);
        if(b) {
            if(type === 'furnace' || type === 'chest') {
                b.slots.forEach(s => { if(s.count > 0) dropItemIntoWorld(s.type, s.count, s.damage); });
                if(b.light) sc.remove(b.light);
            }
            sc.remove(b); dynamicBlocks.delete(key);
        }
    }
    voxels.set(key, 'AIR'); modifiedBlocks[key] = 'AIR';
    markChunkDirty(x, z); markChunkDirty(x+1, z); markChunkDirty(x-1, z); markChunkDirty(x, z+1); markChunkDirty(x, z-1);
    
    let topKey = `${x},${y+1},${z}`; let topT = voxels.get(topKey);
    if(topT === 'torch' || topT === 'cactus' || topT === 'sand' || topT === 'gravel' || transparentBlocks.includes(topT)) { 
        if(topT === 'sand' || topT === 'gravel') { checkFall(x, y+1, z); }
        else { removeB(x, y+1, z); dropItemIntoWorld(topT==='dead_bush'?'stick':topT, topT==='dead_bush'?1:1, 0); }
    }
}

function generateTree(ox, oy, oz, type) {
    let isBirch = type === 'birch'; let height = isBirch ? 5 + Math.floor(Math.random()*2) : 4 + Math.floor(Math.random()*3);
    for(let i=0; i<height; i++) placeB(ox, oy+i, oz, isBirch ? 'birch_log' : 'oak_log');
    let leavesType = isBirch ? 'birch_leaves' : 'oak_leaves';
    for(let ly=oy+height-2; ly<=oy+height+1; ly++) {
        let radius = (ly >= oy+height) ? 1 : 2;
        for(let lx=-radius; lx<=radius; lx++) { for(let lz=-radius; lz<=radius; lz++) {
            if(Math.abs(lx)===radius && Math.abs(lz)===radius && (ly >= oy+height || Math.random()>0.5)) continue;
            let lKey = `${ox+lx},${ly},${oz+lz}`; if(!voxels.has(lKey) || voxels.get(lKey) === 'AIR') placeB(ox+lx, ly, oz+lz, leavesType);
        } }
    }
}

function generateChunkVolume(cx, cz) {
    let isSuperflat = savedWorlds[activeWorldId] && savedWorlds[activeWorldId].type === 'SUPERFLAT';
    for(let x = 0; x < CHUNK_SIZE; x++) { 
        for(let z = 0; z < CHUNK_SIZE; z++) {
            let absX = cx * CHUNK_SIZE + x, absZ = cz * CHUNK_SIZE + z; 
            let h = getSurfaceH(absX, absZ); let biome = getBiome(absX, absZ);
            
            if(isSuperflat) {
                for(let y=0; y>=-3; y--) {
                    let k = `${absX},${y},${absZ}`;
                    if(!voxels.has(k)) { if(modifiedBlocks[k]) { if(modifiedBlocks[k] !== 'AIR') voxels.set(k, modifiedBlocks[k]); } else { if(y===0) voxels.set(k, 'grass'); else if(y===-1 || y===-2) voxels.set(k, 'dirt'); else if(y===-3) voxels.set(k, 'bedrock'); } }
                } continue; 
            }

            if(!voxels.has(`${absX},${h},${absZ}`)) {
                if(modifiedBlocks[`${absX},${h},${absZ}`]) { if(modifiedBlocks[`${absX},${h},${absZ}`] !== 'AIR') voxels.set(`${absX},${h},${absZ}`, modifiedBlocks[`${absX},${h},${absZ}`]); }
                else voxels.set(`${absX},${h},${absZ}`, biome === 'DESERT' ? 'sand' : 'grass');
            }
            
            for(let y=h-1; y>=-59; y--) {
                let k = `${absX},${y},${absZ}`;
                if (!voxels.has(k)) { 
                    if(modifiedBlocks[k]) { if(modifiedBlocks[k] !== 'AIR') voxels.set(k, modifiedBlocks[k]); }
                    else if (!isCaveNoise(absX, y, absZ)) { if (y >= h-3) voxels.set(k, biome === 'DESERT' ? 'sand' : 'dirt'); else voxels.set(k, 'stone'); }
                }
            }
            let bedK = `${absX},-60,${absZ}`; if (!voxels.has(bedK)) { if(modifiedBlocks[bedK]) { if(modifiedBlocks[bedK] !== 'AIR') voxels.set(bedK, modifiedBlocks[bedK]); } else voxels.set(bedK, 'bedrock'); }
            
            let decKey = `${absX},${h+1},${absZ}`;
            if(!modifiedBlocks[decKey] && !voxels.has(decKey)) {
                if(biome === 'DESERT') {
                    if(Math.random() < 0.01) { voxels.set(decKey, 'cactus'); if(Math.random()<0.5) voxels.set(`${absX},${h+2},${absZ}`, 'cactus'); }
                    else if(Math.random() < 0.04) { voxels.set(decKey, 'dead_bush'); }
                } else if (biome === 'FOREST') {
                    if (Math.random() < 0.015) { let treeType = Math.random() < 0.5 ? 'oak' : 'birch'; generateTree(absX, h+1, absZ, treeType); }
                    else if (Math.random() < 0.1) { voxels.set(decKey, 'short_grass'); }
                    else if (Math.random() < 0.02) { voxels.set(decKey, Math.random()>0.5?'rose':'dandelion'); }
                } else if (biome === 'PLAINS') {
                    if (Math.random() < 0.005) { generateTree(absX, h+1, absZ, 'oak'); }
                    else if (Math.random() < 0.15) { voxels.set(decKey, 'short_grass'); }
                    else if (Math.random() < 0.03) { voxels.set(decKey, Math.random()>0.5?'rose':'dandelion'); }
                }
            }
        }
    }
    
    if(isSuperflat) return;
    let ores = [ {type:'coal_ore', count:6, min:-35, max:40}, {type:'iron_ore', count:4, min:-45, max:35}, {type:'gold_ore', count:2, min:-45, max:20}, {type:'lapis_ore', count:1, min:-50, max:10, chance: 0.5}, {type:'redstone_ore', count:2, min:-58, max:15, chance: 0.6}, {type:'diamond_ore', count:1, min:-58, max:10, chance: 0.01}, {type:'emerald_ore', count:1, min:-10, max:40, chance: 0.05} ];
    ores.forEach(ore => {
        if (ore.chance && Math.random() > ore.chance) return;
        for(let i=0; i<ore.count; i++) {
            let ox = cx * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE); let oz = cz * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE); let oy = Math.floor(Math.random() * (ore.max - ore.min)) + ore.min; 
            for(let v=0; v<3; v++) {
                let k = `${ox},${oy},${oz}`; if (voxels.get(k) === 'stone' && !modifiedBlocks[k]) voxels.set(k, ore.type);
                ox += Math.floor(Math.random()*3)-1; oy += Math.floor(Math.random()*3)-1; oz += Math.floor(Math.random()*3)-1;
            }
        }
    });
    for(let ox = cx * CHUNK_SIZE; ox < cx * CHUNK_SIZE + CHUNK_SIZE; ox++) { for(let oz = cz * CHUNK_SIZE; oz < cz * CHUNK_SIZE + CHUNK_SIZE; oz++) { if(Math.random() < 0.05) { let oy = Math.floor(Math.random() * 40) - 40; let k = `${ox},${oy},${oz}`; if(voxels.get(k) === 'stone' && !modifiedBlocks[k]) { voxels.set(k, 'gravel'); checkFall(ox, oy, oz); } } } }
}
