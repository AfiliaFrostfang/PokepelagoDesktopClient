/**
 * pokemon_gates.ts
 *
 * AUTO-GENERATED from worlds/pokepelago/data.py by
 * tools/build_classification_data.py --write-gates. DO NOT EDIT BY HAND.
 *
 * Mirror of the APWorld gate-classification sets, consumed by
 * GameContext.isPokemonGuessable() / useGateChecks to enforce locks client-side.
 * Regenerate after any data.py classification change so the client and the
 * APWorld never disagree about what is gated (see BUG-12 / BUG-16).
 */

// Sub-legendaries — require 6 Gym Badges
export const SUB_LEGENDARY_IDS = new Set<number>([
    144, 145, 146, 243, 244, 245, 377, 378, 379, 380, 381, 480,
    481, 482, 485, 486, 488, 638, 639, 640, 641, 642, 645, 772,
    773, 785, 786, 787, 788, 891, 892, 894, 895, 896, 897, 905,
    1001, 1002, 1003, 1004, 1014, 1015, 1016, 1017,
]);

// Box legendaries — require 7 Gym Badges
export const BOX_LEGENDARY_IDS = new Set<number>([
    150, 249, 250, 382, 383, 384, 483, 484, 487, 643, 644, 646,
    716, 717, 718, 789, 790, 791, 792, 800, 888, 889, 890, 898,
    1007, 1008, 1024,
]);

// Mythics — require 8 Gym Badges
export const MYTHIC_IDS = new Set<number>([
    151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648,
    649, 719, 720, 721, 801, 802, 807, 808, 809, 893, 1025,
]);

// Baby Pokémon — require Daycare item(s)
export const BABY_IDS = new Set<number>([
    172, 173, 174, 175, 236, 238, 239, 240, 298, 360, 406, 433,
    438, 439, 440, 446, 447, 458, 848,
]);

// Trade-evolved Pokémon — require Link Cable
export const TRADE_EVO_IDS = new Set<number>([
    65, 68, 76, 94, 186, 199, 208, 212, 230, 233, 367, 368,
    464, 466, 467, 474, 477, 526, 534, 589, 617, 683, 685, 709,
    711,
]);

// Fossil Pokémon — require Fossil Restorer
export const FOSSIL_IDS = new Set<number>([
    138, 139, 140, 141, 142, 345, 346, 347, 348, 408, 409, 410,
    411, 564, 565, 566, 567, 696, 697, 698, 699, 880, 881, 882,
    883,
]);

// Ultra Beasts — require Ultra Wormhole (Necrozma #800 included by project choice)
export const ULTRA_BEAST_IDS = new Set<number>([
    793, 794, 795, 796, 797, 798, 799, 800, 803, 804, 805, 806,
]);

// Paradox Pokémon — require Time Rift
export const PARADOX_IDS = new Set<number>([
    984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995,
    1005, 1006, 1007, 1008, 1009, 1010, 1020, 1021, 1022, 1023,
]);

// Stone-only evolutions — require the matching evolutionary stone item.
export const STONE_EVO_IDS: Record<string, Set<number>> = {
    fire: new Set([38, 59, 136, 514, 952]),
    water: new Set([62, 91, 121, 134, 272, 516]),
    thunder: new Set([26, 135, 462, 476, 604, 738, 939]),
    leaf: new Set([45, 71, 103, 275, 470, 512]),
    moon: new Set([31, 34, 36, 40, 301, 518]),
    sun: new Set([182, 192, 547, 549, 695]),
    shiny: new Set([407, 468, 573, 671]),
    dusk: new Set([429, 430, 609, 681]),
    dawn: new Set([475, 478]),
    ice: new Set([471, 740, 975]),
};

// Ordered stone names matching APWorld item ID offsets (6010 + index)
export const STONE_NAMES_ORDERED = [
    'fire', 'water', 'thunder', 'leaf', 'moon', 'sun', 'shiny', 'dusk', 'dawn', 'ice',
] as const;
