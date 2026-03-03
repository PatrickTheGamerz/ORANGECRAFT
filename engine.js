// --- 4. 3D VOXEL ENGINE ---
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
let RENDER_DIST = optRender; const CHUNK_SIZE = 8; const transparentBlocks = ['oak_leaves', 'birch_leaves', 'torch', 'oak_sapling', 'birch_sapling', 'dead_bush', 'short_grass', 'dandelion', 'rose'];

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
                    if(t && t !== 'torch' && !t.endsWith('_sapling') && t !== 'dead_bush' && t !== 'short_grass' && t !== 'dandelion' && t !== 'rose' && t !== 'furnace' && t !== 'chest' && t !== 'AIR') {
                        let exposed = false; const adjs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
                        for(let off of adjs) { let nType = voxels.get(`${ax+off[0]},${y+off[1]},${az+off[2]}`); if(!nType || nType === 'AIR' || transparentBlocks.includes(nType)) { exposed = true; break; } }
                        if (transparentBlocks.includes(t)) exposed = true;
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
    if (type === 'torch' || type.endsWith('_sapling') || type === 'dead_bush' || type === 'short_grass' || type === 'dandelion' || type === 'rose') {
        b = new THREE.Group(); let tex = genTex(type);
        let mat = new THREE.MeshLambertMaterial({map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, emissive: type==='torch'?0x222222:0x00});
        let p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, type==='torch'?0.6:0.8), mat); p1.rotation.y = Math.PI/4;
        let p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, type==='torch'?0.6:0.8), mat); p2.rotation.y = -Math.PI/4;
        if(type!=='torch'){p1.castShadow = true; p2.castShadow = true;} b.add(p1); b.add(p2);

        let tX = x, tY = y, tZ = z;
        if(faceNormal && type === 'torch') {
            let nx = Math.round(faceNormal.x); let nz = Math.round(faceNormal.z);
            if (nx > 0) { tX -= 0.35; b.rotation.z = -0.3; } else if (nx < 0) { tX += 0.35; b.rotation.z = 0.3; } else if (nz > 0) { tZ -= 0.35; b.rotation.x = 0.3; } else if (nz < 0) { tZ += 0.35; b.rotation.x = -0.3; } else { tY -= 0.2; }
        } else { tY -= (type==='torch'?0.2:0.1); }
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
        b = new THREE.Mesh(new THREE.BoxGeometry(0.875, 0.875, 0.875), mat); b.position.set(x, y-0.0625, z); b.castShadow = true; b.receiveShadow = true;
        b.type = 'chest'; b.slots = Array(27).fill(null).map(() => ({type: null, count: 0, damage: 0}));
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
    if(type === 'torch' || type.endsWith('_sapling') || type === 'dead_bush' || type === 'short_grass' || type === 'dandelion' || type === 'rose' || type === 'furnace' || type === 'chest') { addDynamicBlock(x,y,z,type, faceNormal); }
    else { markChunkDirty(x, z); markChunkDirty(x+1, z); markChunkDirty(x-1, z); markChunkDirty(x, z+1); markChunkDirty(x, z-1); }
    if(type === 'sand' || type === 'gravel') checkFall(x, y, z);
}

function removeB(x, y, z) {
    let key = `${x},${y},${z}`; let type = voxels.get(key);
    if(type === 'torch' || type.endsWith('_sapling') || type === 'dead_bush' || type === 'short_grass' || type === 'dandelion' || type === 'rose' || type === 'furnace' || type === 'chest') {
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
    if(topT === 'torch' || topT === 'cactus' || topT === 'sand' || topT === 'gravel' || topT?.endsWith('_sapling') || topT === 'dead_bush' || topT === 'short_grass' || topT === 'dandelion' || topT === 'rose') { 
        if(topT === 'sand' || topT === 'gravel') { checkFall(x, y+1, z); }
        else { removeB(x, y+1, z); dropItemIntoWorld(topT==='dead_bush'?'stick':topT, topT==='dead_bush'?1:1, 0); drops[drops.length-1].mesh.position.set(x, y+1, z); }
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
                    else if(Math.random() < 0.02) { voxels.set(decKey, 'dead_bush'); }
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

let initialLoadQueue = []; let initialLoadTotal = 0; let gameplayChunkQueue = [];

for(let cx = -3; cx <= 3; cx++) { for(let cz = -3; cz <= 3; cz++) { generateChunkVolume(cx, cz); chunks.set(`${cx},${cz}`, new Chunk(cx, cz)); } }
chunks.forEach(c => c.update()); cameraGroup.position.set(0, getSurfaceH(0, 0) + 10, 0);

function startGame(saveData = null) { 
    initAudio(); 
    voxels.clear(); dynamicBlocks.forEach((v,k)=>sc.remove(v.light)); dynamicBlocks.clear();
    for(let [k, chunk] of chunks.entries()) { for(let t in chunk.meshes) { chunk.group.remove(chunk.meshes[t].mesh); chunk.meshes[t].mesh.dispose(); } sc.remove(chunk.group); }
    chunks.clear(); drops.forEach(d=>sc.remove(d.mesh)); drops = []; fallingBlocks.forEach(b=>sc.remove(b.mesh)); fallingBlocks = [];
    
    document.querySelectorAll('.menu-overlay').forEach(m => m.style.display = 'none');
    document.getElementById('loading-screen').style.display = 'flex';
    gameState = "LOADING"; initialLoadQueue = []; chatLog = []; document.getElementById('chat-log').innerHTML = '';
    
    if(saveData && saveData.pos) {
        cameraGroup.position.set(saveData.pos.x, saveData.pos.y, saveData.pos.z); cam.rotation.x = saveData.pos.rotX || 0; targetRotation.y = saveData.pos.rotY || 0;
    } else {
        cameraGroup.position.set(0, getSurfaceH(0, 0) + 2, 0); targetRotation.y = 0; cam.rotation.x = 0;
        inventory = Array(36).fill(null).map(() => ({type: null, count: 0, damage: 0}));
        if(saveData && saveData.chest) { 
            let cX = 0, cZ = 2; let cY = getSurfaceH(cX, cZ) + 1;
            modifiedBlocks[`${cX},${cY},${cZ}`] = 'chest';
            modifiedBlocks[`${cX+1},${cY},${cZ}`] = 'torch'; modifiedBlocks[`${cX-1},${cY},${cZ}`] = 'torch';
            modifiedBlocks[`${cX},${cY},${cZ+1}`] = 'torch'; modifiedBlocks[`${cX},${cY},${cZ-1}`] = 'torch';
            let startChest = Array(27).fill(null).map(() => ({type: null, count: 0, damage: 0}));
            startChest[0] = {type:'wooden_pickaxe', count:1, damage:0}; startChest[1] = {type:'apple', count:5, damage:0}; startChest[2] = {type:'oak_log', count:10, damage:0};
            if(!saveData.chests) saveData.chests = {}; saveData.chests[`${cX},${cY},${cZ}`] = startChest;
        }
    }

    for(let k in modifiedBlocks) {
        if(modifiedBlocks[k] !== 'AIR') voxels.set(k, modifiedBlocks[k]);
        if(modifiedBlocks[k] === 'torch' || modifiedBlocks[k].endsWith('_sapling') || modifiedBlocks[k] === 'dead_bush' || modifiedBlocks[k] === 'furnace' || modifiedBlocks[k] === 'chest' || modifiedBlocks[k] === 'short_grass' || modifiedBlocks[k] === 'dandelion' || modifiedBlocks[k] === 'rose') { let coords = k.split(',').map(Number); addDynamicBlock(coords[0], coords[1], coords[2], modifiedBlocks[k], new THREE.Vector3(0,1,0)); }
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

function setMenu(s) {
  if(gameState === "INV" || gameState === "CRAFTING" || gameState === "CREATIVE") { let arr = gameState === "INV" ? crafting2x2 : crafting3x3; arr.forEach(c => { if(c.count > 0) { dropItemIntoWorld(c.type, c.count, c.damage); c.count = 0; c.type = null; c.damage = 0; } }); }
  if(gameState === "FURNACE") { activeFurnacePos = null; }
  if(gameState === "CHEST") { activeChestPos = null; }
  if(s === "OPTIONS" || s === "TEXTURE_PACKS" || s === "SUB_MENU") { if(gameState === "PAUSE_MENU" || gameState === "PLAYING") previousMenu = "PAUSE_MENU"; else if (gameState !== "OPTIONS" && gameState !== "SUB_MENU" && gameState !== "TEXTURE_PACKS") previousMenu = "MAIN_MENU"; }

  if(s !== "LOADING") {
      gameState = s; document.querySelectorAll('.menu-overlay').forEach(m => m.style.display = 'none');
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
          else if (s === "CHEST") document.getElementById('chest-screen').style.display = 'flex'; 
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
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && gameState === "PLAYING") setMenu('PAUSE_MENU'); });

function fastVoxelRaycast(origin, dir, maxDist) {
    let pos = origin.clone(); let step = 0.05; 
    let lastBx = Math.round(pos.x), lastBy = Math.round(pos.y), lastBz = Math.round(pos.z);
    for(let d = 0; d < maxDist; d += step) {
        pos.addScaledVector(dir, step);
        let bx = Math.round(pos.x), by = Math.round(pos.y), bz = Math.round(pos.z); let k = `${bx},${by},${bz}`;
        if(voxels.has(k) && voxels.get(k) !== 'AIR') {
            if(voxels.get(k) === 'torch' || voxels.get(k).endsWith('_sapling') || voxels.get(k) === 'dead_bush' || voxels.get(k) === 'short_grass' || voxels.get(k) === 'dandelion' || voxels.get(k) === 'rose') { if (Math.abs(pos.x - bx) > 0.25 || Math.abs(pos.z - bz) > 0.25) continue; }
            if(voxels.get(k) === 'cactus' && (Math.abs(pos.x - bx) > 0.4 || Math.abs(pos.z - bz) > 0.4)) continue;
            let nx = Math.max(-1, Math.min(1, lastBx - bx)), ny = Math.max(-1, Math.min(1, lastBy - by)), nz = Math.max(-1, Math.min(1, lastBz - bz));
            if(Math.abs(nx) + Math.abs(ny) + Math.abs(nz) !== 1) {
                if (Math.abs(dir.x) > Math.abs(dir.y) && Math.abs(dir.x) > Math.abs(dir.z)) { nx = -Math.sign(dir.x); ny=0; nz=0; } else if (Math.abs(dir.y) > Math.abs(dir.z)) { ny = -Math.sign(dir.y); nx=0; nz=0; } else { nz = -Math.sign(dir.z); nx=0; ny=0; }
            }
            return {x: bx, y: by, z: bz, name: voxels.get(k), normal: new THREE.Vector3(nx, ny, nz)};
        }
        lastBx = bx; lastBy = by; lastBz = bz;
    } return null;
}

function dropItemIntoWorld(type, amount = 1, damage = 0) {
    let dmgLevel = getDmgLevel(type, damage);
    for(let j=0; j<amount; j++) {
        let dir = new THREE.Vector3(); cam.getWorldDirection(dir); let dropPos = cameraGroup.position.clone().addScaledVector(dir, 1.2); dropPos.y += 0.2; 
        let drop, mat; let em = { emissive: 0x050505 };
        let is2D = (type === 'stick' || type === 'charcoal' || type === 'coal' || type.endsWith('_ingot') || type.startsWith('raw_') || type === 'diamond' || type === 'emerald' || type === 'lapis_lazuli' || type === 'redstone' || type === 'torch' || type === 'apple' || type.endsWith('_sapling') || type === 'dead_bush' || type === 'short_grass' || type === 'dandelion' || type === 'rose' || type === 'chest' || type.endsWith('_pickaxe') || type.endsWith('_axe') || type.endsWith('_shovel') || type.endsWith('_sword') || type.endsWith('_hoe'));
        
        if (is2D) { 
            let group = new THREE.Group(); let tex = genTex(type, dmgLevel);
            let matFront = new THREE.MeshLambertMaterial({map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, ...em});
            let pGeo = new THREE.PlaneGeometry(0.5, 0.5);
            for(let i=0; i<5; i++) { let mesh = new THREE.Mesh(pGeo, matFront); mesh.position.z = (i - 2.0) * 0.015; mesh.castShadow = true; group.add(mesh); } drop = group;
        } 
        else { 
            if (type.endsWith('_log')) { mat = [new THREE.MeshLambertMaterial({map: genTex(type), ...em}), new THREE.MeshLambertMaterial({map: genTex(type), ...em}), new THREE.MeshLambertMaterial({map: genTex(type.replace('log','top')), ...em}), new THREE.MeshLambertMaterial({map: genTex(type.replace('log','top')), ...em}), new THREE.MeshLambertMaterial({map: genTex(type), ...em}), new THREE.MeshLambertMaterial({map: genTex(type), ...em})]; }
            else if (type === 'crafting_table') { mat = [new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('oak_planks'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('ctSide'), ...em})]; }
            else if (type === 'grass') { mat = [new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grass'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('grassSide'), ...em})]; }
            else if (type === 'farmland') { mat = [new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('farmlandTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em}), new THREE.MeshLambertMaterial({map: genTex('dirt'), ...em})]; }
            else if (type === 'furnace') { mat = [new THREE.MeshLambertMaterial({map: genTex('furnaceSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceSide'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceTop'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceFront'), ...em}), new THREE.MeshLambertMaterial({map: genTex('furnaceSide'), ...em})]; }
            else { mat = new THREE.MeshLambertMaterial({map: genTex(type), transparent: type.endsWith('_leaves')&&!isProgrammerArt, ...em}); }
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
    playSound('damage'); player.hp -= amount;
    cam.rotation.z = 0.2; setTimeout(() => cam.rotation.z = 0, 200);
    if(player.hp <= 0) {
        player.hp = 0; player.dead = true; addChatMessage(`Player ${sourceStr}`, "#aaa");
        if(!gamerules.keepInventory) { inventory.forEach(s => { if(s.count>0) { dropItemIntoWorld(s.type, s.count, s.damage); s.type=null; s.count=0; } }); }
        setMenu('DEATH');
    }
    updateUI();
}
  
function respawnPlayer() {
    if(savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'HARDCORE') { savedWorlds[activeWorldId].mode = 'SPECTATOR'; player.hp = 20; player.food = 20; player.dead = false; setMenu('PLAYING'); return; }
    player.hp = 20; player.food = 20; player.dead = false; player.flying = false; yVel = 0; pVel.set(0,0,0);
    cameraGroup.position.set(0, getSurfaceH(0, 0) + 2, 0); setMenu('PLAYING');
}

function animate() {
  requestAnimationFrame(animate);
  if(gameState === "LOADING") return;

  let isPaused = (gameState === "PAUSE_MENU" || gameState === "OPTIONS" || gameState === "SUB_MENU" || gameState === "TEXTURE_PACKS" || gameState === "DEATH" || gameState === "MAIN_MENU");

  if(!isPaused) {
      cam.rotation.x += (targetRotation.x - cam.rotation.x) * 0.22; cam.rotation.y += (targetRotation.y - cam.rotation.y) * 0.22;
      globalTick++;

      let camIntX = Math.floor(cameraGroup.position.x); let camIntZ = Math.floor(cameraGroup.position.z);
      sun.position.set(camIntX + 30, 100, camIntZ + 30); sun.target.position.set(camIntX, 0, camIntZ); sun.target.updateMatrixWorld();
      
      let pY = Math.floor(cameraGroup.position.y); let sY = getSurfaceH(camIntX, camIntZ);
      let isEnclosed = false;
      for(let cy = pY; cy <= sY + 1; cy++) { let t = voxels.get(`${camIntX},${cy},${camIntZ}`); if(t && t !== 'AIR' && !transparentBlocks.includes(t)) { isEnclosed = true; break; } }
      
      let targetAmbient = optLighting === 1 ? 0.45 : 0.8; let targetFogColor = new THREE.Color(skyColor); let depth = (sY - pY);
      if (isEnclosed && depth >= 0 && optLighting === 1) { let darkness = Math.max(0.04, 0.25 - (depth * 0.015)); targetAmbient = darkness; targetFogColor.setHex(0x050505); }
      amb.intensity = THREE.MathUtils.lerp(amb.intensity, targetAmbient, 0.05); sc.fog.color.lerp(targetFogColor, 0.05); sc.background.lerp(targetFogColor, 0.05);

      if(gameplayChunkQueue.length > 0) { let c = gameplayChunkQueue.shift(); generateChunkVolume(c.x, c.z); let chunk = new Chunk(c.x, c.z); chunk.update(); chunks.set(`${c.x},${c.z}`, chunk); }

      if(globalTick % 60 === 0) {
          let pX = Math.floor(cameraGroup.position.x / CHUNK_SIZE); let pZ = Math.floor(cameraGroup.position.z / CHUNK_SIZE);
          for(let [k, chunk] of chunks.entries()) {
              if (Math.abs(chunk.cx - pX) > RENDER_DIST + 1 || Math.abs(chunk.cz - pZ) > RENDER_DIST + 1) { for(let t in chunk.meshes) { chunk.group.remove(chunk.meshes[t].mesh); chunk.meshes[t].mesh.dispose(); } sc.remove(chunk.group); chunks.delete(k); }
          }
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
          });
          if(uiNeedsUpdate) updateUI();
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
              else if(Math.random() < 0.02 && !voxels.has(`${coords[0]},${coords[1]+1},${coords[2]}`)) {
                  let cHeight = 1; while(voxels.get(`${coords[0]},${coords[1]-cHeight},${coords[2]}`) === 'cactus') cHeight++;
                  if(cHeight < 4) placeB(coords[0], coords[1]+1, coords[2], 'cactus');
              }
          }
      }

      for(let i = fallingBlocks.length - 1; i >= 0; i--) {
          let b = fallingBlocks[i]; b.vel -= 0.02; b.mesh.position.y += b.vel;
          if (b.mesh.position.y < Math.floor(b.y)) {
              let destY = Math.floor(b.y) - 1;
              if (isSolidVoxel(b.x, destY, b.z) || destY < -60) { sc.remove(b.mesh); placeB(b.x, Math.floor(b.y), b.z, b.type); fallingBlocks.splice(i, 1); } else { b.y = destY; }
          }
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
        let canSprint = player.food > 3 || isCreative;
        let isSprinting = (keys['ShiftLeft'] || keys['ShiftRight'] || keys['ControlLeft'] || keys['ControlRight']) && keys['KeyW'] && canSprint;
        
        cam.fov = THREE.MathUtils.lerp(cam.fov, isSprinting ? optFov+10 : optFov, 0.1); cam.updateProjectionMatrix();
        let accel = isSprinting ? 0.014 : 0.011; if(player.flying) accel *= 2; let friction = player.flying ? 0.9 : 0.85; pVel.x *= friction; pVel.z *= friction; 
        
        if(keys['KeyW']) { pVel.x += dir.x * accel; pVel.z += dir.z * accel; } if(keys['KeyS']) { pVel.x -= dir.x * accel; pVel.z -= dir.z * accel; }
        if(keys['KeyA']) { pVel.x += side.x * accel; pVel.z += side.z * accel; } if(keys['KeyD']) { pVel.x -= side.x * accel; pVel.z -= side.z * accel; }

        let px = cameraGroup.position.x, pz = cameraGroup.position.z;
        let footY = Math.round(cameraGroup.position.y - 1.5), headY = Math.round(cameraGroup.position.y - 0.5); let margin = 0.4; 
        
        if (isSpectator) {
            cameraGroup.position.x += pVel.x; cameraGroup.position.z += pVel.z;
            if(keys['Space']) cameraGroup.position.y += 0.4; if(keys['ShiftLeft']) cameraGroup.position.y -= 0.4; yVel = 0;
        } else if (player.flying) {
            cameraGroup.position.x += pVel.x; cameraGroup.position.z += pVel.z;
            if(keys['Space']) cameraGroup.position.y += 0.2; if(keys['ShiftLeft']) cameraGroup.position.y -= 0.2; yVel = 0;
        } else {
            if(!isSolidVoxel(Math.round(px + pVel.x + Math.sign(pVel.x)*margin), footY, Math.round(pz)) && !isSolidVoxel(Math.round(px + pVel.x + Math.sign(pVel.x)*margin), headY, Math.round(pz))) cameraGroup.position.x += pVel.x; else pVel.x = 0;
            if(!isSolidVoxel(Math.round(px), footY, Math.round(pz + pVel.z + Math.sign(pVel.z)*margin)) && !isSolidVoxel(Math.round(px), headY, Math.round(pz + pVel.z + Math.sign(pVel.z)*margin))) cameraGroup.position.z += pVel.z; else pVel.z = 0;

            yVel -= 0.01; let nextY = cameraGroup.position.y + yVel;
            if(yVel <= 0 && isSolidVoxel(Math.round(cameraGroup.position.x), Math.round(nextY - 1.6), Math.round(cameraGroup.position.z))) { 
                let landY = Math.round(nextY - 1.6);
                if(highestY - cameraGroup.position.y > 3) { let fallDist = Math.floor(highestY - cameraGroup.position.y) - 3; applyDamage(fallDist, "fell from a high place"); }
                highestY = cameraGroup.position.y;
                
                if (yVel < -0.1) { let landKey = `${Math.round(cameraGroup.position.x)},${landY},${Math.round(cameraGroup.position.z)}`; if (voxels.get(landKey) === 'farmland' && Math.random() < 0.5) { removeB(Math.round(cameraGroup.position.x), landY, Math.round(cameraGroup.position.z)); placeB(Math.round(cameraGroup.position.x), landY, Math.round(cameraGroup.position.z), 'dirt'); playSound('dig', 'dirt'); } }
                yVel = 0; cameraGroup.position.y = landY + 2.1; 
                if(keys['Space']) yVel = 0.16; 
            } else if (yVel > 0 && isSolidVoxel(Math.round(cameraGroup.position.x), Math.round(nextY), Math.round(cameraGroup.position.z))) {
                yVel = 0; cameraGroup.position.y = Math.round(nextY) - 0.75; 
            } else { cameraGroup.position.y = nextY; if(yVel > 0) highestY = cameraGroup.position.y; }
            
            let cxInt = Math.round(cameraGroup.position.x), cyInt = Math.round(cameraGroup.position.y - 1.6), czInt = Math.round(cameraGroup.position.z);
            let footBlock = voxels.get(`${cxInt},${cyInt},${czInt}`);
            if(footBlock === 'cactus' && globalTick % 10 === 0) { applyDamage(1, "was pricked to death"); }
            
            let headBlock = voxels.get(`${cxInt},${cyInt+1},${czInt}`);
            if(headBlock === 'sand' || headBlock === 'gravel') { if(globalTick % 20 === 0) applyDamage(1, "suffocated in a wall"); }
        }

        if(cameraGroup.position.y < -65) { if(globalTick % 20 === 0) applyDamage(4, "fell out of the world"); }

        cam.position.y = 0;

        if(!isSpectator && !player.flying && isSolidVoxel(Math.round(cameraGroup.position.x), Math.round(cameraGroup.position.y - 1.6), Math.round(cameraGroup.position.z)) && isMoving && gameState === "PLAYING") {
            let speed = Math.sqrt(pVel.x*pVel.x + pVel.z*pVel.z); stepTimer += speed; 
            if(stepTimer > (isSprinting ? 0.7 : 0.5)) { let bName = voxels.get(`${Math.round(cameraGroup.position.x)},${Math.round(cameraGroup.position.y - 1.6)},${Math.round(cameraGroup.position.z)}`); playSound('step', bName || 'grass'); stepTimer = 0; player.exhaustion += isSprinting ? 0.1 : 0.01; }
        } else { stepTimer = 0; }

        // Hunger mechanics
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
              if (!floorType.endsWith('_leaves') && floorType !== 'torch' && !transparentBlocks.includes(floorType)) { d.velY = 0; d.mesh.position.y = Math.floor(d.mesh.position.y-0.2) + 0.65; d.velDir.x=0; d.velDir.z=0; }
          }
          if(!d.is2D) { d.mesh.rotation.y += 0.03; d.mesh.rotation.x += 0.01; } else { d.mesh.rotation.y += 0.05; }
          
          let pFeet = cameraGroup.position.clone(); pFeet.y -= 1.5;
          if(Date.now() - d.spawnTime > 1500 && pFeet.distanceTo(d.mesh.position) < 2.5 && !player.dead) { d.mesh.position.lerp(pFeet, 0.25); if(pFeet.distanceTo(d.mesh.position) < 0.7) { playSound('click'); sc.remove(d.mesh); drops.splice(i, 1); addToInventory(d.type, 1, d.damage); } }
        });

        if(miningTarget && gameState === "PLAYING" && !player.dead) {
            let activeItem = inventory[activeSlot]; let activeType = activeItem.type; 
            let lookDir = new THREE.Vector3(); cam.getWorldDirection(lookDir); lookDir.normalize();
            let hit = fastVoxelRaycast(cameraGroup.position, lookDir, 6);
            
            if(!hit || hit.x !== miningTarget.x || hit.y !== miningTarget.y || hit.z !== miningTarget.z) { 
                miningTarget = null; crackMesh.visible = false; redstoneGlow.visible = false;
            } else {
                let name = miningTarget.name;
                if (name === 'redstone_ore') { redstoneGlow.position.set(miningTarget.x, miningTarget.y, miningTarget.z); redstoneGlow.visible = true; } else { redstoneGlow.visible = false; }

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
                else if (name.endsWith('_leaves')) { baseHardness = 0.2; if (toolClass === 'hoe' || toolClass === 'sword') isCorrectTool = true; canHarvest = true; if (toolClass === 'sword') toolSpeed = 1.5; } 
                else if (['torch', 'oak_sapling', 'birch_sapling', 'dead_bush', 'short_grass', 'dandelion', 'rose'].includes(name)) { baseHardness = 0.0; canHarvest = true; isCorrectTool = true; } 
                else if (name === 'cactus') { baseHardness = 0.4; canHarvest = true; }
                else if (name === 'bedrock') { baseHardness = 9999; canHarvest = isCreative; }

                let timeToMine;
                if(isCreative) { timeToMine = 0; }
                else {
                    timeToMine = isCorrectTool ? ((baseHardness * 1.5) / toolSpeed) : (baseHardness * 1.5);
                    if (!isCorrectTool && toolClass !== 'hand' && ['stone', 'cobblestone', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'lapis_ore', 'redstone_ore', 'emerald_ore', 'furnace'].includes(name)) timeToMine = baseHardness * 5.0;
                    if (baseHardness === 0.0) timeToMine = 0.05;
                }
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
                        if (name === 'short_grass') { if(Math.random()<0.1) { dropName='oak_sapling'; dropCount=1; } else dropName=null; }

                        if (!canHarvest) dropName = null; 
                        if(dropName && dropCount > 0) { 
                            dropItemIntoWorld(dropName, dropCount, 0); 
                            for(let i=0; i<dropCount; i++) {
                                let dObj = drops[drops.length-1-i];
                                dObj.mesh.position.set(miningTarget.x, miningTarget.y, miningTarget.z); 
                                dObj.velDir = new THREE.Vector3().subVectors(cameraGroup.position, dObj.mesh.position).normalize().multiplyScalar(0.1);
                                dObj.velY = 0.1; dObj.spawnTime = Date.now() - 1500; 
                            }
                        }
                    }
                    miningTarget = null; crackMesh.visible = false;
                } else { crackMesh.material = crackMats[Math.min(stage, 9)]; }
            }
        }
      }
  } else { if(gameState === "MAIN_MENU") targetRotation.y += 0.001; }
  rnd.render(sc, cam);
}

document.addEventListener('keydown', e => {
  if(gameState !== "CHAT") keys[e.code] = true;
  if(e.code === 'KeyE' && gameState !== "CHAT") { playSound('click'); if(gameState === "INV" || gameState === "CRAFTING" || gameState === "FURNACE" || gameState === "CREATIVE" || gameState === "CHEST") setMenu('PLAYING'); else if(gameState === "PLAYING") setMenu('INV'); }
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
  if(e.code === 'Space' && gameState === "PLAYING" && !player.dead && savedWorlds[activeWorldId] && savedWorlds[activeWorldId].mode === 'CREATIVE') {
      let now = Date.now(); if(now - lastSpacePress < 300) { player.flying = !player.flying; } lastSpacePress = now;
  }
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

    if(e.button === 0 && !isAdventure && !isSpectator) { 
        miningTarget = {x: hit.x, y: hit.y, z: hit.z, name: hit.name}; miningProgress = 0; miningSoundTimer = 0; crackMesh.position.set(hit.x, hit.y, hit.z); crackMesh.visible = true; 
    }
    else if(e.button === 2 && !isSpectator) {
      if(hit.name === 'crafting_table') { setMenu('CRAFTING'); return; }
      if(hit.name === 'furnace') { activeFurnacePos = `${hit.x},${hit.y},${hit.z}`; setMenu('FURNACE'); return; }
      if(hit.name === 'chest') { activeChestPos = `${hit.x},${hit.y},${hit.z}`; setMenu('CHEST'); return; }
      
      if(item.type === 'apple' && player.food < 20) {
          playSound('eat'); player.food = Math.min(20, player.food + 4); player.saturation = Math.min(20, player.saturation + 2.4);
          if(!isCreative) item.count--; if(item.count<=0) item.type=null; updateUI(); return;
      }

      if((item.type === 'torch' || item.type === 'dead_bush' || item.type?.endsWith('_sapling') || item.type === 'short_grass' || item.type === 'dandelion' || item.type === 'rose') && hit.normal.y !== 1 && item.type !== 'torch') return; // Plants only on top
      if(item.type === 'torch' && hit.normal.y === -1) return; // No ceiling torches
      if((item.type?.endsWith('_sapling') || item.type === 'dead_bush' || item.type === 'short_grass' || item.type === 'dandelion' || item.type === 'rose') && hit.name !== 'grass' && hit.name !== 'dirt' && hit.name !== 'sand') return;
      
      if(!isAdventure && item.type && item.count > 0 && item.type !== 'stick' && item.type !== 'charcoal' && item.type !== 'coal' && !item.type.endsWith('_ingot') && !item.type.startsWith('raw_') && item.type !== 'diamond' && item.type !== 'lapis_lazuli' && item.type !== 'emerald' && item.type !== 'redstone' && item.type !== 'apple' && !item.type.endsWith('_pickaxe') && !item.type.endsWith('_axe') && !item.type.endsWith('_shovel') && !item.type.endsWith('_sword') && !item.type.endsWith('_hoe')) { 
        let pX = hit.x + hit.normal.x, pY = hit.y + hit.normal.y, pZ = hit.z + hit.normal.z;
        let dx = pX - cameraGroup.position.x, dy = pY - (cameraGroup.position.y - 1.6), dz = pZ - cameraGroup.position.z;
        let overlapY = (cameraGroup.position.y - 1.6) < (pY + 0.5) && (cameraGroup.position.y - 0.1) > (pY - 0.5);
        let insidePlayer = (Math.abs(dx) < 0.35 && Math.abs(dz) < 0.35 && overlapY);

        if((!voxels.has(`${pX},${pY},${pZ}`) || voxels.get(`${pX},${pY},${pZ}`) === 'AIR') && (!insidePlayer || item.type === 'torch' || item.type.endsWith('_sapling') || item.type === 'dead_bush' || item.type === 'short_grass' || item.type === 'dandelion' || item.type === 'rose')) { 
            playSound('place', item.type); placeB(pX, pY, pZ, item.type, hit.normal); 
            if(!isCreative) item.count--; 
            let underKey = `${pX},${pY-1},${pZ}`; if(voxels.get(underKey) === 'grass' || voxels.get(underKey) === 'farmland') { removeB(pX, pY-1, pZ); placeB(pX, pY-1, pZ, 'dirt'); }
            updateUI(); 
        }
      }
    }
  } else {
      let item = inventory[activeSlot];
      if(e.button === 2 && item.type === 'apple' && player.food < 20 && !isSpectator) {
          playSound('eat'); player.food = Math.min(20, player.food + 4); player.saturation = Math.min(20, player.saturation + 2.4);
          if(!isCreative) item.count--; if(item.count<=0) item.type=null; updateUI(); return;
      }
  }
});
document.addEventListener('mouseup', () => { miningTarget = null; crackMesh.visible = false; redstoneGlow.visible = false; });

document.getElementById('splash-text').innerText = authenticSplashes[Math.floor(Math.random() * authenticSplashes.length)]; updateUI(); animate();
