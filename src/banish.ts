import { type OutfitSpec } from "grimoire-kolmafia";
import {
  type Item,
  type Monster,
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
  ActionSource,
  Requirement,
  get,
  have,
} from "libram";

import { garboValue } from "./garboValue";
import { maxBy, printd } from "./lib";
import Macro from "./macro";

// Resource policy (per user): full ladder — near-free weapon banishers first, then the cheaper
// of (wish Nanobrawny -> Unleash Nanites) vs (tryptophan dart), by market value. Shared by the
// Nanites/dart banishers; every other value is inlined into the banisher that uses it.
const POLICY = { wish: true, dart: true };

/**
 * A day-long-aware wrapper around libram's {@link ActionSource}. The `action` carries the
 * reusable primitive — source, macro, cost, per-slot equipment (a maximizer `Requirement`),
 * and preparation. `action.available()` (potential > 0) means "could be set up today"; the
 * fields below add what libram's banish framework lacks. Adding a banisher is one entry in
 * {@link BANISHERS}.
 */
type Banisher = {
  action: ActionSource;
  dayLong: boolean; // rest-of-day hold vs turn-based (returns / must be re-applied)
  ready?: () => boolean; // extra to fire THIS combat beyond action.available() (equipped / off cooldown / buff up)
  contains?: () => Monster | null; // the victim it is currently holding, if any
};

const notNone = (monster: Monster | null): Monster | null =>
  monster && monster !== $monster`none` ? monster : null;

/** Highest-power owned, equippable, unrestricted club — what Batter Up! needs in-hand. */
function bestClub(): Item | null {
  const clubs = Object.keys(getInventory())
    .map((name) => toItem(name))
    .filter((i) => itemType(i) === "club" && canEquip(i) && isUnrestricted(i));
  const weapon = equippedItem($slot`weapon`);
  if (itemType(weapon) === "club") clubs.push(weapon);
  return clubs.length ? maxBy(clubs, getPower) : null;
}

function nanitesUsed(): boolean {
  return get("_nanorhinoBanishedMonster") !== $monster`none`;
}

// Meat cost of locking a target via Unleash Nanites. Every wish is valued at the pocket-wish
// price (a free genie-bottle wish carries the same opportunity cost); a buff already at/over the
// threshold (40 turns) is sunk and perishable, so it's free — and urgent — to spend.
function nanitesCost(): number {
  const turns = haveEffect($effect`Nanobrawny`);
  if (nanitesUsed()) return Infinity;
  if (turns >= 40) return -1;
  return Math.ceil((40 - turns) / 20) * garboValue($item`pocket wish`);
}

// Wish Nanobrawny up to a usable level: free genie-bottle wishes first, then bought pocket
// wishes (unlimited). Each wish grants ~20 turns; Unleash Nanites needs at least 40.
function wishNanobrawny(): boolean {
  const nanobrawny = $effect`Nanobrawny`;
  const freeWishes = () =>
    $items`genie bottle, replica genie bottle`.some((b) => have(b))
      ? Math.max(0, 3 - get("_genieWishesUsed"))
      : 0;
  while (haveEffect(nanobrawny) < 40) {
    const before = haveEffect(nanobrawny);
    if (freeWishes() <= 0 && !retrieveItem($item`pocket wish`)) break;
    cliExecute("genie effect Nanobrawny");
    if (haveEffect(nanobrawny) <= before) break; // no progress -> bail
  }
  return haveEffect(nanobrawny) >= 40;
}

const bowl: Banisher = {
  action: new ActionSource(
    $skill`Bowl a Curveball`,
    () => (get("hasCosmicBowlingBall") ? 1 : 0),
    Macro.trySkill($skill`Bowl a Curveball`),
  ),
  dayLong: false,
  ready: () => get("cosmicBowlingBallReturnCombats") < 1,
  contains: () => notNone(get("_curveballMonster")),
};

const lightning: Banisher = {
  action: new ActionSource(
    $skill`Sea *dent: Throw a Lightning Bolt`,
    () =>
      have($item`Monodent of the Sea`)
        ? Math.max(0, 11 - get("_seadentLightningUsed")) // 11 uses/day
        : 0,
    Macro.trySkill($skill`Sea *dent: Throw a Lightning Bolt`),
    {
      equipmentRequirements: () =>
        new Requirement([], { forceEquip: [$item`Monodent of the Sea`] }),
    },
  ),
  dayLong: true,
  ready: () => haveEquipped($item`Monodent of the Sea`),
  contains: () => bannedBy("Sea *dent"),
};

const batter: Banisher = {
  action: new ActionSource(
    $skill`Batter Up!`,
    () =>
      myClass() === $class`Seal Clubber` &&
      have($skill`Batter Up!`) &&
      have($skill`Ire of the Orca`) && // Fury caps at 5 (needed to fire) only with Ire
      bestClub() !== null
        ? 1
        : 0,
    Macro.trySkill($skill`Batter Up!`),
    {
      equipmentRequirements: () => {
        const club = bestClub();
        return new Requirement([], { forceEquip: club ? [club] : [] });
      },
    },
  ),
  dayLong: true,
  ready: () =>
    itemType(equippedItem($slot`weapon`)) === "club" && myFury() >= 5,
};

const nanites: Banisher = {
  action: new ActionSource(
    $skill`Unleash Nanites`,
    // Pocket wishes are unlimited (buyable), so under policy Nanites is always provisionable.
    () =>
      !nanitesUsed() && (haveEffect($effect`Nanobrawny`) > 0 || POLICY.wish)
        ? 1
        : 0,
    Macro.trySkill($skill`Unleash Nanites`),
    { cost: nanitesCost, preparation: wishNanobrawny },
  ),
  dayLong: true,
  ready: () => haveEffect($effect`Nanobrawny`) >= 40,
  contains: () => notNone(get("_nanorhinoBanishedMonster")),
};

const dart: Banisher = {
  action: new ActionSource(
    $item`tryptophan dart`,
    () => (POLICY.dart ? 1 : 0),
    Macro.tryHaveItem($item`tryptophan dart`),
    // Valued at sale price even when held — a dart in inventory could be sold instead.
    {
      cost: () => garboValue($item`tryptophan dart`),
      preparation: () => retrieveItem($item`tryptophan dart`),
    },
  ),
  dayLong: true,
  ready: () => have($item`tryptophan dart`),
};

// The whole registry. Add a future banisher (Reflex Hammer, Latte lid, ice house, ...) by
// dropping one entry here — the engine below is generic over it.
const BANISHERS: Banisher[] = [bowl, lightning, batter, nanites, dart];
const DAY_LONG = BANISHERS.filter((b) => b.dayLong);

const canProvide = (b: Banisher): boolean => b.action.available();
const isReady = (b: Banisher): boolean =>
  b.action.available() && (b.ready?.() ?? true);
const isDeployed = (b: Banisher): boolean => (b.contains?.() ?? null) !== null;
const byCost = (a: Banisher, b: Banisher): number =>
  a.action.cost() - b.action.cost();

/** Monsters currently banished, paired with the banisher name from the raw property. */
function banishedEntries(): { monster: Monster; banisher: string }[] {
  const parts = get("banishedMonsters").split(":");
  const entries: { monster: Monster; banisher: string }[] = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    if (parts[i]) {
      entries.push({ monster: toMonster(parts[i]), banisher: parts[i + 1] });
    }
  }
  return entries;
}

/** The monster a banisher is currently holding, matched by its banishedMonsters name. */
function bannedBy(banisher: string): Monster | null {
  const match = banishedEntries().find(
    (e) => e.banisher.toLowerCase() === banisher.toLowerCase(),
  );
  return match?.monster ?? null;
}

/** Turn-based banishers that can each hold one target (e.g. the bowling ball). */
function turnCapacity(): number {
  return BANISHERS.filter((b) => !b.dayLong && canProvide(b)).length;
}

function availableTurnBanisher(): Banisher | null {
  return BANISHERS.find((b) => !b.dayLong && isReady(b)) ?? null;
}

/** Victims currently held by turn-based banishers — they return, so not a day-long lock. */
function turnHeldMonsters(): Monster[] {
  return BANISHERS.filter((b) => !b.dayLong)
    .map((b) => b.contains?.())
    .filter((m): m is Monster => (m ?? null) !== null);
}

/** Held by a rest-of-day banisher (i.e. banished, but not by a turn-based banisher). */
function dayLongLocked(monster: Monster): boolean {
  return (
    banishedEntries().some((e) => e.monster === monster) &&
    !turnHeldMonsters().includes(monster)
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
  return DAY_LONG.filter((b) => canProvide(b) && !isDeployed(b))
    .sort(byCost)
    .slice(0, need);
}

/** Cheapest day-long banisher usable this combat that isn't already holding a victim. */
function bestDayLong(): Banisher | null {
  return (
    DAY_LONG.filter((b) => isReady(b) && !isDeployed(b)).sort(byCost)[0] ?? null
  );
}

function selectBanisher(target: Monster, targets: Monster[]): Banisher | null {
  if (dayLongLocked(target)) return null; // already gone for the day
  const dl = bestDayLong();
  const turn = availableTurnBanisher();
  // Lock with a day-long banisher when turn-based banishers can't cover everything;
  // otherwise let the last remaining target ride a (free) turn-based banisher.
  if (dl && (locksNeeded(targets) > 0 || !turn)) return dl;
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
      printd(`Banish: ${target} -> ${banisher.action.name()}`);
      macro = macro.if_(target, banisher.action.macro);
    }
  }
  return macro.step(base());
}

/**
 * Forced equipment for the lockdown turns, taken from the first planned banisher that needs
 * gear (any slot — it comes straight off the ActionSource's maximizer `Requirement`). Empty
 * once the targets are handled, so the farming outfit returns.
 */
export function banishOutfitSpec(targets: Monster[]): OutfitSpec {
  const requirement = plannedDayLong(targets)
    .map((b) => b.action.constraints.equipmentRequirements?.())
    .find((r) => r);
  const equip = (requirement?.maximizeOptions.forceEquip ?? []).filter(
    canEquip,
  );
  return equip.length ? { equip } : {};
}

/** Acquire the resources the plan needs before adventuring (wish Nanobrawny / buy darts). */
export function prepareBanishes(targets: Monster[]): void {
  for (const banisher of plannedDayLong(targets)) {
    banisher.action.constraints.preparation?.();
  }
}
