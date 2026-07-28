import {
  CombatStrategy,
  Engine,
  type Outfit,
  type Quest,
  type Task,
} from "grimoire-kolmafia";
import {
  type Item,
  type Location,
  bjornifyFamiliar,
  enthroneFamiliar,
  equippedAmount,
  myAscensions,
  setAutoAttack,
} from "kolmafia";
import {
  $item,
  $slot,
  CrownOfThrones,
  JuneCleaver,
  type PropertiesManager,
  get,
  sum,
  sumNumbers,
} from "libram";

import { garboAverageValue, garboValue } from "./garboValue";
import { bestJuneCleaverOption, shouldSkip } from "./juneCleaver";
import { args, printd, sober } from "./lib";
import type Macro from "./macro";

export type ChronerTask = Task & {
  sobriety: "sober" | "drunk" | "either";
  forced?: boolean;
};

export type ChronerQuest = Quest<ChronerTask> & {
  location: Location;
};

const introAdventures = ["The Cave Before Time"];
export class ChronerStrategy extends CombatStrategy {
  constructor(macro: () => Macro) {
    super();
    this.macro(macro).autoattack(macro);
  }
}

function dropsValueFunction(drops: Item[] | Map<Item, number>): number {
  return Array.isArray(drops)
    ? garboAverageValue(...drops)
    : sum(
        [...drops.entries()],
        ([item, quantity]) => quantity * garboValue(item),
      ) / sumNumbers([...drops.values()]);
}

CrownOfThrones.createRiderMode("default", { dropsValueFunction });
const chooseRider = () => CrownOfThrones.pickRider("default");
export class ChronerEngine extends Engine<never, ChronerTask> {
  available(task: ChronerTask): boolean {
    const sobriety =
      task.sobriety === "either" ||
      (sober() && task.sobriety === "sober") ||
      (!sober() && task.sobriety === "drunk");

    if (task.forced) {
      return sobriety && get("noncombatForcerActive") && super.available(task);
    }
    return sobriety && super.available(task);
  }

  createOutfit(task: ChronerTask): Outfit {
    const outfit = super.createOutfit(task);
    if (outfit.equips.get($slot`hat`) === $item`Crown of Thrones`) {
      const choice = chooseRider();
      if (choice) enthroneFamiliar(choice.familiar);
    } else if (outfit.equips.get($slot`back`) === $item`Buddy Bjorn`) {
      const choice = chooseRider();
      if (choice) bjornifyFamiliar(choice.familiar);
    }
    return outfit;
  }

  setChoices(task: ChronerTask, manager: PropertiesManager): void {
    // Withheld until Caveman Dan is settled: those tasks resolve choice 955 via runChoice.
    if (
      args.mode !== "rock" ||
      get("_questCaveDan", 0) > 4 ||
      get("lastCaveDanDefeat", 0) >= myAscensions()
    ) {
      manager.setChoice(955, 2);
    }

    super.setChoices(task, manager);
    if (equippedAmount($item`June cleaver`) > 0) {
      this.propertyManager.setChoices(
        Object.fromEntries(
          JuneCleaver.choices.map((choice) => [
            choice,
            shouldSkip(choice) ? 4 : bestJuneCleaverOption(choice),
          ]),
        ),
      );
    }
  }

  shouldRepeatAdv(task: ChronerTask): boolean {
    if (["Poetic Justice", "Lost and Found"].includes(get("lastEncounter"))) {
      printd("Skipping repeating Adventure despite free NC (beaten up)");
      return false;
    }
    if (introAdventures.includes(get("lastEncounter"))) {
      printd(`Hit Intro adventure ${get("lastEncounter")} which is a free NC`);
      return true;
    }
    return super.shouldRepeatAdv(task);
  }

  print() {
    printd(`Task List:`);
    for (const task of this.tasks) {
      printd(`${task.name}: available:${this.available(task)}`);
    }
  }

  destruct(): void {
    super.destruct();
    setAutoAttack(0);
  }
}
