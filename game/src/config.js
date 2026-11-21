// Solmar Bay — tuning constants for the whole game. One place for every number
// a designer would want to tweak: world size, speeds, wanted rules, rewards.
export const WORLD_W = 3600;
export const WORLD_H = 3600;
export const ROAD_W = 72;
export const BLOCK = 300; // distance between road centrelines
export const ROAD_FIRST = 240; // centreline of the first road
export const WATER_X = 3360; // east of this is the sea
export const SAND_X = 3220; // sand strip between the last road and the sea

export const PLAYER_SPEED = 205; // px/s on foot
export const PLAYER_RADIUS = 13;
export const PLAYER_MAX_HP = 100;

export const CAR_ACCEL = 420;
export const CAR_BRAKE = 620;
export const CAR_MAX_SPEED = 560;
export const CAR_MAX_REVERSE = 190;
export const CAR_TURN = 2.6; // rad/s at full lock, scaled by speed
export const CAR_RADIUS = 20;

export const TRAFFIC_SPEED = 130;
export const PED_SPEED = 55;

export const WANTED_DECAY_SECONDS = 26; // quiet seconds to drop one star
export const WANTED_MAX = 5;
export const BUST_DISTANCE = 34;
export const BUST_SECONDS = 1.4;

export const PISTOL_DAMAGE = 34;
export const PISTOL_RANGE = 520;
export const PISTOL_RATE = 0.22; // seconds between shots
export const ENEMY_HP = 70;
export const ENEMY_DAMAGE = 9;

export const MISSION_REWARDS = [500, 750, 600, 2000];
export const SAVE_KEY = 'solmar-bay-save-v1';
export const START_MONEY = 250;
export const START_TIME_MINUTES = 8 * 60 + 12; // 08:12 in the morning

export const VIEW_W = 1280;
export const VIEW_H = 800;
export const STEP = 1 / 60;
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
