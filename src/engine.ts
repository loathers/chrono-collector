import { CombatStrategy, Engine, Outfit, Quest, Task } from "grimoire-kolmafia";
import {
  bjornifyFamiliar,
  enthroneFamiliar,
  equippedAmount,
  Location,
  setAutoAttack,
  toEffect,
} from "kolmafia";
import {
  $item,
  $skill,
  $slot,
  CrownOfThrones,
  get,
  have,
  JuneCleaver,
  PropertiesManager,
} from "libram";

import { bestJuneCleaverOption, shouldSkip } from "./juneCleaver";
import { printd, sober } from "./lib";
import Macro from "./macro";

export type ChronerTask = Task & {
  sobriety: "sober" | "drunk" | "either";
  forced?: boolean;
};

export type ChronerQuest = Quest<ChronerTask> & {
  location: Location;
};

const introAdventures = ["The Cave Before Time"];
export class ChronerStrategy extends CombatStrategy {
  constructor(macro: Macro) {
    super();
    this.macro(macro).autoattack(macro);
  }
}

function countAvailableNcForces() {
  return (get("_claraBellUsed") ? 0 : 1) + (5 - get("_spikolodonSpikeUses"));
}

let ncForced = false;
export function resetNcForced() {
  printd("Reset NC forcing");
  ncForced = false;
}
CrownOfThrones.createRiderMode("default", () => 0);
const chooseRider = () => CrownOfThrones.pickRider("default");
export class ChronerEngine extends Engine<never, ChronerTask> {
  available(task: ChronerTask): boolean {
    const sobriety =
      task.sobriety === "either" ||
      (sober() && task.sobriety === "sober") ||
      (!sober() && task.sobriety === "drunk");

    if (task.forced) {
      return sobriety && ncForced && super.available(task);
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

  execute(task: ChronerTask): void {
    const ncBefore = countAvailableNcForces();
    super.execute(task);
    const ncAfter = countAvailableNcForces();

    if (ncBefore > ncAfter) {
      ncForced = true;
    }
  }

  acquireEffects(task: ChronerTask): void {
    if (task.do instanceof Location) {
      if (task.effects === undefined) task.effects = [];
      task.effects = task.effects.concat(
        [
          $skill`Blood Bond`,
          $skill`Leash of Linguini`,
          $skill`Empathy of the Newt`,
          $skill`The Spirit of Taking`,
          $skill`Fat Leon's Phat Loot Lyric`,
          $skill`Singer's Faithful Ocelot`,
        ]
          .filter((skill) => have(skill))
          .map((skill) => toEffect(skill))
      );
    }
    super.execute(task);
  }

  setChoices(task: ChronerTask, manager: PropertiesManager): void {
    super.setChoices(task, manager);
    if (equippedAmount($item`June cleaver`) > 0) {
      this.propertyManager.setChoices(
        Object.fromEntries(
          JuneCleaver.choices.map((choice) => [
            choice,
            shouldSkip(choice) ? 4 : bestJuneCleaverOption(choice),
          ])
        )
      );
    }
    this.propertyManager.setChoices({ 955: 2 });
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
