import { OutfitSlot, OutfitSpec } from "grimoire-kolmafia";
import {
  canEquip,
  canInteract,
  Familiar,
  inebrietyLimit,
  Item,
  itemAmount,
  Location,
  myInebriety,
  totalTurnsPlayed,
} from "kolmafia";
import {
  $familiar,
  $familiars,
  $item,
  $items,
  get,
  getKramcoWandererChance,
  have,
  sumNumbers,
} from "libram";

import { freeFightFamiliar, MenuOptions } from "./familiar";
import { garboAverageValue, garboValue } from "./garboValue";
import { realmAvailable } from "./lib";

export function ifHave(slot: OutfitSlot, item: Item, condition?: () => boolean): OutfitSpec {
  return have(item) && canEquip(item) && (condition?.() ?? true)
    ? Object.fromEntries([[slot, item]])
    : {};
}

function mergeSpecs(...outfits: OutfitSpec[]): OutfitSpec {
  return outfits.reduce((current, next) => ({ ...next, ...current }), {});
}

const chooseFamiliar = (options: MenuOptions = {}): Familiar =>
  canInteract() && myInebriety() <= inebrietyLimit()
    ? $familiars`Reagnimated Gnome, Temporal Riftlet`.find((f) => have(f)) ??
      freeFightFamiliar(options)
    : freeFightFamiliar(options);

type TaskOptions = { location: Location; isFree?: boolean };
export function chooseQuestOutfit(
  { location, isFree }: TaskOptions,
  ...outfits: OutfitSpec[]
): OutfitSpec {
  const familiar = chooseFamiliar({ location });
  const famEquip =
    equipmentFamiliars.get(familiar) ??
    (familiar.elementalDamage || familiar.physicalDamage
      ? $item`tiny stillsuit`
      : $item`oversized fish scaler`);

  // each slot here is in priority order
  const offhands = mergeSpecs(
    ifHave(
      "offhand",
      $item`cursed magnifying glass`,
      () => !isFree && get("_voidFreeFights") < 5 && get("cursedMagnifyingGlassCount") < 13
    ),
    ifHave("offhand", $item`Kramco Sausage-o-Matic™`, () => getKramcoWandererChance() >= 0.04),
    ifHave("offhand", $item`carnivorous potted plant`)
  );

  const weapons = mergeSpecs(
    ifHave("weapon", $item`June cleaver`),
    ifHave("weapon", $item`Fourth of May Cosplay Saber`)
  );

  const backs = mergeSpecs(
    ifHave(
      "back",
      $item`protonic accelerator pack`,
      () =>
        get("questPAGhost") === "unstarted" && get("nextParanormalActivity") <= totalTurnsPlayed()
    ),
    ifHave("back", $item`Time Cloak`)
  );

  const spec = mergeSpecs(
    ifHave("hat", $item`Crown of Thrones`),
    offhands,
    weapons,
    backs,
    { familiar },
    ifHave("famequip", famEquip),
    ifHave(
      "pants",
      $item`designer sweatpants`,
      () => 25 * get("_sweatOutSomeBoozeUsed") + get("sweat") < 75
    )
  );

  const bestAccessories = getBestAccessories(isFree);
  for (let i = 0; i < 3; i++) {
    const accessory = bestAccessories[i];
    if (!accessory) break;
    spec[`acc${i + 1}` as OutfitSlot] = accessory;
  }
  const mergedSpec = mergeSpecs(spec, ...outfits);
  if (!have($item`Crown of Thrones`) && have($item`Buddy Bjorn`) && !("back" in mergedSpec)) {
    mergedSpec.back = $item`Buddy Bjorn`;
  }
  mergedSpec.modifier = $familiars`Reagnimated Gnome, Temporal Riftlet`.includes(familiar)
    ? "Familiar Weight"
    : "Item Drop";
  return mergedSpec;
}

const equipmentFamiliars = new Map<Familiar, Item>([
  [$familiar`Reagnimated Gnome`, $item`gnomish housemaid's kgnee`],
  [$familiar`Shorter-Order Cook`, $item`blue plate`],
  [$familiar`Stocking Mimic`, $item`bag of many confections`],
]);

function luckyGoldRing() {
  // Volcoino has a low drop rate which isn't accounted for here
  // Overestimating until it drops is probably fine, don't @ me
  const dropValues = [
    100, // 80 - 120 meat
    ...[
      itemAmount($item`hobo nickel`) > 0 ? 100 : 0, // This should be closeted
      itemAmount($item`sand dollar`) > 0 ? garboValue($item`sand dollar`) : 0, // This should be closeted
      itemAmount($item`Freddy Kruegerand`) > 0 ? garboValue($item`Freddy Kruegerand`) : 0,
      realmAvailable("sleaze") ? garboValue($item`Beach Buck`) : 0,
      realmAvailable("spooky") ? garboValue($item`Coinspiracy`) : 0,
      realmAvailable("stench") ? garboValue($item`FunFunds™`) : 0,
      realmAvailable("hot") && !get("_luckyGoldRingVolcoino") ? garboValue($item`Volcoino`) : 0,
      realmAvailable("cold") ? garboValue($item`Wal-Mart gift certificate`) : 0,
      realmAvailable("fantasy") ? garboValue($item`Rubee™`) : 0,
    ].filter((value) => value > 0),
  ];

  // Items drop every ~10 turns
  return sumNumbers(dropValues) / dropValues.length / 10;
}

const accessories = new Map<Item, (isFree?: boolean) => number>([
  [
    $item`mafia thumb ring`,
    (isFree?: boolean) => (!isFree ? (1 / 0.96 - 1) * get("valueOfAdventure") : 0),
  ],
  // 18.2 expected turns per drug
  // https://kol.coldfront.net/thekolwiki/index.php/Time-twitching_toolbelt
  [
    $item`time-twitching toolbelt`,
    () =>
      garboAverageValue(
        ...$items`future drug: Muscularactum, future drug: Smartinex, future drug: Coolscaline`
      ) / 18.2,
  ],
  [
    $item`mayfly bait necklace`,
    () => (get("_mayflySummons") < 30 ? 0.5 * garboValue($item`rose`) : 0),
  ],
  [$item`lucky gold ring`, luckyGoldRing],
  [$item`Mr. Screege's spectacles`, () => 180],
  [$item`Mr. Cheeng's spectacles`, () => 220],
]);

function getBestAccessories(isFree?: boolean) {
  return Array.from(accessories.entries())
    .filter(([item]) => have(item) && canEquip(item))
    .map(([item, valueFunction]) => [item, valueFunction(isFree)] as [Item, number])
    .sort(([, a], [, b]) => b - a)
    .map(([item]) => item)
    .splice(0, 3);
}
