export const CLASSES = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    hpGrowth: 6,
    manaGrowth: 1,
    startingStats: { strength: 6, dexterity: 3, vitality: 6, intelligence: 1 },
    startingItems: ["rusty_sword", "leather_armor", "healing_potion"],
    quickSlots: ["power_strike", "guard_break", "healing_potion"],
    abilities: ["power_strike", "guard_break"],
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    hpGrowth: 3,
    manaGrowth: 5,
    startingStats: { strength: 1, dexterity: 3, vitality: 3, intelligence: 7 },
    startingItems: ["apprentice_staff", "cloth_robe", "mana_potion", "healing_potion", "magic_missile_tome"],
    quickSlots: ["magic_missile", "arcane_shield", "mana_potion"],
    abilities: ["magic_missile", "arcane_shield"],
  },
};

export const SKILL_TREES = {
  warrior: [
    {
      id: "weapon_mastery",
      name: "Weapon Mastery",
      skills: [
        { id: "warrior_weapon_1", name: "Heavy Swing", description: "+10% melee damage.", effect: { stat: "meleeDamagePct", value: 10 } },
        { id: "warrior_weapon_2", name: "Battle Rhythm", description: "Gain momentum after a kill.", effect: { stat: "killMomentum", value: 2 } },
        { id: "warrior_weapon_3", name: "Crushing Blows", description: "+10% crit chance.", effect: { stat: "critBonus", value: 10 } },
        { id: "warrior_weapon_4", name: "Cleaving Strike", description: "Power Strike deals splash damage.", effect: { stat: "cleave", value: 0.25 } },
        { id: "warrior_weapon_5", name: "Executioner", description: "+25% damage to low-health enemies.", effect: { stat: "executioner", value: 25 } },
      ],
    },
    {
      id: "iron_guard",
      name: "Iron Guard",
      skills: [
        { id: "warrior_guard_1", name: "Toughness", description: "+10 max HP.", effect: { stat: "maxHpFlat", value: 10 } },
        { id: "warrior_guard_2", name: "Armor Training", description: "+2 defense.", effect: { stat: "defenseFlat", value: 2 } },
        { id: "warrior_guard_3", name: "Shielded Stance", description: "Waiting grants guard.", effect: { stat: "waitDefense", value: 2 } },
        { id: "warrior_guard_4", name: "Unyielding", description: "Reduce the first hit on each floor.", effect: { stat: "firstHitReduction", value: 0.5 } },
        { id: "warrior_guard_5", name: "Juggernaut", description: "Gain damage when badly wounded.", effect: { stat: "lowHpDamagePct", value: 15 } },
      ],
    },
    {
      id: "vanguard_tactics",
      name: "Vanguard Tactics",
      skills: [
        { id: "warrior_tactic_1", name: "Combat Footing", description: "+5 accuracy and +10% trap avoidance.", effect: { stat: "accuracyFlat", value: 5 } },
        { id: "warrior_tactic_2", name: "Brace", description: "-25% trap damage.", effect: { stat: "trapReductionPct", value: 25 } },
        { id: "warrior_tactic_3", name: "Charge", description: "Power Strike reaches 2 tiles in a line.", effect: { stat: "chargeRange", value: 2 } },
        { id: "warrior_tactic_4", name: "Disrupting Strike", description: "Melee hits weaken enemies.", effect: { stat: "weakenOnHit", value: 1 } },
        { id: "warrior_tactic_5", name: "Warlord's Advance", description: "Gain +15% damage after moving into melee.", effect: { stat: "advanceDamagePct", value: 15 } },
      ],
    },
  ],
  wizard: [
    {
      id: "elemental_power",
      name: "Elemental Power",
      skills: [
        { id: "wizard_power_1", name: "Empowered Casting", description: "+10% spell damage.", effect: { stat: "spellDamagePct", value: 10 } },
        { id: "wizard_power_2", name: "Focused Arcana", description: "+5 spell accuracy.", effect: { stat: "spellAccuracyFlat", value: 5 } },
        { id: "wizard_power_3", name: "Elemental Surge", description: "First spell in combat deals more damage.", effect: { stat: "firstSpellPct", value: 25 } },
        { id: "wizard_power_4", name: "Arcane Overflow", description: "20% chance for damage spells to cost 0 mana.", effect: { stat: "freeCastChance", value: 0.2 } },
        { id: "wizard_power_5", name: "Master Evocation", description: "Bonus damage to healthy or weak enemies.", effect: { stat: "evocationBonus", value: 20 } },
      ],
    },
    {
      id: "mystic_ward",
      name: "Mystic Ward",
      skills: [
        { id: "wizard_ward_1", name: "Arcane Reserves", description: "+10 max mana.", effect: { stat: "maxManaFlat", value: 10 } },
        { id: "wizard_ward_2", name: "Mana Shielding", description: "Above 50% mana, gain +1 defense.", effect: { stat: "manaShieldDefense", value: 1 } },
        { id: "wizard_ward_3", name: "Steady Mind", description: "Utility spells cost 1 less mana.", effect: { stat: "utilityDiscount", value: 1 } },
        { id: "wizard_ward_4", name: "Reactive Ward", description: "Gain a small barrier after first damage.", effect: { stat: "reactiveWard", value: 6 } },
        { id: "wizard_ward_5", name: "Archmage's Barrier", description: "Emergency damage reduction once per floor.", effect: { stat: "archmageBarrier", value: 0.25 } },
      ],
    },
    {
      id: "control_insight",
      name: "Control and Insight",
      skills: [
        { id: "wizard_control_1", name: "Arcane Sight", description: "Reveal nearby traps sooner.", effect: { stat: "trapSense", value: 2 } },
        { id: "wizard_control_2", name: "Lingering Hex", description: "Control effects last longer.", effect: { stat: "controlDuration", value: 1 } },
        { id: "wizard_control_3", name: "Blink Adept", description: "Blink gains range.", effect: { stat: "blinkRange", value: 1 } },
        { id: "wizard_control_4", name: "Frailty Curse", description: "Control spells expose enemies.", effect: { stat: "frailtyCurse", value: 15 } },
        { id: "wizard_control_5", name: "Battlefield Savant", description: "First utility spell each fight is free.", effect: { stat: "freeUtility", value: 1 } },
      ],
    },
  ],
};

export const SPELLS = {
  power_strike: {
    id: "power_strike",
    name: "Power Strike",
    type: "ability",
    cost: 1,
    range: 1,
    description: "Heavy melee strike with bonus damage.",
  },
  guard_break: {
    id: "guard_break",
    name: "Guard Break",
    type: "ability",
    cost: 2,
    range: 1,
    description: "A crushing melee hit that sunders enemy defense.",
  },
  magic_missile: {
    id: "magic_missile",
    name: "Magic Missile",
    type: "spell",
    cost: 3,
    range: 4,
    damage: [4, 7],
    description: "Reliable ranged spell.",
  },
  arcane_shield: {
    id: "arcane_shield",
    name: "Arcane Shield",
    type: "spell",
    cost: 4,
    range: 0,
    description: "Gain +2 defense for 3 turns.",
  },
  frost_shard: {
    id: "frost_shard",
    name: "Frost Shard",
    type: "spell",
    cost: 4,
    range: 5,
    damage: [6, 9],
    description: "A stronger ranged spell that chills and strikes hard.",
  },
  blink: {
    id: "blink",
    name: "Blink",
    type: "spell",
    cost: 3,
    range: 0,
    description: "Teleport to a safe nearby tile.",
  },
  arcane_burst: {
    id: "arcane_burst",
    name: "Arcane Burst",
    type: "spell",
    cost: 6,
    range: 4,
    damage: [8, 12],
    description: "Explosive arcane blast with heavy single-target damage.",
  },
};

export const ITEMS = {
  rusty_sword: { id: "rusty_sword", name: "Rusty Sword", category: "weapon", slot: "weapon", classBias: "warrior", damage: [4, 7], accuracy: 5, value: 14 },
  iron_sword: { id: "iron_sword", name: "Iron Sword", category: "weapon", slot: "weapon", classBias: "warrior", damage: [5, 8], accuracy: 5, value: 28 },
  raider_axe: { id: "raider_axe", name: "Raider Axe", category: "weapon", slot: "weapon", classBias: "warrior", damage: [5, 8], accuracy: -5, value: 24 },
  flame_touched_sword: { id: "flame_touched_sword", name: "Flame-Touched Sword", category: "weapon", slot: "weapon", classBias: "warrior", damage: [6, 9], accuracy: 5, rarity: "rare", value: 56, enchantment: { type: "onHitBonusDamage", value: 2 }, description: "Enchantment: each melee hit deals 2 bonus damage." },
  vampire_axe: { id: "vampire_axe", name: "Vampire Axe", category: "weapon", slot: "weapon", classBias: "warrior", damage: [7, 10], accuracy: -2, rarity: "rare", value: 62, enchantment: { type: "lifesteal", value: 2 }, description: "Enchantment: recover 2 HP whenever a melee hit lands." },
  steel_greatsword: { id: "steel_greatsword", name: "Steel Greatsword", category: "weapon", slot: "weapon", classBias: "warrior", damage: [7, 11], accuracy: 3, value: 48 },
  war_hammer: { id: "war_hammer", name: "War Hammer", category: "weapon", slot: "weapon", classBias: "warrior", damage: [8, 12], accuracy: -3, bonus: { defenseFlat: 1 }, value: 58 },
  sundering_hammer: { id: "sundering_hammer", name: "Sundering Hammer", category: "weapon", slot: "weapon", classBias: "warrior", damage: [8, 11], accuracy: -2, rarity: "rare", value: 66, bonus: { defenseFlat: 1 }, enchantment: { type: "sunderChance", chance: 0.4, turns: 3, value: 1 }, description: "Enchantment: melee hits have a 40% chance to Sunder the target." },
  sunfire_blade: { id: "sunfire_blade", name: "Sunfire Blade", category: "weapon", slot: "weapon", classBias: "warrior", damage: [9, 13], accuracy: 4, rarity: "boss", value: 96, bonus: { meleeDamagePct: 8 }, enchantment: { type: "onHitBonusDamage", value: 3 }, description: "Enchantment: blazing strikes deal 3 bonus damage and hit harder overall." },
  soulreaver_axe: { id: "soulreaver_axe", name: "Soulreaver Axe", category: "weapon", slot: "weapon", classBias: "warrior", damage: [10, 14], accuracy: -1, rarity: "boss", value: 98, bonus: { maxHpFlat: 8 }, enchantment: { type: "lifesteal", value: 3 }, description: "Enchantment: each heavy hit restores 3 HP." },
  captains_blade: { id: "captains_blade", name: "Captain's Blade", category: "weapon", slot: "weapon", classBias: "warrior", damage: [7, 10], accuracy: 5, rarity: "boss", value: 70 },
  apprentice_staff: { id: "apprentice_staff", name: "Apprentice Staff", category: "weapon", slot: "weapon", classBias: "wizard", damage: [1, 3], magicPower: 1, value: 14 },
  oak_staff: { id: "oak_staff", name: "Oak Staff", category: "weapon", slot: "weapon", classBias: "wizard", damage: [2, 4], magicPower: 2, value: 28 },
  crystal_wand: { id: "crystal_wand", name: "Crystal Wand", category: "weapon", slot: "weapon", classBias: "wizard", damage: [1, 3], magicPower: 3, value: 34 },
  runic_staff: { id: "runic_staff", name: "Runic Staff", category: "weapon", slot: "weapon", classBias: "wizard", damage: [3, 5], magicPower: 4, rarity: "rare", value: 58, enchantment: { type: "spellBonusDamage", value: 2 }, description: "Enchantment: spells deal 2 bonus damage on hit." },
  elder_staff: { id: "elder_staff", name: "Elder Staff", category: "weapon", slot: "weapon", classBias: "wizard", damage: [3, 5], magicPower: 4, value: 52 },
  sage_wand: { id: "sage_wand", name: "Sage Wand", category: "weapon", slot: "weapon", classBias: "wizard", damage: [2, 4], magicPower: 4, rarity: "rare", value: 64, enchantment: { type: "manaRefundChance", chance: 0.35, value: 2 }, description: "Enchantment: spells have a 35% chance to refund 2 mana after hitting." },
  storm_wand: { id: "storm_wand", name: "Storm Wand", category: "weapon", slot: "weapon", classBias: "wizard", damage: [2, 4], magicPower: 5, bonus: { spellDamagePct: 8 }, value: 60 },
  voidglass_staff: { id: "voidglass_staff", name: "Voidglass Staff", category: "weapon", slot: "weapon", classBias: "wizard", damage: [4, 6], magicPower: 6, rarity: "boss", value: 96, bonus: { spellDamagePct: 12 }, enchantment: { type: "spellBonusDamage", value: 3 }, description: "Enchantment: spells strike with 3 extra void damage." },
  astral_wand: { id: "astral_wand", name: "Astral Wand", category: "weapon", slot: "weapon", classBias: "wizard", damage: [3, 5], magicPower: 6, rarity: "boss", value: 98, bonus: { spellAccuracyFlat: 6 }, enchantment: { type: "manaRefundChance", chance: 0.45, value: 3 }, description: "Enchantment: precise spell hits often refund 3 mana." },
  ember_staff: { id: "ember_staff", name: "Ember Staff", category: "weapon", slot: "weapon", classBias: "wizard", damage: [2, 4], magicPower: 3, rarity: "boss", bonus: { spellDamagePct: 10 }, value: 72 },
  leather_armor: { id: "leather_armor", name: "Leather Armor", category: "armor", slot: "armor", defense: 2, value: 16 },
  chain_armor: { id: "chain_armor", name: "Chain Armor", category: "armor", slot: "armor", defense: 3, evasion: -1, value: 30 },
  guardian_plate: { id: "guardian_plate", name: "Guardian Plate", category: "armor", slot: "armor", defense: 5, bonus: { maxHpFlat: 12 }, value: 64 },
  abyssal_plate: { id: "abyssal_plate", name: "Abyssal Plate", category: "armor", slot: "armor", defense: 6, bonus: { maxHpFlat: 16, defenseFlat: 1 }, rarity: "boss", value: 94 },
  bulwark_armor: { id: "bulwark_armor", name: "Bulwark Armor", category: "armor", slot: "armor", defense: 4, bonus: { maxHpFlat: 8 }, rarity: "boss", value: 80 },
  cloth_robe: { id: "cloth_robe", name: "Cloth Robe", category: "armor", slot: "armor", defense: 1, value: 16 },
  enchanted_robe: { id: "enchanted_robe", name: "Enchanted Robe", category: "armor", slot: "armor", defense: 1, bonus: { maxManaFlat: 5 }, value: 30 },
  archmage_robe: { id: "archmage_robe", name: "Archmage Robe", category: "armor", slot: "armor", defense: 2, bonus: { maxManaFlat: 12, intelligenceFlat: 1 }, value: 66 },
  starweave_robe: { id: "starweave_robe", name: "Starweave Robe", category: "armor", slot: "armor", defense: 3, bonus: { maxManaFlat: 16, intelligenceFlat: 2 }, rarity: "boss", value: 94 },
  robe_of_the_adept: { id: "robe_of_the_adept", name: "Robe of the Adept", category: "armor", slot: "armor", defense: 1, bonus: { maxManaFlat: 10, intelligenceFlat: 1 }, rarity: "boss", value: 80 },
  ring_of_precision: { id: "ring_of_precision", name: "Ring of Precision", category: "accessory", slot: "accessory", bonus: { accuracyFlat: 5 }, value: 40 },
  amulet_of_vitality: { id: "amulet_of_vitality", name: "Amulet of Vitality", category: "accessory", slot: "accessory", bonus: { maxHpFlat: 10 }, value: 42 },
  charm_of_focus: { id: "charm_of_focus", name: "Charm of Focus", category: "accessory", slot: "accessory", bonus: { magicPowerFlat: 2 }, value: 42 },
  sigil_of_fortune: { id: "sigil_of_fortune", name: "Sigil of Fortune", category: "accessory", slot: "accessory", bonus: { accuracyFlat: 3, maxManaFlat: 6, maxHpFlat: 6 }, value: 72 },
  void_heart: { id: "void_heart", name: "Void Heart", category: "accessory", slot: "accessory", bonus: { maxHpFlat: 10, maxManaFlat: 10, magicPowerFlat: 2, accuracyFlat: 4 }, rarity: "boss", value: 102 },
  healing_potion: { id: "healing_potion", name: "Healing Potion", category: "consumable", effect: { type: "heal", value: 10 }, value: 12 },
  greater_healing_potion: { id: "greater_healing_potion", name: "Greater Healing Potion", category: "consumable", effect: { type: "heal", value: 18 }, value: 24 },
  mana_potion: { id: "mana_potion", name: "Mana Potion", category: "consumable", effect: { type: "mana", value: 8 }, value: 14 },
  greater_mana_potion: { id: "greater_mana_potion", name: "Greater Mana Potion", category: "consumable", effect: { type: "mana", value: 14 }, value: 26 },
  scroll_of_escape: { id: "scroll_of_escape", name: "Scroll of Escape", category: "consumable", effect: { type: "escape" }, value: 28 },
  magic_missile_tome: { id: "magic_missile_tome", name: "Tome of Magic Missile", category: "tome", spellId: "magic_missile", value: 28 },
  arcane_shield_tome: { id: "arcane_shield_tome", name: "Tome of Arcane Shield", category: "tome", spellId: "arcane_shield", value: 34 },
  frost_shard_tome: { id: "frost_shard_tome", name: "Tome of Frost Shard", category: "tome", spellId: "frost_shard", value: 46 },
  blink_tome: { id: "blink_tome", name: "Tome of Blink", category: "tome", spellId: "blink", value: 44 },
  arcane_burst_tome: { id: "arcane_burst_tome", name: "Tome of Arcane Burst", category: "tome", spellId: "arcane_burst", value: 58 },
};

export const ENEMIES = {
  rat: { id: "rat", name: "Rat", behavior: "melee", hp: 8, damage: [2, 3], accuracy: 75, defense: 0, xp: 5, gold: [2, 5], glyph: "R" },
  goblin: { id: "goblin", name: "Goblin", behavior: "skirmisher", hp: 12, damage: [2, 4], accuracy: 85, defense: 0, evasion: 3, xp: 8, gold: [4, 8], glyph: "G" },
  slime: { id: "slime", name: "Slime", behavior: "blocker", hp: 16, damage: [2, 3], accuracy: 70, defense: 2, xp: 9, gold: [3, 7], glyph: "S" },
  skeleton: { id: "skeleton", name: "Skeleton", behavior: "melee", hp: 14, damage: [3, 5], accuracy: 80, defense: 1, xp: 12, gold: [5, 9], glyph: "K" },
  cultist: { id: "cultist", name: "Cultist", behavior: "caster", hp: 10, damage: [4, 6], accuracy: 85, defense: 0, xp: 15, gold: [6, 10], glyph: "C", range: 5 },
  orc_brute: { id: "orc_brute", name: "Orc Brute", behavior: "melee", hp: 20, damage: [4, 7], accuracy: 79, defense: 2, xp: 22, gold: [8, 14], glyph: "O" },
  gloomblade: { id: "gloomblade", name: "Gloomblade", behavior: "skirmisher", hp: 16, damage: [4, 6], accuracy: 86, defense: 1, evasion: 4, xp: 24, gold: [8, 13], glyph: "A" },
  dread_slime: { id: "dread_slime", name: "Dread Slime", behavior: "blocker", hp: 23, damage: [4, 5], accuracy: 76, defense: 2, xp: 25, gold: [7, 12], glyph: "D" },
  shaman: { id: "shaman", name: "Orc Shaman", behavior: "caster", hp: 16, damage: [5, 7], accuracy: 84, defense: 1, xp: 28, gold: [10, 16], glyph: "H", range: 6 },
  chort: { id: "chort", name: "Chort", behavior: "melee", hp: 26, damage: [6, 8], accuracy: 82, defense: 2, xp: 34, gold: [12, 18], glyph: "T" },
  infernal_imp: { id: "infernal_imp", name: "Infernal Imp", behavior: "caster", hp: 18, damage: [5, 8], accuracy: 87, defense: 1, xp: 38, gold: [12, 18], glyph: "I", range: 6 },
  void_stalker: { id: "void_stalker", name: "Void Stalker", behavior: "skirmisher", hp: 24, damage: [6, 9], accuracy: 89, defense: 2, evasion: 5, xp: 42, gold: [13, 20], glyph: "V" },
  doom_ogre: { id: "doom_ogre", name: "Doom Ogre", behavior: "blocker", hp: 33, damage: [7, 10], accuracy: 81, defense: 4, xp: 46, gold: [16, 24], glyph: "O" },
  abyssal_overlord: { id: "abyssal_overlord", name: "Abyssal Overlord", behavior: "boss", hp: 104, damage: [8, 13], accuracy: 88, defense: 5, xp: 160, gold: [60, 96], glyph: "M", range: 6 },
  bone_captain: { id: "bone_captain", name: "Bone Captain", behavior: "boss", hp: 54, damage: [6, 9], accuracy: 85, defense: 3, xp: 60, gold: [25, 40], glyph: "B" },
};

export const FLOOR_CONFIGS = {
  1: { width: 32, height: 24, rooms: [6, 7], enemies: [4, 5], traps: [1, 1], vendorChance: 0 },
  2: { width: 34, height: 24, rooms: [6, 7], enemies: [4, 5], traps: [1, 2], vendorChance: 0 },
  3: { width: 36, height: 25, rooms: [7, 8], enemies: [5, 6], traps: [2, 3], vendorChance: 0.15 },
  4: { width: 38, height: 26, rooms: [7, 8], enemies: [5, 6], traps: [2, 4], vendorChance: 0.2 },
  5: { width: 40, height: 28, rooms: [8, 9], enemies: [6, 7], traps: [3, 4], vendorChance: 0.25 },
  6: { width: 42, height: 28, rooms: [8, 9], enemies: [6, 7], traps: [3, 5], vendorChance: 0.25 },
  7: { width: 44, height: 30, rooms: [8, 10], enemies: [7, 8], traps: [4, 5], vendorChance: 0.3, eliteChance: 0.2 },
  8: { width: 46, height: 30, rooms: [8, 10], enemies: [7, 8], traps: [4, 6], vendorChance: 0.3, eliteChance: 0.24 },
  9: { width: 48, height: 31, rooms: [9, 10], enemies: [8, 8], traps: [5, 6], vendorChance: 0.3, eliteChance: 0.28 },
  11: { width: 50, height: 32, rooms: [9, 10], enemies: [8, 9], traps: [5, 7], vendorChance: 0.32, eliteChance: 0.34 },
  12: { width: 50, height: 33, rooms: [9, 11], enemies: [8, 9], traps: [5, 7], vendorChance: 0.32, eliteChance: 0.36 },
  13: { width: 52, height: 34, rooms: [10, 11], enemies: [8, 10], traps: [6, 8], vendorChance: 0.34, eliteChance: 0.38 },
  14: { width: 52, height: 34, rooms: [10, 11], enemies: [9, 10], traps: [6, 8], vendorChance: 0.34, eliteChance: 0.4 },
  15: { width: 54, height: 35, rooms: [10, 12], enemies: [8, 10], traps: [6, 9], vendorChance: 0.35, eliteChance: 0.38 },
  16: { width: 54, height: 36, rooms: [10, 12], enemies: [8, 10], traps: [7, 9], vendorChance: 0.35, eliteChance: 0.4 },
  17: { width: 56, height: 36, rooms: [11, 12], enemies: [9, 10], traps: [7, 10], vendorChance: 0.36, eliteChance: 0.42 },
  18: { width: 56, height: 37, rooms: [11, 12], enemies: [9, 10], traps: [7, 10], vendorChance: 0.36, eliteChance: 0.44 },
  19: { width: 58, height: 38, rooms: [11, 13], enemies: [9, 11], traps: [8, 10], vendorChance: 0.38, eliteChance: 0.46 },
  20: { width: 58, height: 38, rooms: [11, 13], enemies: [10, 11], traps: [8, 11], vendorChance: 0.38, eliteChance: 0.5 },
  21: { width: 60, height: 39, rooms: [11, 13], enemies: [9, 10], traps: [8, 10], vendorChance: 0.42, eliteChance: 0.46 },
  22: { width: 60, height: 39, rooms: [11, 13], enemies: [9, 10], traps: [8, 10], vendorChance: 0.42, eliteChance: 0.48 },
  23: { width: 62, height: 40, rooms: [11, 13], enemies: [9, 11], traps: [8, 11], vendorChance: 0.44, eliteChance: 0.5 },
  24: { width: 62, height: 40, rooms: [12, 13], enemies: [10, 11], traps: [9, 11], vendorChance: 0.44, eliteChance: 0.52 },
  25: { width: 64, height: 41, rooms: [12, 14], enemies: [10, 11], traps: [9, 11], vendorChance: 0.46, eliteChance: 0.54 },
  26: { width: 64, height: 41, rooms: [12, 14], enemies: [10, 12], traps: [9, 11], vendorChance: 0.46, eliteChance: 0.56 },
  27: { width: 66, height: 42, rooms: [12, 14], enemies: [10, 12], traps: [9, 12], vendorChance: 0.48, eliteChance: 0.58 },
  28: { width: 66, height: 42, rooms: [12, 14], enemies: [11, 12], traps: [10, 12], vendorChance: 0.48, eliteChance: 0.6 },
  29: { width: 68, height: 43, rooms: [13, 14], enemies: [11, 12], traps: [10, 12], vendorChance: 0.5, eliteChance: 0.62 },
};

export const FLOOR_ENCOUNTERS = {
  early: [["rat", "rat"], ["goblin"], ["slime"], ["goblin", "rat"]],
  mid: [["skeleton"], ["goblin", "goblin"], ["slime", "rat"], ["skeleton", "goblin"]],
  late: [["cultist", "slime"], ["cultist", "goblin"], ["skeleton", "skeleton"], ["cultist", "skeleton", "goblin"]],
  deep: [["orc_brute"], ["gloomblade", "skeleton"], ["dread_slime", "cultist"], ["shaman", "orc_brute"], ["gloomblade", "gloomblade"], ["shaman", "skeleton", "cultist"]],
  abyssal: [["chort"], ["shaman", "dread_slime"], ["orc_brute", "gloomblade", "shaman"], ["chort", "cultist"], ["dread_slime", "gloomblade", "gloomblade"]],
  endgame: [
    ["doom_ogre"],
    ["infernal_imp", "void_stalker"],
    ["doom_ogre", "infernal_imp"],
    ["chort", "void_stalker", "infernal_imp"],
    ["doom_ogre", "void_stalker"],
    ["doom_ogre", "infernal_imp", "infernal_imp"],
    ["chort", "doom_ogre"],
  ],
};

export const ROOM_ENCOUNTERS = {
  treasure: {
    late: [["cultist", "skeleton"], ["cultist", "goblin"], ["skeleton", "skeleton"]],
    deep: [["orc_brute", "cultist"], ["gloomblade", "skeleton"], ["dread_slime", "cultist"]],
    abyssal: [["chort", "cultist"], ["orc_brute", "gloomblade"], ["dread_slime", "shaman"]],
    endgame: [["void_stalker", "infernal_imp"], ["doom_ogre", "infernal_imp"], ["chort", "void_stalker"]],
  },
  trap: {
    late: [["slime", "cultist"], ["cultist", "goblin", "goblin"], ["skeleton", "cultist"]],
    deep: [["dread_slime", "cultist"], ["orc_brute", "shaman"], ["gloomblade", "gloomblade"]],
    abyssal: [["dread_slime", "shaman"], ["orc_brute", "gloomblade", "shaman"], ["chort", "cultist"]],
    endgame: [["doom_ogre", "infernal_imp"], ["void_stalker", "void_stalker", "infernal_imp"], ["doom_ogre", "chort"]],
  },
  elite: {
    late: [["skeleton", "cultist", "goblin"], ["skeleton", "skeleton", "cultist"]],
    deep: [["orc_brute", "gloomblade"], ["dread_slime", "shaman"], ["orc_brute", "cultist", "gloomblade"]],
    abyssal: [["chort", "shaman"], ["dread_slime", "gloomblade", "gloomblade"], ["orc_brute", "gloomblade", "shaman"]],
    endgame: [["doom_ogre", "void_stalker"], ["infernal_imp", "infernal_imp", "doom_ogre"], ["chort", "void_stalker", "infernal_imp"]],
  },
};

export const TRAPS = {
  spikes: { id: "spikes", name: "Spike Trap", damage: [4, 6], glyph: "^" },
  darts: { id: "darts", name: "Poison Dart Trap", damage: [3, 5], glyph: "!" },
  fire: { id: "fire", name: "Fire Trap", damage: [5, 8], glyph: "*" },
  curse: { id: "curse", name: "Curse Trap", damage: [2, 4], glyph: "C", status: "hexed" },
  alarm: { id: "alarm", name: "Alarm Trap", damage: [0, 0], glyph: "A", alerts: true },
};

export const STATUS_DEFINITIONS = {
  chilled: { id: "chilled", name: "Chilled", icon: "C" },
  sundered: { id: "sundered", name: "Sundered", icon: "S" },
  weakened: { id: "weakened", name: "Weakened", icon: "W" },
  hexed: { id: "hexed", name: "Hexed", icon: "H" },
  arcane_shield: { id: "arcane_shield", name: "Arcane Shield", icon: "A" },
};

export const CHEST_TABLE = {
  common: ["healing_potion", "mana_potion", "iron_sword", "oak_staff", "chain_armor", "enchanted_robe"],
  rare: ["ring_of_precision", "amulet_of_vitality", "charm_of_focus", "greater_healing_potion", "greater_mana_potion", "scroll_of_escape", "arcane_shield_tome", "frost_shard_tome"],
  deep: ["steel_greatsword", "war_hammer", "flame_touched_sword", "vampire_axe", "sundering_hammer", "elder_staff", "runic_staff", "sage_wand", "storm_wand", "guardian_plate", "archmage_robe", "sigil_of_fortune", "blink_tome", "arcane_burst_tome"],
  endgame: ["sunfire_blade", "soulreaver_axe", "voidglass_staff", "astral_wand", "abyssal_plate", "starweave_robe", "void_heart"],
};

export const BOSS_REWARDS = {
  warrior: ["captains_blade", "bulwark_armor"],
  wizard: ["ember_staff", "robe_of_the_adept"],
  neutral: ["ring_of_precision", "amulet_of_vitality", "charm_of_focus"],
};

export const FINAL_BOSS_REWARDS = {
  warrior: ["sunfire_blade", "soulreaver_axe", "abyssal_plate"],
  wizard: ["voidglass_staff", "astral_wand", "starweave_robe"],
  neutral: ["void_heart", "sigil_of_fortune"],
};
