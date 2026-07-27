import { type OutfitSpec } from "grimoire-kolmafia";
import {
  Item,
  type Monster,
  canEquip,
  cliExecute,
  equippedItem,
  haveEffect,
  haveEquipped,
  itemType,
  myClass,
  myFury,
  retrieveItem,
  toMonster,
  weaponHands,
} from "kolmafia";
import {
  $class,
  $effect,
  $item,
  $monster,
  $skill,
  $slot,
  ActionSource,
  get,
  have,
  multiSplit,
} from "libram";

import { garboValue } from "./garboValue";
import { printd } from "./lib";
import Macro from "./macro";

/**
 * Wraps libram's {@link ActionSource} (source, macro, cost, preparation). `action.available()`
 * (potential > 0) means "could be set up today"; `ready`/`contains`/`outfit` add the rest.
 */
type Banisher = {
  action: ActionSource;
  dayLong: boolean;
  ready: () => boolean;
  contains: () => Monster | null;
  outfit?: () => OutfitSpec;
};

const notNone = (monster: Monster | null): Monster | null =>
  monster === $monster`none` ? null : monster;

/** Best owned, equippable club — 1-handed preferred so it doesn't take the offhand slot. */
function bestClub(): Item {
  const clubs = Item.all().filter(
    (i) => have(i) && canEquip(i) && itemType(i) === "club",
  );
  return (
    clubs.find((i) => weaponHands(i) === 1) ??
    clubs.find((i) => weaponHands(i) === 2) ??
    $item`seal-clubbing club`
  );
}

// The bowling ball is intentionally absent: the global "Bowling Ball Run" task
// (src/main.ts) recycles it every time it returns, so hamlet can't rely on it — every
// target needs its own day-long banisher.
const BANISHERS: Banisher[] = [
  {
    action: new ActionSource(
      $skill`Sea *dent: Throw a Lightning Bolt`,
      () =>
        have($item`Monodent of the Sea`)
          ? Math.max(0, 11 - get("_seadentLightningUsed")) // 11 uses/day
          : 0,
      Macro.trySkill($skill`Sea *dent: Throw a Lightning Bolt`),
    ),
    dayLong: true,
    ready: () => haveEquipped($item`Monodent of the Sea`),
    contains: () => banishedBy("Sea *dent"),
    outfit: () => ({ weapon: $item`Monodent of the Sea` }),
  },
  {
    action: new ActionSource(
      $skill`Batter Up!`,
      () =>
        myClass() === $class`Seal Clubber` &&
        have($skill`Batter Up!`) &&
        have($skill`Ire of the Orca`) // Fury caps at 5 (needed to fire) only with Ire
          ? 1
          : 0,
      Macro.trySkill($skill`Batter Up!`),
      { preparation: () => retrieveItem(bestClub()) },
    ),
    dayLong: true,
    ready: () =>
      itemType(equippedItem($slot`weapon`)) === "club" && myFury() >= 5,
    contains: () => banishedBy("Batter Up!"),
    outfit: () => ({ weapon: bestClub() }),
  },
  {
    action: new ActionSource(
      $skill`Unleash Nanites`,
      () => (get("_nanorhinoBanishedMonster") === $monster`none` ? 1 : 0),
      Macro.trySkill($skill`Unleash Nanites`),
      {
        cost: () => {
          const turns = haveEffect($effect`Nanobrawny`);
          if (get("_nanorhinoBanishedMonster") !== $monster`none`)
            return Infinity;
          if (turns >= 40) return -1;
          return Math.ceil((40 - turns) / 20) * garboValue($item`pocket wish`);
        },
        preparation: () => {
          while (haveEffect($effect`Nanobrawny`) < 40) {
            const before = haveEffect($effect`Nanobrawny`);
            if (!cliExecute("genie effect Nanobrawny")) break;
            if (haveEffect($effect`Nanobrawny`) <= before) break;
          }
          return haveEffect($effect`Nanobrawny`) >= 40;
        },
      },
    ),
    dayLong: true,
    ready: () => haveEffect($effect`Nanobrawny`) >= 40,
    contains: () => notNone(get("_nanorhinoBanishedMonster")),
  },
  {
    action: new ActionSource(
      $item`tryptophan dart`,
      () => 1,
      Macro.tryHaveItem($item`tryptophan dart`),
      {
        cost: () => garboValue($item`tryptophan dart`),
        preparation: () => retrieveItem($item`tryptophan dart`),
      },
    ),
    dayLong: true,
    ready: () => have($item`tryptophan dart`),
    contains: () => banishedBy("tryptophan dart"),
  },
];
const DAY_LONG = BANISHERS.filter((b) => b.dayLong);

const canProvide = (b: Banisher): boolean => b.action.available();
const isReady = (b: Banisher): boolean => b.action.available() && b.ready();
const isDeployed = (b: Banisher): boolean => b.contains() !== null;
const byCost = (a: Banisher, b: Banisher): number =>
  a.action.cost() - b.action.cost();

// Monsters currently banished, paired with the raw banisher name. We reuse libram's
// `multiSplit` (the primitive under `getBanishedMonsters`) but keep the banisher name as a
// plain string instead of resolving it to an Item/Skill — that resolution collapses the
// several banishers that map to `none` (e.g. Bowl a Curveball, Batter Up!) onto one key.
function banishedEntries(): { monster: Monster; banisher: string }[] {
  return multiSplit<[Monster, string, number]>("banishedMonsters", ":", ":", [
    toMonster,
    (s) => s,
    Number,
  ]).map(([monster, banisher]) => ({ monster, banisher }));
}

function banishedBy(banisher: string): Monster | null {
  const match = banishedEntries().find(
    (e) => e.banisher.toLowerCase() === banisher.toLowerCase(),
  );
  return match?.monster ?? null;
}

function turnCapacity(): number {
  return BANISHERS.filter((b) => !b.dayLong && canProvide(b)).length;
}

function availableTurnBanisher(): Banisher | null {
  return BANISHERS.find((b) => !b.dayLong && isReady(b)) ?? null;
}

/** Victims currently held by turn-based banishers — they return, so not a day-long lock. */
function turnHeldMonsters(): Monster[] {
  return BANISHERS.filter((b) => !b.dayLong)
    .map((b) => b.contains())
    .filter((m) => m !== null);
}

function dayLongLocked(monster: Monster): boolean {
  return (
    banishedEntries().some((e) => e.monster === monster) &&
    !turnHeldMonsters().includes(monster)
  );
}

function locksNeeded(targets: Monster[]): number {
  const unlocked = targets.filter((t) => !dayLongLocked(t)).length;
  return Math.max(0, unlocked - turnCapacity());
}

function plannedDayLong(targets: Monster[]): Banisher[] {
  const need = locksNeeded(targets);
  if (need <= 0) return [];
  return DAY_LONG.filter((b) => canProvide(b) && !isDeployed(b))
    .sort(byCost)
    .slice(0, need);
}

function bestDayLong(): Banisher | null {
  return (
    DAY_LONG.filter((b) => isReady(b) && !isDeployed(b)).sort(byCost)[0] ?? null
  );
}

function selectBanisher(target: Monster, targets: Monster[]): Banisher | null {
  if (dayLongLocked(target)) return null;
  const dl = bestDayLong();
  const turn = availableTurnBanisher();
  // Lock with a day-long banisher when turn-based banishers can't cover everything;
  // otherwise let the last remaining target ride a (free) turn-based banisher.
  if (dl && (locksNeeded(targets) > 0 || !turn)) return dl;
  if (turn) return turn;
  return dl;
}

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

export function banishOutfitSpec(targets: Monster[]): OutfitSpec {
  return (
    plannedDayLong(targets)
      .find((b) => b.outfit)
      ?.outfit?.() ?? {}
  );
}

export function prepareBanishes(targets: Monster[]): void {
  for (const banisher of plannedDayLong(targets)) {
    banisher.action.constraints.preparation?.();
  }
}
