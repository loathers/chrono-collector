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

const MONODENT = $item`Monodent of the Sea`;
const TRYPTOPHAN_DART = $item`tryptophan dart`;
const POCKET_WISH = $item`pocket wish`;
const GENIE_BOTTLES = $items`genie bottle, replica genie bottle`;

// Resource policy (per user): full ladder — near-free weapon banishers first, then the
// cheaper of (wish Nanobrawny -> Unleash Nanites) vs (tryptophan dart), by market value.
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

// Meat cost of locking a target with each paid day-long fallback, for choosing between them.
// Every wish is valued at the pocket-wish price: free genie-bottle wishes could otherwise be
// spent on a pocket wish's worth of effect, so they carry the same opportunity cost.
function nanitesCost(): number {
  if (nanitesUsed()) return Infinity;
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
  // Pocket wishes are unlimited (buyable), so under policy Nanites is always provisionable.
  canProvide: () =>
    !nanitesUsed() && (haveEffect(NANOBRAWNY) > 0 || POLICY.wish),
  available: () =>
    !nanitesUsed() && haveEffect(NANOBRAWNY) >= NANOBRAWNY_MIN_TURNS,
  macro: () => Macro.trySkill($skill`Unleash Nanites`),
};

const dart: Banisher = {
  source: TRYPTOPHAN_DART,
  dayLong: true,
  canProvide: () => POLICY.dart,
  available: () => have(TRYPTOPHAN_DART),
  macro: () => Macro.tryHaveItem(TRYPTOPHAN_DART),
};

// Weapon-based (near-free) banishers first, then the two priced fallbacks. Which priced
// fallback is actually stocked is decided by price in prepareBanishes; Nanites is promoted
// ahead of everything when its buff is already up, so a decaying Nanobrawny isn't wasted.
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

/** Acquire the resources the plan needs before adventuring (wish Nanobrawny / buy darts). */
export function prepareBanishes(targets: Monster[]): void {
  const need = locksNeeded(targets);
  if (need <= 0) return;

  // Near-free, weapon-based day-long banishers we can deploy without buying anything.
  const cheap = [lightning, batter].filter((b) => b.canProvide()).length;
  let shortfall = need - cheap;
  if (shortfall <= 0) return;

  // Nanites locks one monster/day, so use it for a single lock when it's the cheaper of the
  // two priced fallbacks (dart vs wish), then cover any remaining locks with darts.
  if (
    shortfall > 0 &&
    POLICY.wish &&
    !nanitesUsed() &&
    (!POLICY.dart || nanitesCost() <= dartCost())
  ) {
    wishNanobrawny();
    if (haveEffect(NANOBRAWNY) >= NANOBRAWNY_MIN_TURNS) shortfall -= 1;
  }

  if (shortfall > 0 && POLICY.dart) {
    retrieveItem(TRYPTOPHAN_DART, shortfall);
  }
}
