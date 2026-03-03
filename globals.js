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

let texCache = {}; let imgDataUrls = {}; let isDraggingFov = false; let previousMenu = "MAIN_MENU";

// Audio System Globals
let audioCtx = null, reverbNode = null, isPlayingMusic = false;

// Inventory & State Globals
let inventory = Array(36).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let crafting2x2 = Array(4).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let crafting3x3 = Array(9).fill(null).map(() => ({type: null, count: 0, damage: 0}));
let activeSlot = 0, dragItem = null, gameState = "MAIN_MENU", drops = [];
let miningTarget = null, miningProgress = 0, miningSoundTimer = 0;
let chatLog = [];

// Engine Globals (Shared)
const voxels = new Map(); 
const dynamicBlocks = new Map(); 
const chunks = new Map();
let RENDER_DIST = optRender; 
const CHUNK_SIZE = 8; 
const transparentBlocks = ['oak_leaves', 'birch_leaves', 'torch', 'oak_sapling', 'birch_sapling', 'dead_bush', 'short_grass', 'dandelion', 'rose'];
const authenticSplashes = ["Version 1.01.8!", "Don't starve!", "Chests added!", "Achievements!"];

const creativeCategories = {
    'blocks': ['stone', 'cobblestone', 'dirt', 'grass', 'sand', 'gravel', 'oak_log', 'birch_log', 'oak_planks', 'birch_planks', 'oak_leaves', 'birch_leaves', 'cactus', 'bedrock', 'coal_ore', 'iron_ore', 'gold_ore', 'lapis_ore', 'redstone_ore', 'diamond_ore', 'emerald_ore', 'coal_block', 'iron_block', 'gold_block', 'lapis_block', 'redstone_block', 'diamond_block', 'emerald_block', 'furnace', 'chest', 'crafting_table', 'torch', 'oak_sapling', 'birch_sapling', 'dead_bush', 'short_grass', 'dandelion', 'rose'],
    'items': ['coal', 'charcoal', 'raw_iron', 'iron_ingot', 'raw_gold', 'gold_ingot', 'lapis_lazuli', 'redstone', 'diamond', 'emerald', 'stick', 'apple', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe', 'diamond_pickaxe', 'wooden_axe', 'stone_axe', 'iron_axe', 'golden_axe', 'diamond_axe', 'wooden_shovel', 'stone_shovel', 'iron_shovel', 'golden_shovel', 'diamond_shovel', 'wooden_sword', 'stone_sword', 'iron_sword', 'golden_sword', 'diamond_sword', 'wooden_hoe', 'stone_hoe', 'iron_hoe', 'golden_hoe', 'diamond_hoe']
};
let activeCreativeTab = 'blocks';

let activeFurnacePos = null;
let activeChestPos = null;
