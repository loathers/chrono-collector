import { Args } from "grimoire-kolmafia";
import {
  Item,
  Skill,
  descToItem,
  inebrietyLimit,
  isDarkMode,
  mpCost,
  myAdventures,
  myFamiliar,
  myHp,
  myInebriety,
  myMaxhp,
  myMaxmp,
  myMp,
  print,
  runChoice,
  sessionStorage,
  totalFreeRests,
  use,
  useSkill,
  visitUrl,
} from "kolmafia";
import { $familiar, $item, SourceTerminal, get, have } from "libram";

/**
 * Find the best element of an array, where "best" is defined by some given criteria.
 * @param array The array to traverse and find the best element of.
 * @param optimizer Either a key on the objects we're looking at that corresponds to numerical values, or a function for mapping these objects to numbers. Essentially, some way of assigning value to the elements of the array.
 * @param reverse Make this true to find the worst element of the array, and false to find the best. Defaults to false.
 */
export function maxBy<T>(
  array: T[] | readonly T[],
  optimizer: (element: T) => number,
  reverse?: boolean,
): T;
export function maxBy<
  S extends string | number | symbol,
  T extends { [x in S]: number },
>(array: T[] | readonly T[], key: S, reverse?: boolean): T;
export function maxBy<
  S extends string | number | symbol,
  T extends { [x in S]: number },
>(
  array: T[] | readonly T[],
  optimizer: ((element: T) => number) | S,
  reverse = false,
): T {
  if (typeof optimizer === "function") {
    return maxBy(
      array.map((key) => ({ key, value: optimizer(key) })),
      "value",
      reverse,
    ).key;
  } else {
    return array.reduce((a, b) =>
      a[optimizer] > b[optimizer] !== reverse ? a : b,
    );
  }
}

export function shouldRedigitize(): boolean {
  const digitizesLeft = SourceTerminal.getDigitizeUsesRemaining();
  const monsterCount = SourceTerminal.getDigitizeMonsterCount() + 1;
  // triangular number * 10 - 3
  const digitizeAdventuresUsed = monsterCount * (monsterCount + 1) * 5 - 3;
  // Redigitize if fewer adventures than this digitize usage.
  return (
    SourceTerminal.have() &&
    SourceTerminal.canDigitize() &&
    myAdventures() / 0.96 < digitizesLeft * digitizeAdventuresUsed
  );
}

const HIGHLIGHT = isDarkMode() ? "yellow" : "blue";
export function printh(message: string) {
  print(message, HIGHLIGHT);
}

export function printd(message: string) {
  if (args.debug) {
    print(message, HIGHLIGHT);
  }
}

export function sober() {
  return (
    myInebriety() <=
    inebrietyLimit() + (myFamiliar() === $familiar`Stooper` ? -1 : 0)
  );
}

export const args = Args.create("chrono", "A script for farming chroner", {
  turns: Args.number({
    help: "The number of turns to run (use negative numbers for the number of turns remaining)",
    default: Infinity,
  }),
  mode: Args.string({
    options: [
      ["capsule", "Farm Time Capsules from the Cave Before Time"],
      ["future", "Farm... something from the Automated Future"],
      ["rock", "Get Caveman Dan's Favorite Rock - duped as much as possible"],
      ["rose", "Farm Roses from The Main Stage"],
      ["skeleton", "Farm rares from skeletal fascists"],
      ["soup", "Farm soup ingredients from the Primordial Stew"],
    ],
    default: "rose",
  }),
  debug: Args.flag({
    help: "Turn on debug printing",
    default: false,
  }),
});

function getCMCChoices(): { [choice: string]: number } {
  const options = visitUrl("campground.php?action=workshed");
  let i = 0;
  let match;
  const entries: [string, number][] = [];

  const regexp = /descitem\((\d+)\)/g;
  while ((match = regexp.exec(options)) !== null) {
    entries.push([`${descToItem(match[1])}`, ++i]);
  }
  return Object.fromEntries(entries);
}

export function tryGetCMCItem(item: Item): void {
  const choice = getCMCChoices()[`${item}`];
  if (choice) {
    runChoice(choice);
  }
}

export type CMCEnvironment = "u" | "i";
export function countEnvironment(environment: CMCEnvironment): number {
  return get("lastCombatEnvironments")
    .split("")
    .filter((e) => e === environment).length;
}

export type RealmType =
  | "spooky"
  | "stench"
  | "hot"
  | "cold"
  | "sleaze"
  | "fantasy"
  | "pirate";
export function realmAvailable(identifier: RealmType): boolean {
  if (identifier === "fantasy") {
    return get(`_frToday`) || get(`frAlways`);
  } else if (identifier === "pirate") {
    return get(`_prToday`) || get(`prAlways`);
  }
  return (
    get(`_${identifier}AirportToday`, false) ||
    get(`${identifier}AirportAlways`, false)
  );
}

export function freeRest(): boolean {
  if (get("timesRested") >= totalFreeRests()) return false;

  if (myHp() >= myMaxhp() && myMp() >= myMaxmp()) {
    if (have($item`awful poetry journal`)) {
      use($item`awful poetry journal`);
    } else {
      // burn some mp so that we can rest
      const bestSkill = maxBy(
        Skill.all().filter((sk) => have(sk) && mpCost(sk) >= 1),
        (sk) => -mpCost(sk),
      ); // are there any other skills that cost mana which we should blacklist?
      // Facial expressions? But this usually won't be an issue since all *NORMAL* classes have access to a level1 1mp skill
      useSkill(bestSkill);
    }
  }

  if (get("chateauAvailable")) {
    visitUrl("place.php?whichplace=chateau&action=chateau_restlabelfree");
  } else if (get("getawayCampsiteUnlocked")) {
    visitUrl("place.php?whichplace=campaway&action=campaway_tentclick");
  } else {
    visitUrl("campground.php?action=rest");
  }

  return true;
}

export function freeRestsLeft(): boolean {
  return get("timesRested") >= totalFreeRests();
}

export function getBestAutomatedFutureSide() {
  const stored = sessionStorage.getItem("automatedFutureBest");
  if (stored) return stored;

  const page = visitUrl("place.php?whichplace=twitch");
  const springbros = Number(
    page.match(/title='(-?\d+)' href=adventure.php\?snarfblat=581/)?.[1] ?? "0",
  );
  const boltsmann = Number(
    page.match(/title='(-?\d+)' href=adventure.php\?snarfblat=582/)?.[1] ?? "0",
  );
  const best = springbros > boltsmann ? "springbros" : "boltsmann";
  sessionStorage.setItem("automatedFutureBest", best);
  return best;
}
