# Dungeon 30: The Abyssal Throne Spec

## Overview

Dungeon 30: The Abyssal Throne is a single-player, turn-based, retro pixel-art roguelike RPG.

The player chooses one of three named delvers, descends from Floor 1 to Floor 30, and attempts to defeat the Abyssal Overlord on the final floor. Death is permanent for the current run. A new run always starts over on Floor 1 with a newly generated dungeon and no persistent power carried over.

Current project status:
- Milestone 1: complete
- Milestone 2: complete
- Milestone 3: playable end-to-end, with ongoing balance and polish

## Current Title and Branding

Current title:
- Dungeon 30: The Abyssal Throne

Current menu structure:
- Continue Run (shown only when a saved run exists)
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

The game has three classes internally (`warrior`, `wizard`, `ranger`), and the class-select screen presents them as named characters.

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

### Selara Ashveil

Role:
- Wizard (displayed as "Sorceress")

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

### Sydor Alamasy

Role:
- Ranger

Flavor:
- A keen-eyed wanderer who picks apart foes from afar, blending bowcraft with subtle nature magic and a survivalist's instinct.

Strengths:
- ranged weapon attacks
- high accuracy
- good evasion

Weaknesses:
- moderate HP
- weaker in melee
- split stat scaling between Dexterity and Intelligence

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

### Ranger

Identity:
- ranged physical damage dealer
- Dexterity-driven accuracy, evasion, and ranged damage
- light spell support (moderate mana growth, small class spell damage bonus)
- repositioning to keep distance

Starting kit:
- Short Bow
- Scout Leathers
- Healing Potion
- Aimed Shot
- Evasive Step

Skill tree branches:
- Deadshot: ranged damage, crit chance, kill momentum, Aimed Shot armor penetration, bonus damage to low-health targets
- Windrunner: spell damage, max mana, poison on ranged hits, Aimed Shot range, first-spell bonus
- Pathfinder: evasion, trap sense, trap damage reduction, Evasive Step range, bonus damage after moving

Ranged weapon rules:
- bows carry a range stat
- `F` fires the equipped ranged weapon at the nearest visible enemy in range
- bumping into an enemy still performs a melee attack using the equipped weapon

## Pre-Run Boon System

Current run start flow:
- choose Garrick Ironhand, Selara Ashveil, or Sydor Alamasy
- enter a short scripted sage chamber
- approach the Grey Witness
- choose 1 boon from 3 random options drawn from a pool of 13
- receive an ominous line and begin the descent

Implemented boon pool:
- Vicious Star
- Ward of Ash
- Iron Remnant
- Crimson Hunger
- Fortune's Ledger
- Sage's Echo
- Stoneblood
- Deep Wells
- Relentless Step
- Grave Insight
- Treasure Sense
- Battle Trance
- Phantom Quiver (every 4th ranged attack fires a phantom arrow at another nearby enemy for 50% damage)

Current boon design goals:
- materially change a run without trivializing it
- mix general-use and class-leaning power in one shared pool
- make the Grey Witness feel like he is granting a bargain, not a blessing
- keep the chosen boon visible in the main HUD during play

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
- fire ranged weapon
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

- Chain Bolt
  - ranged lightning strike
  - arcs to a nearby second target for reduced damage

- Arcane Pulse
  - close-range AoE panic spell
  - damages all adjacent enemies

- Ice Shatter
  - combo finisher
  - deals bonus damage to Chilled targets and consumes the chill

- Frailty Hex
  - light damage setup spell
  - applies both Hexed and Weakened

### Ranger abilities

- Aimed Shot
  - precise ranged shot with bonus damage
  - requires an equipped ranged weapon
  - gains range and armor penetration through skill investment

- Evasive Step
  - leaps 2 tiles away from the nearest threat
  - gains range through skill investment

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
- arrows (ranged weapon attacks, Aimed Shot, Phantom Quiver)

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
  - reduces defense by 2 on the affected side (player or enemy)
- Poisoned
  - deals 1 HP loss per turn to the player or to enemies
  - an enemy killed by poison counts as a player kill (XP, gold, drops)
  - for the player, waiting burns through the status faster than taking normal actions
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
- lurker (stationary, attacks within reach)

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
- hands
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
- ranged poison chance

Current Hands slot direction:
- uncommon and rare glove/gauntlet items only
- focuses on status application and status protection
- supports both melee and spell archetypes

Implemented Hands examples:
- Gauntlets of Rime
- Hexward Gloves
- Gravedust Mitts
- Runed Handwraps
- Sundergrip Gauntlets
- Spellcatcher Gloves
- Cinderwraps
- Warden's Grips
- Marksman's Bracers
- Windgrip Gloves

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
- vendor stock excludes gear biased toward other classes (class-neutral items and tomes are always eligible)

Current drop direction:
- potions are intentionally easier to find than gear
- gear is meant to feel more meaningful and less constant
- enemy drops, mimic drops, chests, vaults, and boss rewards all use class-specific pools for each of the three classes

Implemented vault reward layer:
- one locked treasure vault exists somewhere in Floors 1-9
- one locked treasure vault exists somewhere in Floors 11-19
- one locked treasure vault exists somewhere in Floors 21-29
- each vault requires a matching hidden key found on an earlier floor in the same band
- keys are hidden in secret rooms behind invisible walls
- vault rewards include gold, potions, and at least one rare-or-better equipment item

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

Current vendor flavor layer:
- vendors use named archetypes by floor band instead of a generic merchant label
- greetings render in the on-screen NPC dialogue box rather than only in the log
- early, mid, and late vendors use different names and tone

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

Current trap behavior notes:
- alarm traps now fully alert enemies on the floor
- dart traps now apply Poisoned
- waiting is a valid tactical response to reduce Poisoned duration faster

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
- end with the first true boss checkpoint on Floor 10

Implemented boss:
- Super Skeletor
  - necromancer-style boss using animated necromancer art
  - summons Skeletons during the fight
  - uses ranged pressure and curse-style control
  - has a bespoke ritual chamber presentation

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

Implemented mid-band visual identity:
- Floors 16-19 use the sewer/sunken-vault biome
- Floors 16-19 add sunken-vault native enemies drawn from the sewer art pack:
  - Bilge Bat: evasive skirmisher
  - Sludge Crawler: armored blocker
  - Drain Tentacle: rooted lurker that never moves and lashes the player from up to 2 tiles away
- Floor 20 continues that visual lead-in into Patches' arena

## Floor 20

Purpose:
- second major boss checkpoint
- bridge the midgame into the final descent band
- pay off the sewer/sunken-vault buildup with a bespoke arena fight

Implemented boss:
- Patches
  - heavy melee boss using the animated big-zombie art
  - has a heavier slam cadence than normal enemies
  - uses a dedicated arena with stitched/sewer-corruption presentation
  - serves as the Floor 20 progression gate before the abyssal depths

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

## Boss Encounter Rules

These apply to all three bosses (Super Skeletor, Patches, Abyssal Overlord):
- each boss waits in its arena until the player steps inside (the Floor 30 sentries likewise hold the antechamber); striking a guard from outside wakes it immediately
- a boss's attack rhythm starts when it wakes, so every fight opens the same way; the intro plate and boss HP bar appear at that moment
- every telegraph in the log fires exactly one turn before the attack it names: Super Skeletor's "raises a bony hand" (cleave) and "gathers a bolt of gravefire" (ranged), Patches' "heaves back" (cleave) and "lifts both fists" (slam, which takes priority when both are due), and the Overlord's "draws back" (cleave) and "gathers abyssal fire" (bolt)
- summoned minions (Super Skeletor's skeletons, the Overlord's imps) vanish when their summoner dies, without XP or drops
- the defeat line ("The first seal breaks...", "The second threshold is broken...") is logged the moment the boss dies
- boss-floor stairs are visibly sealed (iron bars over a pulsing red ward) while the boss lives, and open the moment it dies
- each boss's reward chest is named and drawn in its own palette, with a matching glow: Reliquary of the First Seal (bone, Floor 10), The Stitched Hoard (crimson, Floor 20), Tribute of the Abyssal Throne (abyssal violet, Floor 30); the palettes are load-time recolours of the standard chest's wood, keeping its gold trim
- screen flashes: Super Skeletor's summons (necrotic), Patches' slam (amber), the Overlord's phase change and imp summons (void violet), and every boss defeat (a gold "seal" burst)
- boss sighting lines, boss-floor entry lines, and hidden-cache discoveries are narration: the dialogue box shows them in italics with no speaker (named speakers are kept for the Grey Witness and vendors)

## Save and Continue

- the run is saved to local browser storage after the boon choice and on every descent
- the main menu shows Continue Run when a save exists
- continuing restores the run at the start of the most recently entered floor
- the save is deleted on death or victory

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

Current save-flow rule:
- a completed run can only submit one score entry
- after a successful save, the game-over or victory overlay closes and moves to High Scores

## UI and Feedback

Implemented screens:
- Main Menu
- Class Selection
- Sage Prelude / Boon Choice
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

Current HUD and input layout:
- six quick slots (keys 1-6) sit in a hotbar directly under the map, with the map capped by window height so the hotbar is always visible; each class starts with its first three filled, learned tomes drop into the first empty slot, and saves from the three-slot era are padded on load
- hotbar buttons show mana cost (or "Free" when a discount or Sage's Echo applies) and consumable counts in their top corners, and dim with the reason in the tooltip ("Needs 3 mana", "None left", "Needs a ranged weapon") when they can't be used; the touch quick-slot row shares the same rendering
- pickups, chest loot, vault keys, and gold show short notices over the top-left of the map (item icon and rarity colour; consecutive gold merges into one "+N gold"); found items are marked new with a dot in the inventory until it's closed, and the HUD shows "N new items in your pack (I)" (a badge on the touch Inv button)
- taking the stairs shows a self-dismissing floor summary (kills, items, gold found, % explored, turns) that never blocks play; if you've seen an unopened chest you can open, or walked past an unvisited vendor, the first Enter on the stairs shows a one-line reminder and the second descends (once per floor, and nothing hidden is revealed)
- the main menu shows a Continue card for a saved run (animated hero, name, class, level, boon, floor and band, HP bar, kills, gold, and how long ago it was saved); New Run steps back to a secondary button and asks before abandoning the saved run
- touch layout: a full-width row of six quick slots above the d-pad, Inv / Char / Skills / Map / Opt buttons (badges for new items and unspent skill points; Map toggles the minimap, Opt opens settings), the player's status effects in the mobile HUD, pixel type, and a compact notice stack showing the newest three
- the Quick Slot Loadout lists all six slots with icons and a Clear button each; every assignable spell or consumable has a row of numbered buttons (its current slot highlighted), and hovering or focusing an entry then pressing 1-6 assigns it
- the HUD shows a highlighted "skill points to spend (K)" prompt whenever skill points are unspent; clicking it opens the skill tree
- the skill tree shows all three branches side by side, with unlocked, available, and locked skills visually distinct
- a Settings panel (main menu button, or O in game) holds mute, master volume, and the minimap toggle, remembered per browser
- all controls show a visible keyboard focus ring; in overlays, arrow keys move between controls, moving across item tiles selects them, Enter on the selected item runs its main action (Use/Equip/Buy/Unequip), and Enter in the high-score name field saves the score
- hovering the map outlines the tile and shows a tooltip: enemies in view (HP, role, its hit chance and damage against you, your weapon's and first damage spell's hit chance and damage against it, statuses), plus remembered stairs, chests (and whether you carry a vault's key), shrines, vendors, the sage, floor items, and revealed traps; mimics still read as chests
- damaged enemies show a small HP bar along the bottom of their tile
- the target panel shows the last enemy you fought while it's in view, otherwise the nearest visible enemy (labelled "nearest"): sprite, rank, distance, HP bar, role, "hits you" odds and damage, your weapon and spell odds and damage (dimmed when out of range), defense and evasion, and statuses
- the combat log keeps the last 300 lines and scrolls back freely (it only sticks to the bottom while you're at the bottom); lines are coloured by kind (damage dealt, damage taken, misses, kills, healing, statuses, loot, progression), repeated lines merge into "×N", lines from before your latest action are dimmed, and All / Combat / Loot chips filter it (remembered per browser)
- inventory: an equipped strip (click or arrow to an equipped item to see it and Unequip), All / Gear / Consumables / Other filters, Recent / Rarity / Type sorting, a denser 4-column grid, double-click to use or equip, ▲ / ▼ / ◆ marks for upgrade, downgrade, or trade-off against the equipped item, and dimmed tiles for another class's gear
- vendor: the same gear marks on stock and sell rows, unaffordable prices in red, price shown beside your gold, a "Sell junk" button (gear worse than equipped, spare copies of equipped gear, or another class's gear; consumables, tomes and keys never count) that previews the list and total before selling, a confirm step before selling rare or boss items, and vault keys are no longer sellable
- the character sheet shows derived numbers with hover breakdowns: weapon damage range, accuracy, crit chance, spell damage, spell power and accuracy (when you have a damage spell), max HP and mana, defense, evasion, what each attribute currently gives, your boon, unlocked skills, and enchanted gear effects

Current visual identity:
- warm stone-and-iron palette across every screen (bronze-bordered stone panels, iron buttons, gold accent), replacing the earlier blue glass look
- Pixelify Sans (bundled in `fonts/`, SIL Open Font License) for headings, names, numbers, and buttons; descriptions stay in a readable sans
- the main menu, class select, and high scores sit over a live canvas diorama built from the game's own tiles: torch-lit back wall with banners, an animated lava fountain, the three delvers idling, flickering light pools, and drifting embers (a still frame under reduced motion); it only runs while those screens are visible
- the main menu has a title lockup ("Dungeon 30" / "The Abyssal Throne") and a vertical button stack on the left so the diorama shows on the right
- class cards show the hero on a lit pedestal, their name and flavour, level-1 HP and mana with per-level growth, attribute pip bars, starting kit icons and abilities, and Strong / Weak lines
- the Grey Witness boon choice shows the sage's animated portrait and line, and each boon card has an icon, a category (Offense, Defense, Sustain, Arcane, Fortune) that tints the card, the mechanical summary, and flavour text
- choosing a boon has no confirmation modal: play resumes at once while the Grey Witness dissolves on the map (fading, lifting, shedding grey motes) and speaks a four-line sequence in the dialogue box, one of three per run (the gift's weight, the throne's ledger and its hunger for an heir, then a farewell); each line is also written to the log so it can be reread
- status effects use 8x8 pixel-art icons (`src/pixelIcons.js`) in HUD and target badges (with a turn-count chip) and as pips above actors on the map; the player's effects have their own HUD row
- death is a full-screen epitaph: an animated portrait of what killed you (enemy sprite, trap sprite, or poison icon) on a carved headstone with the hero's name, class, level, boon, where they fell, and a floor-band epitaph line, beside a run recap (floor, level, kills, turns, damage dealt and taken, gold, score, finest possession carried), the high-score save, and the leaderboard; lingering statuses are cleared on death
- victory uses the same layout as a gilded throne-room card with the hero's portrait
- cosmetic torch lighting on the map (toggle in Settings): a band-tinted shadow deepens toward the edge of the view while everything the fog of war shows stays readable, a warm flickering glow surrounds the player, and explored shrines and stairs give off small coloured glows; it never reduces sight range
- bosses get a name-plate introduction over the map when they first see you (animated sprite, "A guardian stirs", name, epithet) and a boss HP bar along the bottom of the map with a damage trail; the Abyssal Overlord's bar shows its phase and marks the half-health threshold, then turns violet in phase 2
- every spell and ability has an 8x8 pixel icon (hotbar, touch row, loadout, class cards), and each skill-tree branch has one too
- Tab opens a full-screen map of the explored floor (stairs, chests, items with rare loot in gold, vendor, shrine, enemies in view, boss, you) with a legend and exploration %; Tab or Esc closes it, and the touch Map button opens it
- each new floor shows a brief card over the map ("12 of 30 · Floor 12 · Fungal Depths"; boss floors show their lair name in red) that fades on its own and never blocks input
- uncommon-or-better floor loot sits in a soft pulsing glow (green for uncommon, gold for rare and boss, plus a light beam for boss items), and rare loot twinkles; vault keys count as rare
- the skill tree shows branch icons, per-branch progress pips (e.g. 2/5), and connector lines between tiers that light up gold as the path is unlocked
- HP, mana, and XP bars are pixel-styled (square frame, highlight stripe, 10% tick marks, heart and flask icons), and HP bars keep a pale damage trail that drains after a hit

Other current UI details:
- class select now uses animated class sprites
- class select presents three named delvers instead of generic class-only picks
- death and victory overlays cannot be dismissed accidentally
- NPC dialogue for the Grey Witness and vendors appears in a dialogue box over the lower-middle of the map (below the centred player), fading in as each conversation starts
- the main HUD shows the currently active boon

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
- player-following camera: tiles render at a whole-number multiple of the 16px source art (at least 22 tiles across on desktop, 15 on narrow screens), with the canvas buffer matched to its on-screen size so pixels stay crisp; the camera eases toward the player and clamps to the map edges
- minimap in the top-right of the play area showing explored tiles, stairs, vendors, shrines, chests, visible enemies, the player, and the current view outline; toggled with M (remembered per browser)
- animated actor sprites
- actors drawn at their native pixel proportions (16 source px per tile), with per-actor scale for bosses and large sewer creatures
- load-time palette swaps: elite enemies use a blood-red palette (gold for already-red enemies), and Super Skeletor uses a bone-white recolor of the necromancer sprite
- each vendor archetype has its own sprite
- item icons are distinct per item, cropped from the Ironchests RPG Items sheet into `RPG Art Assets/extracted/`, and tomes are color-coded by spell school
- fog-of-war rendering for both walls and floors
- projectile spell visuals
- improved trap hazard treatment
- floor-theme palette variation across dungeon bands
- sewer wall/floor atlas support for the Floor 16-20 biome

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
