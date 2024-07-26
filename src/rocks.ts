import { ChronerQuest, ChronerStrategy } from "./engine";
import Macro from "./macro";
import { chooseQuestOutfit, ifHave } from "./outfit";
import {
  familiarWeight,
  handlingChoice,
  myAscensions,
  runChoice,
  toUrl,
  use,
  visitUrl,
} from "kolmafia";
import {
  $familiar,
  $item,
  $items,
  $location,
  get,
  getKramcoWandererChance,
  set,
} from "libram";

const location = $location`The Cave Before Time`;
export const bigRock: ChronerQuest = {
  name: "Get Rock",
  location,
  tasks: [
    {
      name: "getHit",
      completed: () =>
        get("_questCaveDan", 0) > 0 ||
        get("lastCaveDanDefeat", 0) >= myAscensions(),
      do: () => {
        visitUrl("place.php?whichplace=twitch&action=twitch_dancave1");
        set("_questCaveDan", 1);
      },
      sobriety: "sober",
    },
    {
      name: "rockRockRock",
      after: ["getHit"],
      completed: () =>
        get("_questCaveDan", 0) > 1 ||
        get("lastCaveDanDefeat", 0) >= myAscensions(),
      do: () => {
        visitUrl(toUrl(location));
        for (const choiceValue of [3, 1, 2, 1, 2]) {
          runChoice(choiceValue);
        }
        if (get("lastEncounter") === "Ook the Mook") {
          set("_questCaveDan", 2);
        }
      },
      outfit: () => {
        const sausageSpec =
          getKramcoWandererChance() >= 1
            ? ifHave("offhand", $item`Kramco Sausage-o-Matic™`)
            : {};
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          sausageSpec,
        );
      },
      combat: new ChronerStrategy(() => Macro.standardCombat()),
      forced: true,
      sobriety: "sober",
    },
    {
      name: "Teach Paper",
      after: ["rockRockRock"],
      completed: () =>
        get("_questCaveDan", 0) > 2 ||
        get("lastCaveDanDefeat", 0) >= myAscensions(),
      do: () => {
        visitUrl(toUrl(location));
        if (handlingChoice()) {
          runChoice(3); // 955 - Go towards noise
          runChoice(1); // 954 - Ask About Password
          runChoice(1); // 954 - Offer to Trade
          runChoice(2); // 954 - Teach Secret of Paper
        }
        if (get("lastEncounter") === "Ook the Mook") {
          set("_questCaveDan", 3);
        }
      },
      outfit: () => {
        const sausageSpec =
          getKramcoWandererChance() >= 1
            ? ifHave("offhand", $item`Kramco Sausage-o-Matic™`)
            : {};
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          sausageSpec,
        );
      },
      combat: new ChronerStrategy(() => Macro.standardCombat()),
      forced: true,
      sobriety: "sober",
    },
    {
      name: "Teach Scissors",
      after: ["Teach Paper"],
      completed: () =>
        get("_questCaveDan", 0) > 3 ||
        get("lastCaveDanDefeat", 0) >= myAscensions(),
      do: () => {
        visitUrl(toUrl(location));
        for (const choiceValue of [3, 1, 1, 2]) {
          runChoice(choiceValue);
        }
        if (get("lastEncounter") === "Ook the Mook") {
          set("_questCaveDan", 4);
        }
      },
      outfit: () => {
        const sausageSpec =
          getKramcoWandererChance() >= 1
            ? ifHave("offhand", $item`Kramco Sausage-o-Matic™`)
            : {};
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          sausageSpec,
        );
      },
      combat: new ChronerStrategy(() => Macro.standardCombat()),
      forced: true,
      sobriety: "sober",
    },
    {
      name: "RoShamBo",
      after: ["Teach Scissors"],
      completed: () =>
        get("_questCaveDan", 0) > 4 ||
        get("lastCaveDanDefeat", 0) >= myAscensions(),
      do: () => {
        visitUrl(toUrl(location));
        if (handlingChoice()) {
          runChoice(3); // 955 - Go towards noise
          runChoice(1); // 954 - Ask About Password
          runChoice(2); // 954 - Game of Chance
          while (handlingChoice()) {
            runChoice(1); // 954 - Alternating between picking Rock and continuing to play until you win.
          }
        }
        if (get("lastEncounter") === "Ook the Mook") {
          set("_questCaveDan", 5);
        }
      },
      outfit: () => {
        const sausageSpec =
          getKramcoWandererChance() >= 1
            ? ifHave("offhand", $item`Kramco Sausage-o-Matic™`)
            : {};
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          sausageSpec,
        );
      },
      combat: new ChronerStrategy(() => Macro.standardCombat()),
      forced: true,
      sobriety: "sober",
    },
    {
      name: "Charge Goose",
      after: ["RoShamBo"],
      completed: () =>
        familiarWeight($familiar`Grey Goose`) >= 7 ||
        get("_questCaveDan", 0) > 5 ||
        get("lastCaveDanDefeat", 0) >= myAscensions(),
      do: () => {
        use($item`Ghost Dog Chow`);
      },
      sobriety: "sober",
      limit: { tries: 5 },
    },
    {
      name: "CaveDan",
      after: ["Charge Goose"],
      completed: () =>
        get("_questCaveDan", 0) > 5 ||
        get("lastCaveDanDefeat", 0) >= myAscensions(),
      do: () => {
        visitUrl("place.php?whichplace=twitch&action=twitch_dancave3");
        set("_questCaveDan", 6);
        set("lastCaveDanDefeat", myAscensions());
      },
      outfit: () => {
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          { familiar: $familiar`Grey Goose`, equip: $items`pro skateboard` },
        );
      },
      combat: new ChronerStrategy(() => Macro.getRocks().standardCombat()),
      sobriety: "sober",
    },
  ],
};
