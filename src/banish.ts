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

import { printd } from "./lib";
import Macro from "./macro";
import { ifHave } from "./outfit";

// Unleash Nanites needs more than this many turns of Nanobrawny to fire.
const NANOBRAWNY = $effect`Nanobrawny`;
const NANOBRAWNY_MIN_TURNS = 40;

const MONODENT = $item`Monodent of the Sea`;
const TRYPTOPHAN_DART = $item`tryptophan dart`;
const GENIE_BOTTLES = $items`genie bottle, replica genie bottle`;

// Resource policy (per user): full ladder — free/owned sources first, then genie-wish
// Nanobrawny for Unleash Nanites, then tryptophan darts as an absolute last resort.
const POLICY = { wish: true, dart: true };

/**
 * A single way of banishing a monster. Day-long banishers hold their victim until
 * rollover; each banisher can only hold one monster at a time, so keeping two monsters
 * banished all day needs two distinct banishers.
 */
type Banisher = {
  source: Skill | Item; // identity; matched against the banishedMonsters property
  dayLong: boolean;
  canProvide: () => boolean; // could be deployed today (owns/eventually-usable) — planning
  available: () => boolean; // usable to fire in the current combat — right now
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

function genieWishesLeft(): number {
  if (!GENIE_BOTTLES.some((b) => have(b))) return 0;
  return Math.max(0, 3 - get("_genieWishesUsed"));
}

const bowl: Banisher = {
  source: $skill`Bowl a Curveball`,
  dayLong: false,
  canProvide: () => get("hasCosmicBowlingBall"),
  available: () =>
    get("hasCosmicBowlingBall") && get("cosmicBowlingBallReturnCombats") < 1,
  macro: () => Macro.trySkill($skill`Bowl a Curveball`),
};

const lightning: Banisher = {
  source: $skill`Sea *dent: Throw a Lightning Bolt`,
  dayLong: true,
  canProvide: () => have(MONODENT) && get("_seadentLightningUsed") < 11,
  available: () => haveEquipped(MONODENT) && get("_seadentLightningUsed") < 11,
  macro: () => Macro.trySkill($skill`Sea *dent: Throw a Lightning Bolt`),
};

const batter: Banisher = {
  source: $skill`Batter Up!`,
  dayLong: true,
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
  canProvide: () =>
    !nanitesUsed() &&
    (haveEffect(NANOBRAWNY) > 0 || (POLICY.wish && genieWishesLeft() > 0)),
  available: () =>
    !nanitesUsed() && haveEffect(NANOBRAWNY) > NANOBRAWNY_MIN_TURNS,
  macro: () => Macro.trySkill($skill`Unleash Nanites`),
};

const dart: Banisher = {
  source: TRYPTOPHAN_DART,
  dayLong: true,
  canProvide: () => POLICY.dart,
  available: () => have(TRYPTOPHAN_DART),
  macro: () => Macro.tryHaveItem(TRYPTOPHAN_DART),
};

// Cheapest -> most expensive. Nanites is promoted ahead of this order whenever its buff is
// already up, so a wished (decaying) Nanobrawny is spent before it wears off.
const DAY_LONG: Banisher[] = [lightning, batter, nanites, dart];

function bestDayLong(): Banisher | null {
  if (nanites.available()) return nanites;
  return DAY_LONG.find((b) => b.available()) ?? null;
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

/** How many targets still need a day-long lock, given the bowling ball can hold one. */
function locksNeeded(targets: Monster[]): number {
  const unlocked = targets.filter((t) => !dayLongLocked(t)).length;
  return Math.max(0, unlocked - (bowl.canProvide() ? 1 : 0));
}

function selectBanisher(target: Monster, targets: Monster[]): Banisher | null {
  if (dayLongLocked(target)) return null; // already gone for the day
  const unlocked = targets.filter((t) => !dayLongLocked(t)).length;
  const dl = bestDayLong();
  // Lock with a day-long banisher when the free bowling ball can't cover everything;
  // otherwise let the last remaining target ride the (free) bowling ball.
  if (dl && (unlocked >= 2 || !bowl.available())) return dl;
  if (bowl.available()) return bowl;
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
  return (
    locksNeeded(targets) > 0 && (lightning.canProvide() || batter.canProvide())
  );
}

/** Forced weapon spec for the lockdown turns; empty once both targets are handled. */
export function banishWeaponSpec(targets: Monster[]): OutfitSpec {
  if (locksNeeded(targets) <= 0) return {};
  if (lightning.canProvide()) return ifHave("weapon", MONODENT);
  const club = batter.canProvide() ? bestClub() : null;
  return club ? ifHave("weapon", club) : {};
}

/** Acquire the resources the plan needs before adventuring (wish Nanobrawny / buy a dart). */
export function prepareBanishes(targets: Monster[]): void {
  const need = locksNeeded(targets);
  if (need <= 0) return;

  // Day-long banishers we can deploy without spending consumable resources.
  const cheap = [lightning, batter].filter((b) => b.canProvide()).length;
  let shortfall = need - cheap;
  if (shortfall <= 0) return;

  // Fallback 1: wish for Nanobrawny so Unleash Nanites can fire.
  if (
    POLICY.wish &&
    !nanitesUsed() &&
    haveEffect(NANOBRAWNY) <= NANOBRAWNY_MIN_TURNS
  ) {
    while (
      haveEffect(NANOBRAWNY) <= NANOBRAWNY_MIN_TURNS &&
      genieWishesLeft() > 0
    ) {
      cliExecute("genie effect Nanobrawny");
    }
  }
  if (!nanitesUsed() && haveEffect(NANOBRAWNY) > NANOBRAWNY_MIN_TURNS) {
    shortfall -= 1;
  }

  // Fallback 2: a tryptophan dart (last resort — using it costs an adventure).
  if (POLICY.dart && shortfall > 0 && !have(TRYPTOPHAN_DART)) {
    retrieveItem(TRYPTOPHAN_DART);
  }
}
