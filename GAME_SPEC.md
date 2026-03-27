# Retro RPG Adventure Spec

## Overview

Retro RPG Adventure is a single-player, turn-based, retro pixel-art roguelike RPG.

The player chooses a class and attempts a full dungeon run from Floor 1 to Floor 30. Death is permanent for the current run. A new run always restarts on Floor 1 with a newly generated dungeon.

Current project status:
- Milestone 1: complete
- Milestone 2: complete as a polished vertical slice through Floor 20
- Milestone 3: in active endgame polish

## Core Run Structure

- One run starts on Floor 1
- Floors are procedurally generated
- Death ends the run immediately
- No permanent progression carries between runs
- The game now scaffolds a full run through Floor 30
- Floors 21-29 and the Floor 30 boss path are implemented
- Endgame enemies, endgame rewards, and a phased final boss are now live

## Class Design

### Warrior

Role:
- durable melee front-liner

Identity:
- high HP growth
- strong melee scaling
- low mana growth
- active-ability driven combat

Implemented starting kit:
- Rusty Sword
- Leather Armor
- Healing Potion
- Power Strike
- Guard Break

Implemented Warrior build traits:
- kill momentum after takedowns
- cleave through Power Strike
- extended Power Strike reach through Charge
- weaken-on-hit support
- low-HP damage boosts
- wait-based defense

### Wizard

Role:
- fragile ranged spellcaster

Identity:
- lower HP growth
- strong mana growth
- high spell scaling
- utility and control tools

Implemented starting kit:
- Apprentice Staff
- Cloth Robe
- Mana Potion
- Healing Potion
- Tome of Magic Missile
- Magic Missile
- Arcane Shield

Implemented Wizard build traits:
- spell damage scaling
- spell accuracy scaling
- longer control effects
- free utility casting at encounter start
- mana-based defensive scaling
- bonus spell damage against controlled or high/low-health targets

## Leveling and Progression

- Max level: 10
- Skill points: 1 per level-up after Level 1
- Skill trees: 3 branches per class, 5 skills deep per branch
- No respec during a run

Current XP thresholds:
- Level 2: 80
- Level 3: 220
- Level 4: 500
- Level 5: 1050
- Level 6: 1800
- Level 7: 2700
- Level 8: 3900
- Level 9: 5300
- Level 10: 7000

Target pacing:
- around Level 4 by Floor 10
- around Level 8 by Floor 20
- Level 10 reserved for the full late game

## Combat Model

- Strictly turn-based
- One player action per turn
- Enemies act after the player
- Grid/tile-based movement and combat
- Line of sight matters for ranged combat and detection

Player actions:
- move
- melee attack
- cast spell
- use item
- equip item
- interact
- wait

## Current Spells and Abilities

### Warrior

- Power Strike
  - cheap melee burst
  - can gain extended reach through Charge
  - can cleave through skill investment

- Guard Break
  - melee strike
  - applies Sundered

### Wizard

- Magic Missile
  - reliable low-cost ranged damage

- Arcane Shield
  - defensive utility spell

- Frost Shard
  - stronger ranged damage
  - applies Chilled

- Blink
  - reposition utility spell

- Arcane Burst
  - heavier single-target burst
  - applies Weakened

## Status Effects

Implemented statuses:
- Chilled
  - reduces accuracy
- Sundered
  - reduces defense
- Weakened
  - reduces outgoing damage
- Hexed
  - reduces player defense
- Arcane Shield
  - temporary defensive state

UX behavior:
- status badges in HUD/target panels
- status pips above actors
- status fade messages in combat log

## Equipment and Loot

Implemented item categories:
- weapons
- armor
- accessories
- consumables
- tomes

Rarity presentation:
- common
- uncommon
- rare
- boss

Loot philosophy after Milestone 2 tuning:
- fewer random enemy item drops
- more meaningful chest rewards
- more reliable floor pickups
- stronger vendor moments
- class-biased loot pools in midgame generation

Current endgame reward additions:
- enchanted endgame-tier Warrior weapons
- enchanted endgame-tier Wizard weapons
- late-game armor upgrades for both classes
- Void Heart as a final-tier accessory
- final reward chest after the Abyssal Overlord

## Inventory and Vendor UX

Implemented UX decisions:
- inventory comparison pane
- vendor comparison pane
- item rarity/category badges
- stat chip summaries
- equipped-versus-candidate comparison tables
- sell values visible in shop
- stacked inventory UI for duplicate items
- stacked vendor sell list for duplicate items

Stacks are currently UI-only:
- underlying inventory still stores individual entries
- using or selling from a stack consumes one underlying item

## Dungeon Generation

Generation style:
- seeded procedural generation
- room-and-corridor layout
- connected traversal guaranteed

Implemented room types:
- normal
- treasure
- trap
- elite
- shrine
- vendor

Current encounter design rules:
- room type influences encounter pool
- elite/trap/treasure rooms are prioritized for encounter placement
- vendor rooms are reserved before enemy placement
- shrine rooms remain safe utility spaces

## Floors 1-10

Purpose:
- establish the core roguelike loop
- teach class identity
- end with the Bone Captain mini-boss on Floor 10

Implemented boss:
- Bone Captain

Floor 10 remains the Milestone 1 capstone encounter.

## Floors 11-20

Purpose:
- deepen builds
- introduce stronger room identity
- increase tactical pressure
- serve as the Milestone 2 vertical slice

Implemented additions:
- new enemies
- elite variants
- shrine rooms
- curse/alarm traps
- stronger itemization
- more structured encounter pools

Current midgame enemy roster:
- Orc Brute
- Gloomblade
- Dread Slime
- Orc Shaman
- Chort

## Floors 21-29

Purpose:
- create a distinct endgame band before the final boss
- pressure Level 8-10 builds with more dangerous mixed encounters
- improve late-run loot and vendor value

Implemented endgame enemy roster:
- Infernal Imp
- Void Stalker
- Doom Ogre
- Chort
- selected late-game reused threats where needed

Implemented endgame tuning:
- separate endgame encounter pools
- softer late elite curve than the initial Milestone 3 scaffold
- stronger late vendors and chest rewards
- endgame-biased loot drops and item pools

## Floor 30

Purpose:
- deliver a bespoke final-boss floor
- gate full-run victory behind the Abyssal Overlord encounter

Implemented Floor 30 structure:
- entry room
- antechamber with sentries
- final boss arena
- reward chest after the boss
- exit stairs after clear

Implemented final boss:
- Abyssal Overlord
  - phase transition at half health
  - summons Infernal Imps
  - Abyssal Bolt ranged attack
  - melee cleave pressure
  - clearer log telegraphs and target-panel phase labeling

Milestone 2 balance decisions:
- deep-floor base enemy stats were softened
- elite HP, damage, and accuracy scaling were reduced
- Floors 15-20 encounter density was eased
- loot economy was shifted toward chests, floor pickups, and vendors

## Enemies and AI

Current AI behaviors:
- melee rush
- skirmisher
- blocker
- ranged caster
- boss behavior

Detection:
- enemies use sight-based aggro
- alerted enemies pursue the player
- casters attempt to hold preferred range

Enemy spell identity:
- Cultist uses Shadow Bolt and can inflict Weakened
- Orc Shaman uses Hexfire and can inflict Hexed

## UI and Feedback

Implemented screens:
- Main Menu
- Class Selection
- Gameplay HUD
- Inventory
- Character
- Skill Tree
- Vendor
- Quick Slot Loadout
- Death Screen
- Floor Transition Banner
- Floor 20 completion summary

Implemented critical health feedback:
- screen flash when entering critical HP
- persistent HP meter highlight below 20% HP

Overlay behavior:
- death and victory overlays are non-dismissible

## Art Direction

Current build uses integrated pixel-art assets from the local asset pack:
- player sprites
- enemy sprites
- floor and wall tiles
- chests
- stairs
- pickups
- vendor
- shrine
- animated actor presentation

## Milestone Status

### Milestone 1

Completed:
- class selection
- Floors 1-10
- procedural generation
- core combat
- inventory/equipment
- skills
- traps
- vendors
- death/reset
- Floor 10 boss

### Milestone 2

Completed:
- Floors 11-20
- expanded enemies and elite variants
- expanded spells and tomes
- encounter/room identity pass
- XP progression rebalance
- economy rebalance
- class/build balance pass
- inventory/vendor UX polish
- status-effect polish
- Floor 20 completion flow
- final stabilization pass

### Milestone 3

In progress:
- Floors 21-29 endgame encounter pools
- Floor 30 final boss floor
- Abyssal Overlord phased boss encounter
- endgame reward tier and final reward chest
- full-run victory flow after Floor 30

Still remaining:
- final endgame balance pass based on real playthroughs
- optional deeper boss telegraphs/visual effects
- final biome/theme variation
- ship-level polish and bug sweep

## Known Scope Boundary

The current project has entered Milestone 3, and the full run is now playable, but the endgame still needs final tuning and release-quality polish.

The next major implementation target is Milestone 3:
- finish endgame balance
- polish the final boss presentation
- stabilize the full Floor 1-30 run
