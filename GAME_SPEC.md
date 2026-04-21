# Dungeon 30: The Abyssal Throne Spec

## Overview

Dungeon 30: The Abyssal Throne is a single-player, turn-based, retro pixel-art roguelike RPG.

The player chooses one of two named delvers, descends from Floor 1 to Floor 30, and attempts to defeat the Abyssal Overlord on the final floor. Death is permanent for the current run. A new run always starts over on Floor 1 with a newly generated dungeon and no persistent power carried over.

Current project status:
- Milestone 1: complete
- Milestone 2: complete
- Milestone 3: playable end-to-end, with ongoing balance and polish

## Current Title and Branding

Current title:
- Dungeon 30: The Abyssal Throne

Current menu structure:
- New Run
- How to Play
- High Scores

## Lore Direction

The game should carry a dark, foreboding tone. The dungeon is not just a place of treasure and monsters. It is an ancient wound in the world, something sealed poorly and descended into repeatedly by fools, zealots, and the desperate.

The player is not framed as a guaranteed savior. Reaching Floor 30 and defeating the Abyssal Overlord should feel significant, but not universally pure or triumphant. A clear can still imply:
- a terrible cycle has only been delayed
- the delver has taken the throne's burden onto themselves
- the Grey Witness wanted this outcome all along
- something worse was sealed beneath the Overlord, not by it

Core narrative tone:
- oppressive
- mysterious
- fatalistic
- ambiguous rather than heroic
- sparse, but memorable

World assumptions:
- the dungeon predates the current kingdoms
- older civilizations attempted to seal, study, or worship what lies below
- each major floor band reflects a different age of ruin, corruption, or failed containment
- merchants, shrines, and relics imply the dungeon has been active for a very long time

## Narrative Anchors

### The Grey Witness

The Grey Witness is the first named figure the player meets. He should feel ancient, calm, and impossible to fully place on a moral axis.

Current role:
- presents the pre-run boon choice
- speaks in short, ominous lines
- fades away once the delver accepts a gift and begins the descent

Narrative intent:
- not clearly good
- not clearly evil
- possibly a jailer, a guide, a survivor, or an accomplice
- may want the delver to reach Floor 30 for reasons that remain uncertain
- may be helping the delver survive while also shaping them into a viable successor
- should always leave open the question: is the player using his help, or is he using the player?

### The Thirty Floors

The thirty-floor structure should feel deliberate, not arbitrary. A recommended interpretation is:
- Floors 1-9: outer ruins and collapsed undercrypts
- Floor 10: the first true seal, guarded by Super Skeletor and necromantic remains
- Floors 11-19: deeper halls where prior expeditions, cults, and failed defenders left their mark
- Floor 20: a second threshold, marked by body-horror ruin and Patches' domain
- Floors 21-29: void-touched depths where normal dungeon logic begins to break down
- Floor 30: the Abyssal Throne, where the dungeon's will is strongest

## Lore Prompts and Expandable Ideas

These are intentionally flexible prompts rather than fixed canon.

### 1. The Living Seal

The dungeon was built as a seal, but the seal was never stone alone. It required a conscious ruler at the bottom to contain what was beneath. The Abyssal Overlord may be a tyrant, a prisoner, or both.

Useful story implication:
- defeating the final boss may weaken the prison as much as it frees the world

### 2. The Grey Witness as the Last Custodian

The Grey Witness may be the final member of an order that once maintained the dungeon's wards. He now sends delvers downward not out of malice, but because the old system is failing and no clean solution remains.

Useful story implication:
- his gifts are real help, but also a form of recruitment or sacrifice

### 3. The Dungeon as a Grave of Civilizations

Each floor band could belong to a different fallen age:
- crypt-builders
- necromancer cults
- alchemists and flesh-stitchers
- void scholars

Useful story implication:
- enemy rosters, bosses, and floor themes each tell part of a buried history

### 4. The Throne Wants a Successor

The throne may not merely guard power; it may test candidates. The Overlord's death could be less a victory than a coronation the player never intended.

Useful story implication:
- a full clear ending can remain unsettling even when the boss is dead

### 4A. The Grey Witness and the Empty Throne

The Grey Witness may understand the true purpose of the Abyssal Throne better than anyone still living. If the throne is not only a seat of power but a binding office, then the one who reaches it is not merely a conqueror. They are a candidate.

Under this interpretation:
- the Grey Witness offers boons that are genuinely useful
- those boons may also be marks of selection, preparing the delver for what waits below
- he may want the Overlord destroyed, but not necessarily for the player's sake
- he may believe that an empty throne is worse than a cruel one

Useful story implication:
- the player can never be fully certain whether the Grey Witness is aiding a rebellion, preserving a prison, or engineering a succession

### 5. Merchants as Grave-Robbers of the Deep

Vendors are not normal shopkeepers. They are scavengers, opportunists, cult survivors, and black-market couriers feeding off the endless descent of doomed delvers.

Useful story implication:
- their dialogue can hint that the dungeon has consumed many before the player

### 6. Boons as Bargains, Not Blessings

The Grey Witness should not feel like a benevolent sage. The boon choice can be framed as a bargain with cost, omen, or contamination attached.

Useful story implication:
- powerful pre-run traits feel narratively risky as well as mechanically helpful

## Ending Direction

The current narrative target is a morally ambiguous ending rather than a clean heroic one.

Recommended ending possibilities to preserve:
- the delver destroys the Overlord but binds themselves to the throne
- the Overlord was a warden and not the deepest evil
- the Grey Witness orchestrated the descent to replace a failing ruler below
- the world above is safer for now, but something in the delver comes back changed

Preferred emotional result:
- the player should feel that victory was real, but incomplete
- the Grey Witness should remain unsettling after the ending, not explained away by it
- the final question should not be "Did I win?" alone, but "What did I become by reaching the throne?"

This tone should keep the game closer to dark fantasy and occult descent fiction than to straightforward heroic dungeon conquest.

## Core Run Structure

- One run starts on Floor 1
- Floors are procedurally generated from a seeded run
- Death immediately ends the run
- Victory requires clearing Floor 30
- No permanent progression carries between runs
- The full Floor 1-30 path is implemented

Current run-end support:
- death overlay
- victory overlay
- local high score entry
- local high score leaderboard

## Playable Delvers

The game still uses two classes internally, but the class-select screen now presents them as named characters.

### Garrick Ironhand

Role:
- Warrior

Flavor:
- A scarred sellsword who survives by breaking shields, holding chokepoints, and outlasting whatever lurks below.

Strengths:
- high HP
- strong melee damage
- heavier armor scaling
- stable front-line play

Weaknesses:
- poor ranged pressure
- low mana growth
- limited spell utility

### Malric Ashveil

Role:
- Wizard

Flavor:
- An arcane scholar of the underdeep who wins with distance, control, and precise bursts of destructive magic.

Strengths:
- high mana
- ranged spellcasting
- control and reposition tools
- stronger class-level spell scaling

Weaknesses:
- low HP
- weaker armor
- punished hard when cornered

## Class Design

### Warrior

Identity:
- durable melee front-liner
- strong melee scaling
- active-ability driven combat
- low mana growth

Starting kit:
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

Identity:
- fragile ranged spellcaster
- strong mana growth
- offensive spell scaling
- utility and control tools

Starting kit:
- Apprentice Staff
- Cloth Robe
- Mana Potion
- Healing Potion
- Tome of Magic Missile
- Magic Missile
- Arcane Shield

Implemented Wizard build traits:
- class-level spell damage bonus
- class-level flat spell power bonus
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

Current pacing targets:
- around Level 4 by Floor 10
- around Level 8 by Floor 20
- Level 10 reserved for the late game

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

## Spells and Abilities

### Warrior abilities

- Power Strike
  - cheap melee burst
  - can gain extended reach through Charge
  - can cleave through skill investment

- Guard Break
  - melee strike
  - applies Sundered

### Wizard spells

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

## Projectile Spell Presentation

Projectile-style spells now use visible travel animations instead of resolving invisibly.

Implemented projectile animation coverage:
- Magic Missile
- Frost Shard
- Arcane Burst
- Cultist Shadow Bolt
- Shaman Hexfire
- Infernal Imp Cinder Hex
- Abyssal Bolt

Presentation rules:
- projectiles travel across the grid
- travel duration is intentionally slowed enough to read
- spell misses still show the projectile
- projectile colors differ by spell type

## Status Effects

Implemented statuses:
- Chilled
  - reduces accuracy
- Sundered
  - reduces defense
- Weakened
  - reduces outgoing damage
- Hexed
  - reduces defense on the affected side
- Arcane Shield
  - temporary defensive ward

Status UX:
- status badges in HUD and target panel
- status pips above actors
- hover tooltips for status badges
- fade messages in the combat log

## Enemies and AI

Current AI roles:
- melee rush
- skirmisher
- blocker
- ranged caster
- boss behavior

Detection rules:
- enemies use sight-based aggro
- alerted enemies pursue the player
- casters attempt to keep useful range

Current caster identity:
- Cultist uses Shadow Bolt and can inflict Weakened
- Orc Shaman uses Hexfire and can inflict Hexed
- Infernal Imp applies chill pressure
- Abyssal Overlord uses Abyssal Bolt in the final fight

Recent AI tuning:
- ranged enemies no longer kite as aggressively as earlier builds
- Cultists and related casters were reduced in damage output
- ranged enemies can stand and cast more often instead of endlessly retreating

## Equipment and Itemization

Implemented item categories:
- weapons
- armor
- accessories
- consumables
- tomes

Current rarity presentation:
- common
- uncommon
- rare
- boss

Current itemization direction:
- broader low-level basic gear variety
- additional midgame gear variety
- enchanted weapons with explicit gameplay effects
- endgame reward gear for both classes

Implemented enchantment examples:
- bonus hit damage
- lifesteal
- sunder chance
- spell bonus damage
- mana refund chance

Enchantment UX:
- shown in inventory detail
- shown in vendor detail
- affects gameplay directly in combat resolution

## Loot Economy and Reward Rules

Current loot philosophy:
- less gear noise
- fewer random gear drops from enemies
- sustain items remain comparatively common
- stronger chest moments
- vendors matter more
- selling excess gear no longer dominates run wealth as heavily

Current sustain rules:
- every floor start room now contains 1 Healing Potion and 1 Mana Potion
- every spawned vendor always carries 1-3 regular Healing Potions
- vendors may still also carry Greater Healing Potions and other stock

Current drop direction:
- potions are intentionally easier to find than gear
- gear is meant to feel more meaningful and less constant

## Inventory and Vendor UX

Implemented UX decisions:
- comparison pane for item details
- equipped-versus-candidate comparison tables
- stat chip summaries
- rarity/category badges
- hover tooltips for items, skills, quick slots, statuses, inventory rows, vendor rows, and sell rows

Current inventory presentation:
- icon-based grid layout
- stack counts shown directly on tiles
- stack grouping is UI-only
- detail pane remains on the right

Current vendor presentation:
- icon-based stock grid
- price badge on each vendor tile
- detail/comparison pane on the right
- stacked sell list for duplicate items

Stacks remain UI-only:
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

Encounter rules:
- room type influences encounter pool
- elite, trap, and treasure rooms are prioritized for encounter placement
- vendor rooms are reserved before enemy placement
- shrine rooms remain safe utility spaces

## Trap Design and Readability

Implemented trap types:
- spikes
- darts
- fire
- curse
- alarm

Current trap readability rules:
- revealed traps use distinct tinting by trap type
- revealed traps draw a hazard marker under the trap icon
- trap visuals were remapped away from potion-like art where possible

Trap color direction:
- spikes: pale steel
- darts: amber
- fire: orange-red
- curse: violet
- alarm: gold

## Floors 1-10

Purpose:
- establish the core roguelike loop
- teach class identity
- end with the Bone Captain mini-boss on Floor 10

Implemented boss:
- Bone Captain

## Floors 11-20

Purpose:
- deepen builds
- introduce stronger room identity
- increase tactical pressure

Implemented additions:
- Orc Brute
- Gloomblade
- Dread Slime
- Orc Shaman
- Chort
- shrine rooms
- curse traps
- alarm traps
- stronger itemization
- more structured encounter pools

Milestone 2 tuning already applied:
- encounter density eased
- elite scaling softened
- XP progression slowed
- economy rebalanced toward better rewards, less clutter

## Floors 21-29

Purpose:
- distinct endgame band before the final boss
- pressure Level 8-10 builds with mixed late-game encounters
- surface stronger rewards and vendors

Implemented endgame enemy roster:
- Infernal Imp
- Void Stalker
- Doom Ogre
- Chort
- selected reused late threats where needed

Implemented endgame tuning:
- separate endgame encounter pools
- softer late elite curve than the first Milestone 3 scaffold
- stronger late vendors and chest rewards
- endgame-biased loot pools

## Floor 30

Purpose:
- bespoke final boss floor
- full-run victory gate

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
  - clearer combat log telegraphs
  - target panel phase labeling

## Run-End and High Score System

Implemented run-end support:
- non-dismissible death overlay
- non-dismissible victory overlay
- name entry at the end of the run
- score save to local browser storage
- main-menu high score screen

Stored fields per score:
- player-entered name
- score
- floor reached
- level
- kills
- gold
- turns
- class
- cause of death or victory result

Current moderation rule:
- vulgar/profane terms are blocked in submitted names
- names are trimmed, normalized, and length-limited

Current score model:
- based on floor progression, level, kills, gold, and victory bonus

## UI and Feedback

Implemented screens:
- Main Menu
- Class Selection
- High Scores
- Gameplay HUD
- Inventory
- Character
- Skill Tree
- Vendor
- Quick Slot Loadout
- Death Screen
- Victory Screen
- Floor Transition Banner

Implemented critical health feedback:
- red screen flash when entering critical HP
- persistent HP meter highlight below 20% HP

Other current UI details:
- class select now uses animated class sprites
- class select presents named delvers instead of generic class-only picks
- death and victory overlays cannot be dismissed accidentally

## Art Direction

Current build uses local integrated pixel-art assets for:
- player sprites
- enemy sprites
- vendor sprite
- floor and wall tiles
- chests
- stairs
- shrine
- pickups
- trap sprites

Current visual polish layers:
- animated actor sprites
- fog-of-war rendering for both walls and floors
- projectile spell visuals
- improved trap hazard treatment

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
- encounter and room identity pass
- XP progression rebalance
- economy rebalance
- class/build balance pass
- inventory/vendor UX overhaul
- status-effect polish
- Floor 20 completion flow
- stabilization pass

### Milestone 3

Playable and partially polished:
- Floors 21-29
- Floor 30 final boss floor
- Abyssal Overlord phased encounter
- endgame reward tier
- full-run victory flow
- high score system
- named class-select delvers
- projectile spell presentation

## Remaining Work

The current game is playable across Floors 1-30, but it still has a polish/balance tail.

Main remaining work:
- final endgame balance based on real playthroughs
- additional boss polish and visual impact effects
- more distinct biome/theme variation if desired
- continued stabilization and bug sweep
- optional deeper leaderboard or shared online score support

## Scope Boundary

Dungeon 30: The Abyssal Throne is now beyond prototype scope and has a full playable run, but it is not yet at final release polish.

The current focus is:
- polish
- full-run balance
- readability
- usability
- final stabilization
