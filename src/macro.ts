import { Item, Monster, Skill, haveEquipped, myFamiliar } from "kolmafia";
import {
  $familiar,
  $item,
  $items,
  $monster,
  $skill,
  SongBoom,
  StrictMacro,
  get,
  have,
} from "libram";

import { canOpenRedPresent, timeToMeatify } from "./familiar";
import { shouldRedigitize } from "./lib";

export default class Macro extends StrictMacro {
  tryHaveSkill(skill: Skill): this {
    return this.externalIf(have(skill), Macro.trySkill(skill));
  }

  static tryHaveSkill(skill: Skill): Macro {
    return new Macro().tryHaveSkill(skill);
  }

  tryHaveItem(item: Item): this {
    return this.externalIf(have(item), Macro.tryItem(item));
  }

  static seeMoreOf(monster: Monster): Macro {
    return new Macro().seeMoreOf(monster);
  }

  seeMoreOf(monster: Monster): this {
    return this.if_(
      monster,
      Macro.externalIf(
        get("olfactedMonster") !== monster && get("_olfactionsUsed") < 3,
        Macro.trySkill($skill`Transcendent Olfaction`),
      ).externalIf(
        get("_gallapagosMonster") !== monster,
        Macro.trySkill($skill`Gallapagosian Mating Call`),
      ),
    );
  }

  static tryHaveItem(item: Item): Macro {
    return new Macro().tryHaveItem(item);
  }

  redigitize(): this {
    return this.externalIf(
      shouldRedigitize(),
      Macro.if_(
        get("_sourceTerminalDigitizeMonster") ?? $monster.none,
        Macro.skill($skill`Digitize`),
      ),
    );
  }

  static redigitize(): Macro {
    return new Macro().redigitize();
  }

  doItems(): this {
    const steps = new Macro();
    const items =
      $items`train whistle, Rain-Doh blue balls, Time-Spinner, Rain-Doh indigo cup, HOA citation pad, porquoise-handled sixgun`.filter(
        (i) => have(i),
      );
    if (items.length) {
      if (!have($skill`Ambidextrous Funkslinging`)) {
        for (const item of items) steps.tryItem(item);
      } else {
        for (let i = 0; i <= items.length; i += 2) {
          const chunk = items.slice(i, i + 2);
          if (chunk.length === 2) steps.tryItem(chunk as [Item, Item]);
          else steps.tryItem(...chunk);
        }
      }
    } else {
      steps.tryHaveItem($item`seal tooth`);
    }
    return this.step(steps);
  }

  getRocks(): this {
    return this.externalIf(
      myFamiliar() === $familiar`Grey Goose` &&
        $familiar`Grey Goose`.experience >= 36,
      Macro.trySkill($skill`Emit Matter Duplicating Drones`),
    ).externalIf(
      haveEquipped($item`pro skateboard`),
      Macro.trySkill($skill`Do an epic McTwist!`),
    );
  }

  static getRocks(): Macro {
    return new Macro().getRocks();
  }

  spikes(): this {
    return this.trySkill($skill`Launch spikolodon spikes`);
  }

  static spikes(): Macro {
    return new Macro().spikes();
  }

  standardCombat(): this {
    return this.externalIf(
      canOpenRedPresent() && myFamiliar() === $familiar`Crimbo Shrub`,
      Macro.trySkill($skill`Open a Big Red Present`),
    )
      .externalIf(
        timeToMeatify() && myFamiliar() === $familiar`Grey Goose`,
        Macro.trySkill($skill`Meatify Matter`),
      )
      .externalIf(
        get("cosmicBowlingBallReturnCombats") < 1,
        Macro.trySkill($skill`Bowl Straight Up`),
      )
      .tryHaveSkill($skill`Summon Mayfly Swarm`)
      .externalIf(
        SongBoom.song() === "Total Eclipse of Your Meat",
        Macro.tryHaveSkill($skill`Sing Along`),
      )
      .tryHaveSkill($skill`Extract`)
      .tryHaveSkill($skill`Micrometeorite`)
      .doItems()
      .tryHaveSkill($skill`Nantlers`)
      .tryHaveSkill($skill`Nanoshock`)
      .tryHaveSkill($skill`Audioclasm`)
      .attack()
      .repeat();
  }

  static standardCombat(): Macro {
    return new Macro().standardCombat();
  }
}
