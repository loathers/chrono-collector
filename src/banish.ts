import { type OutfitSpec } from "grimoire-kolmafia";
import {
  type Item,
  type Monster,
  type Skill,
  canEquip,
  cliExecute,
  equippedItem,
  getInventory,
  getPower,
  haveEffect,
  haveEquipped,
  isUnrestricted,
  itemType,
  myClass,
  myFury,
  retrieveItem,
  toItem,
  toMonster,
} from "kolmafia";
import {
  $class,
  $effect,
  $item,
  $items,
  $monster,
  $skill,
  $slot,
  get,
  have,
} from "libram";

import { garboValue } from "./garboValue";
import { printd } from "./lib";
import Macro from "./macro";
import { ifHave } from "./outfit";

// Unleash Nanites needs at least this many turns of Nanobrawny to fire.
const NANOBRAWNY = $effect`Nanobrawny`;
const NANOBRAWNY_MIN_TURNS = 40;
// Turns of an effect granted per genie/pocket wish — used to price the Nanites route.
const WISH_EFFECT_TURNS = 20;
// Marginal "cost" of firing an already-owned perishable resource: spend it before it decays.
const SPEND_NOW = -1;

const MONODENT = $item`Monodent of the Sea`;
const TRYPTOPHAN_DART = $item`tryptophan dart`;
const POCKET_WISH = $item`pocket wish`;
const GENIE_BOTTLES = $items`genie bottle, replica genie bottle`;

// Resource policy (per user): full ladder — near-free weapon banishers first, then the
// cheaper of (wish Nanobrawny -> Unleash Nanites) vs (tryptophan dart), by market value.
const POLICY = { wish: true, dart: true };

/**
 * A single, self-describing way of banishing a monster. Each banisher holds only one victim
 * at a time, so keeping N monsters banished all day needs N distinct banishers. Everything
 * the engine needs is on the object, so a new banisher is one entry in {@link BANISHERS}.
 */
type Banisher = {
  source: Skill | Item; // identity; matched against the banishedMonsters property
  dayLong: boolean; // rest-of-day vs turn-based (returns / must be re-applied)
  weapon?: () => Item | null; // weapon that must be equipped to fire it (forced in lockdown)
  cost: () => number; // marginal meat cost of one lock now; < 0 = perishable, spend ASAP
  canProvide: () => boolean; // could be set up today (owned / buyable under policy) — planning
  available: () => boolean; // usable to fire in the current combat — right now
  deployed?: () => boolean; // already holding a victim, so it can't take another
  provision?: () => void; // acquire consumables before adventuring (wish / buy)
  macro: () => Macro;
};

/** Highest-power owned, equippable, unrestricted club — what Batter Up! needs in-hand. */
function bestClub(): Item | null {
  const clubs = Object.keys(getInventory())
    .map((name) => toItem(name))
    .filter((i) => itemType(i) === "club" && canEquip(i) && isUnrestricted(i));
  const equipped = equippedItem($slot`weapon`);
  if (itemType(equipped) === "club") clubs.push(equipped);
  if (clubs.length === 0) return null;
  return clubs.reduce((best, i) => (getPower(i) > getPower(best) ? i : best));
}

function nanitesUsed(): boolean {
  return get("_nanorhinoBanishedMonster") !== $monster`none`;
}

// Free genie-bottle wishes remaining today (3/day). Beyond these, wishes cost a pocket wish.
function genieWishesLeft(): number {
  if (!GENIE_BOTTLES.some((b) => have(b))) return 0;
  return Math.max(0, 3 - get("_genieWishesUsed"));
}

function nanobrawnyWishesNeeded(): number {
  return Math.max(
    0,
    Math.ceil(
      (NANOBRAWNY_MIN_TURNS - haveEffect(NANOBRAWNY)) / WISH_EFFECT_TURNS,
    ),
  );
}

// Meat cost of locking a target via Unleash Nanites. Every wish is valued at the pocket-wish
// price (free genie-bottle wishes carry the same opportunity cost); a buff already at/over the
// threshold is sunk and perishable, so spend it ASAP.
function nanitesCost(): number {
  if (nanitesUsed()) return Infinity;
  if (haveEffect(NANOBRAWNY) >= NANOBRAWNY_MIN_TURNS) return SPEND_NOW;
  return nanobrawnyWishesNeeded() * garboValue(POCKET_WISH);
}

// Valued at sale price whether or not one is held — a dart in inventory could be sold instead.
function dartCost(): number {
  return garboValue(TRYPTOPHAN_DART);
}

// Wish Nanobrawny up to a usable level: free genie-bottle wishes first, then pocket wishes.
function wishNanobrawny(): void {
  while (haveEffect(NANOBRAWNY) < NANOBRAWNY_MIN_TURNS) {
    const before = haveEffect(NANOBRAWNY);
    if (genieWishesLeft() <= 0 && !retrieveItem(POCKET_WISH)) break;
    cliExecute("genie effect Nanobrawny");
    if (haveEffect(NANOBRAWNY) <= before) break; // no progress -> bail
  }
}

const bowl: Banisher = {
  source: $skill`Bowl a Curveball`,
  dayLong: false,
  cost: () => 0,
  canProvide: () => get("hasCosmicBowlingBall"),
  available: () =>
    get("hasCosmicBowlingBall") && get("cosmicBowlingBallReturnCombats") < 1,
  macro: () => Macro.trySkill($skill`Bowl a Curveball`),
};

const lightning: Banisher = {
  source: $skill`Sea *dent: Throw a Lightning Bolt`,
  dayLong: true,
  weapon: () => MONODENT,
  cost: () => 0, // 11 free uses/day, keeps drops
  canProvide: () => have(MONODENT) && get("_seadentLightningUsed") < 11,
  available: () => haveEquipped(MONODENT) && get("_seadentLightningUsed") < 11,
  deployed: () => get("_seadentLightningUsed") > 0,
  macro: () => Macro.trySkill($skill`Sea *dent: Throw a Lightning Bolt`),
};

const batter: Banisher = {
  source: $skill`Batter Up!`,
  dayLong: true,
  weapon: bestClub,
  cost: () => 0, // Fury regenerates from combat
  // Fury caps at 5 only with Ire of the Orca, which Batter Up! needs to fire.
  canProvide: () =>
    myClass() === $class`Seal Clubber` &&
    have($skill`Batter Up!`) &&
    have($skill`Ire of the Orca`) &&
    bestClub() !== null,
  available: () =>
    have($skill`Batter Up!`) &&
    itemType(equippedItem($slot`weapon`)) === "club" &&
    myFury() >= 5,
  macro: () => Macro.trySkill($skill`Batter Up!`),
};

const nanites: Banisher = {
  source: $skill`Unleash Nanites`,
  dayLong: true,
  cost: nanitesCost,
  // Pocket wishes are unlimited (buyable), so under policy Nanites is always provisionable.
  canProvide: () =>
    !nanitesUsed() && (haveEffect(NANOBRAWNY) > 0 || POLICY.wish),
  available: () =>
    !nanitesUsed() && haveEffect(NANOBRAWNY) >= NANOBRAWNY_MIN_TURNS,
  deployed: nanitesUsed,
  provision: wishNanobrawny,
  macro: () => Macro.trySkill($skill`Unleash Nanites`),
};

const dart: Banisher = {
  source: TRYPTOPHAN_DART,
  dayLong: true,
  cost: dartCost,
  canProvide: () => POLICY.dart,
  available: () => have(TRYPTOPHAN_DART),
  provision: () => void retrieveItem(TRYPTOPHAN_DART),
  macro: () => Macro.tryHaveItem(TRYPTOPHAN_DART),
};

// The whole registry. Add a future banisher (Reflex Hammer, Latte lid, ice house, ...) by
// dropping one entry here — the engine below is generic over it.
const BANISHERS: Banisher[] = [bowl, lightning, batter, nanites, dart];
const DAY_LONG = BANISHERS.filter((b) => b.dayLong);

const isDeployed = (b: Banisher): boolean => b.deployed?.() ?? false;
const byCost = (a: Banisher, b: Banisher): number => a.cost() - b.cost();

/** Turn-based banishers that can each hold one target (e.g. the bowling ball). */
function turnCapacity(): number {
  return BANISHERS.filter((b) => !b.dayLong && b.canProvide()).length;
}

function availableTurnBanisher(): Banisher | null {
  return BANISHERS.find((b) => !b.dayLong && b.available()) ?? null;
}

/** Cheapest day-long banisher usable this combat that isn't already holding a victim. */
function bestDayLong(): Banisher | null {
  return (
    DAY_LONG.filter((b) => b.available() && !isDeployed(b)).sort(byCost)[0] ??
    null
  );
}

/** Monsters currently banished, parsed straight from the raw property (groups of 3). */
function banishedMonsterList(): Monster[] {
  const parts = get("banishedMonsters").split(":");
  const monsters: Monster[] = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    if (parts[i]) monsters.push(toMonster(parts[i]));
  }
  return monsters;
}

/** Held by a rest-of-day banisher (i.e. banished, but not the turn-based bowling ball). */
function dayLongLocked(monster: Monster): boolean {
  return (
    banishedMonsterList().includes(monster) &&
    get("_curveballMonster") !== monster
  );
}

/** How many targets still need a day-long lock, after turn-based banishers take their share. */
function locksNeeded(targets: Monster[]): number {
  const unlocked = targets.filter((t) => !dayLongLocked(t)).length;
  return Math.max(0, unlocked - turnCapacity());
}

/** The cheapest day-long banishers we intend to establish for the still-unlocked targets. */
function plannedDayLong(targets: Monster[]): Banisher[] {
  const need = locksNeeded(targets);
  if (need <= 0) return [];
  return DAY_LONG.filter((b) => b.canProvide() && !isDeployed(b))
    .sort(byCost)
    .slice(0, need);
}

function selectBanisher(target: Monster, targets: Monster[]): Banisher | null {
  if (dayLongLocked(target)) return null; // already gone for the day
  const unlocked = targets.filter((t) => !dayLongLocked(t)).length;
  const dl = bestDayLong();
  const turn = availableTurnBanisher();
  // Lock with a day-long banisher when turn-based banishers can't cover everything;
  // otherwise let the last remaining target ride a (free) turn-based banisher.
  if (dl && (unlocked > turnCapacity() || !turn)) return dl;
  if (turn) return turn;
  return dl; // may be null -> fall through to base combat and just kill it
}

/**
 * Combat macro that banishes each target with its chosen banisher, then runs `base` for
 * everything else (non-targets, Kramco free fights, or a target we couldn't banish).
 */
export function banishCombat(targets: Monster[], base: () => Macro): Macro {
  let macro = new Macro();
  for (const target of targets) {
    const banisher = selectBanisher(target, targets);
    if (banisher) {
      printd(`Banish: ${target} -> ${banisher.source}`);
      macro = macro.if_(target, banisher.macro());
    }
  }
  return macro.step(base());
}

/** Whether the outfit still needs a banish weapon forced (monodent / club) this turn. */
export function pendingWeaponBanish(targets: Monster[]): boolean {
  return plannedDayLong(targets).some((b) => b.weapon);
}

/** Forced weapon spec for the lockdown turns; empty once the targets are handled. */
export function banishWeaponSpec(targets: Monster[]): OutfitSpec {
  const weapon = plannedDayLong(targets)
    .find((b) => b.weapon)
    ?.weapon?.();
  return weapon ? ifHave("weapon", weapon) : {};
}

/** Acquire the resources the plan needs before adventuring (wish Nanobrawny / buy darts). */
export function prepareBanishes(targets: Monster[]): void {
  for (const banisher of plannedDayLong(targets)) banisher.provision?.();
}
