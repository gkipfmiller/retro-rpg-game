const SOUND_MAP = {
  // Tier 1
  melee_swing:      "Sound Files/Weapons/Melee/sfx_wpn_sword1.wav",
  player_hit_enemy: "Sound Files/General Sounds/Simple Damage Sounds/sfx_damage_hit2.wav",
  enemy_hit_player: "Sound Files/General Sounds/Simple Damage Sounds/sfx_damage_hit7.wav",
  miss:             "Sound Files/10_Battle_SFX/35_Miss_Evade_02.wav",
  ui_confirm:       "Sound Files/10_UI_Menu_SFX/013_Confirm_03.wav",
  ui_cancel:        "Sound Files/10_UI_Menu_SFX/029_Decline_09.wav",
  ui_denied:        "Sound Files/10_UI_Menu_SFX/033_Denied_03.wav",
  chest_open:       "Sound Files/General Sounds/Interactions/sfx_sounds_interaction1.wav",
  // Tier 2
  ranged_attack:    "Sound Files/Weapons/Single Shot Sounds/sfx_weapon_singleshot5.wav",
  heal:             "Sound Files/8_Buffs_Heals_SFX/02_Heal_02.wav",
  use_item:         "Sound Files/10_UI_Menu_SFX/051_use_item_01.wav",
  equip_item:       "Sound Files/10_UI_Menu_SFX/070_Equip_10.wav",
  stairs:           "Sound Files/Movement/Climbing Stairs/sfx_movement_stairs1loop.wav",
  level_up:         "Sound Files/General Sounds/Fanfares/sfx_sounds_fanfare1.wav",
  player_death:     "Sound Files/Death Screams/Human/sfx_deathscream_human1.wav",
  buy_sell:         "Sound Files/10_UI_Menu_SFX/079_Buy_sell_01.wav",
  enemy_death:      "Sound Files/General Sounds/Negative Sounds/sfx_sounds_damage3.wav",
};

export class SoundPlayer {
  constructor() {
    this._cache = {};
    for (const [key, path] of Object.entries(SOUND_MAP)) {
      const audio = new Audio(path);
      audio.preload = "auto";
      this._cache[key] = audio;
    }
  }

  play(key) {
    const audio = this._cache[key];
    if (!audio) return;
    const clone = audio.cloneNode();
    clone.volume = audio.volume;
    clone.play().catch(() => {});
  }

  setVolume(key, volume) {
    if (this._cache[key]) this._cache[key].volume = volume;
  }
}
