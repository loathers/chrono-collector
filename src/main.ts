import { Args, getTasks, Quest } from "grimoire-kolmafia";
import {
  adv1,
  canAdventure,
  cliExecute,
  myAdventures,
  myClass,
  myTurncount,
  totalTurnsPlayed,
  use,
  useSkill,
  visitUrl,
} from "kolmafia";
import {
  $class,
  $effect,
  $item,
  $items,
  $location,
  $monsters,
  $skill,
  AsdonMartin,
  CinchoDeMayo,
  Counter,
  get,
  have,
  Session,
  sinceKolmafiaRevision,
  withProperty,
} from "libram";

import { capsule } from "./capsule";
import {
  ChronerEngine,
  ChronerQuest,
  ChronerStrategy,
  ChronerTask,
} from "./engine";
import { args, printh } from "./lib";
import Macro from "./macro";
import { chooseQuestOutfit } from "./outfit";
import { rose } from "./rose";
import { future, getBestAutomatedFutureSide } from "./future";
import { setup } from "./setup";
import { bigRock } from "./rocks";

const completed = () => {
  const turncount = myTurncount();
  return args.turns > 0
    ? () => myTurncount() - turncount >= args.turns || myAdventures() === 0
    : () => myAdventures() === -args.turns;
};

function getQuest(): ChronerQuest {
  switch (args.mode) {
    case "capsule":
      return { ...capsule, completed: completed() };
    case "rose":
      return { ...rose, completed: completed() };
    case "future":
      return { ...future, completed: completed() };
    case "rock":
      return { ...bigRock, completed: completed() };
    default:
      throw "Unrecognized mode";
  }
}

export function main(command?: string) {
  Args.fill(args, command);

  if (args.help) {
    Args.showHelp(args);
    return;
  }

  sinceKolmafiaRevision(27668);

  let digitizes = -1;
  const yrTarget = $location`The Cave Before Time`;

  const quest = getQuest();
  const global: Quest<ChronerTask> = {
    name: "Global",
    completed: completed(),
    tasks: [
      {
        name: "Check Access",
        completed: () => get("timeTowerAvailable"),
        do: () => {
          visitUrl("place.php?whichplace=twitch");
          if (!get("timeTowerAvailable")) {
            throw "The Time-Twitching Tower is currently unavailable";
          }
        },
        sobriety: "either",
      },
      {
        name: "Grey You Attack Skill",
        completed: () =>
          have($skill`Nantlers`) ||
          have($skill`Nanoshock`) ||
          have($skill`Audioclasm`),
        do: $location`The Haunted Storage Room`,
        ready: () =>
          myClass() === $class`Grey Goo` &&
          canAdventure($location`The Haunted Storage Room`),
        combat: new ChronerStrategy(() => Macro.standardCombat()),
        sobriety: "sober",
        choices: { 886: 6 },
      },
      {
        name: "Clara's Bell",
        completed: () =>
          !have($item`Clara's bell`) ||
          get("_claraBellUsed") ||
          get("noncombatForcerActive"),
        do: () => {
          use($item`Clara's bell`);
        },
        sobriety: "either",
      },
      {
        name: "Fiesta Exit",
        ready: () => CinchoDeMayo.totalAvailableCinch() > 60,
        completed: () => get("noncombatForcerActive"),
        do: () => {
          const turns = totalTurnsPlayed();
          while (CinchoDeMayo.currentCinch() < 60) {
            cliExecute("rest");
            if (totalTurnsPlayed() > turns) break;
          }
          useSkill(1, $skill`Cincho: Fiesta Exit`);
        },
        sobriety: "either",
      },
      {
        name: "Proton Ghost",
        ready: () =>
          have($item`protonic accelerator pack`) &&
          get("questPAGhost") !== "unstarted" &&
          !!get("ghostLocation"),
        do: (): void => {
          const location = get("ghostLocation");
          if (location) {
            adv1(location, 0, "");
          } else {
            throw "Could not determine Proton Ghost location!";
          }
        },
        outfit: () =>
          chooseQuestOutfit(
            { location: quest.location, isFree: true },
            {
              back: $item`protonic accelerator pack`,
              avoid:
                get("ghostLocation") === $location`The Icy Peak`
                  ? $items`Great Wolf's beastly trousers`
                  : [],
            },
          ),
        completed: () => get("questPAGhost") === "unstarted",
        combat: new ChronerStrategy(() =>
          Macro.trySkill($skill`Sing Along`)
            .trySkill($skill`Shoot Ghost`)
            .trySkill($skill`Shoot Ghost`)
            .trySkill($skill`Shoot Ghost`)
            .trySkill($skill`Trap Ghost`),
        ),
        sobriety: "sober",
      },
      {
        name: "Vote Wanderer",
        ready: () =>
          have($item`"I Voted!" sticker`) &&
          totalTurnsPlayed() % 11 === 1 &&
          get("lastVoteMonsterTurn") < totalTurnsPlayed() &&
          get("_voteFreeFights") < 3,
        do: (): void => {
          adv1(quest.location, -1, "");
        },
        outfit: () =>
          chooseQuestOutfit(
            { location: quest.location, isFree: true },
            { acc3: $item`"I Voted!" sticker` },
          ),
        completed: () => get("lastVoteMonsterTurn") === totalTurnsPlayed(),
        combat: new ChronerStrategy(() => Macro.redigitize().standardCombat()),
        sobriety: "either",
      },
      {
        name: "Digitize Wanderer",
        ready: () => Counter.get("Digitize") <= 0,
        outfit: () =>
          chooseQuestOutfit({
            location: quest.location,
            isFree: get("_sourceTerminalDigitizeMonster")?.attributes.includes(
              "FREE",
            ),
          }),
        completed: () =>
          get("_sourceTerminalDigitizeMonsterCount") !== digitizes,
        do: () => {
          adv1(quest.location, -1, "");
          digitizes = get("_sourceTerminalDigitizeMonsterCount");
        },
        combat: new ChronerStrategy(() => Macro.redigitize().standardCombat()),
        sobriety: "either",
      },
      {
        name: "Void Monster",
        ready: () =>
          have($item`cursed magnifying glass`) &&
          get("cursedMagnifyingGlassCount") === 13,
        completed: () => get("_voidFreeFights") >= 5,
        outfit: () =>
          chooseQuestOutfit(
            { location: quest.location, isFree: true },
            { offhand: $item`cursed magnifying glass` },
          ),
        do: quest.location,
        sobriety: "sober",
        combat: new ChronerStrategy(() => Macro.standardCombat()),
      },
      {
        name: "Work in the Future",
        ready: () =>
          have($item`Spring Bros. ID badge`) && have($item`Boltsmann ID badge`),
        completed: () => get("_automatedFutureManufactures") >= 11,
        do: () =>
          getBestAutomatedFutureSide() === "springbros"
            ? $location`Spring Bros. Solenoids`
            : $location`Boltsmann Bearings`,
        outfit: () => ({
          acc1:
            getBestAutomatedFutureSide() === "springbros"
              ? $item`Spring Bros. ID badge`
              : $item`Boltsmann ID badge`,
        }),
        choices: {
          1512: 1,
          1513: 1,
        },
        sobriety: "either",
      },
      {
        name: "Time Capsule",
        ready: () => args.mode !== "rock",
        do: () => {
          const turns = totalTurnsPlayed();
          adv1($location`The Cave Before Time`, 0, "");
          if (
            totalTurnsPlayed() > turns &&
            get("lastEncounter") !== "Time Cave.  Period."
          ) {
            throw "We expected to force the NC";
          }
        },
        forced: true,
        sobriety: "either",
        completed: () => false,
        combat: new ChronerStrategy(() => Macro.standardCombat()),
      },
      {
        name: "Spikolodon Spikes",
        ready: () =>
          have($item`Jurassic Parka`) &&
          have($skill`Torso Awareness`) &&
          get("_spikolodonSpikeUses") < 5,
        outfit: () =>
          chooseQuestOutfit(
            { location: quest.location },
            {
              shirt: $item`Jurassic Parka`,
            },
          ),
        do: quest.location,
        completed: () => get("noncombatForcerActive"),
        prepare: () => cliExecute("parka spikolodon"),
        combat: new ChronerStrategy(() => Macro.spikes().standardCombat()),
        sobriety: "sober",
      },
      {
        name: "Bowling Ball Run",
        ready: () =>
          get("cosmicBowlingBallReturnCombats") < 1 &&
          get("hasCosmicBowlingBall"),
        do: $location`The Cave Before Time`,
        sobriety: "sober",
        completed: () => false,
        combat: new ChronerStrategy(() => {
          const romance = get("romanticTarget");
          const freeMonsters = $monsters`sausage goblin`;
          if (romance?.attributes.includes("FREE")) freeMonsters.push(romance);
          return Macro.if_(freeMonsters, Macro.standardCombat())
            .tryHaveSkill($skill`Curse of Weaksauce`)
            .trySkill($skill`Bowl a Curveball`)
            .abort();
        }),
      },
      {
        name: "Asdon Bumper",
        ready: () => AsdonMartin.installed(),
        completed: () =>
          get("banishedMonsters").includes("Spring-Loaded Front Bumper"),
        sobriety: "sober",
        do: $location`The Cave Before Time`,
        combat: new ChronerStrategy(() => {
          const romance = get("romanticTarget");
          const freeMonsters = $monsters`sausage goblin`;
          if (romance?.attributes.includes("FREE")) freeMonsters.push(romance);
          return Macro.if_(freeMonsters, Macro.standardCombat())
            .skill($skill`Asdon Martin: Spring-Loaded Front Bumper`)
            .abort();
        }),
        prepare: () => AsdonMartin.fillTo(50),
      },
      {
        name: "Asdon Missile",
        ready: () => AsdonMartin.installed(),
        completed: () => get("_missileLauncherUsed"),
        combat: new ChronerStrategy(() => {
          const romance = get("romanticTarget");
          const freeMonsters = $monsters`sausage goblin`;
          if (romance?.attributes.includes("FREE")) freeMonsters.push(romance);
          return Macro.if_(freeMonsters, Macro.standardCombat())
            .tryHaveSkill($skill`Summon Mayfly Swarm`)
            .skill($skill`Asdon Martin: Missile Launcher`)
            .abort();
        }),
        outfit: () => chooseQuestOutfit({ location: yrTarget, isFree: true }),
        prepare: () => AsdonMartin.fillTo(100),
        do: yrTarget,
        sobriety: "sober",
      },
      {
        name: "Spit Jurassic Acid",
        completed: () => have($effect`Everything Looks Yellow`),
        ready: () =>
          have($item`Jurassic Parka`) &&
          have($skill`Torso Awareness`) &&
          !get("noncombatForcerActive"),
        outfit: () =>
          chooseQuestOutfit(
            { location: yrTarget, isFree: true },
            { shirt: $item`Jurassic Parka` },
          ),
        prepare: () => cliExecute("parka dilophosaur"),
        do: yrTarget,
        combat: new ChronerStrategy(() => {
          const romance = get("romanticTarget");
          const freeMonsters = $monsters`sausage goblin`;
          if (romance?.attributes.includes("FREE")) freeMonsters.push(romance);
          return Macro.if_(freeMonsters, Macro.standardCombat())
            .tryHaveSkill($skill`Summon Mayfly Swarm`)
            .skill($skill`Spit jurassic acid`)
            .abort();
        }),
        sobriety: "sober",
      },
    ],
  };

  const engine = new ChronerEngine(getTasks([setup, global, quest]));
  engine.print();

  const sessionStart = Session.current();

  withProperty("recoveryScript", "", () => {
    try {
      engine.run();
    } finally {
      engine.destruct();
    }
  });

  const sessionResults = Session.current().diff(sessionStart);

  printh(`SESSION RESULTS:`);
  for (const [item, count] of sessionResults.items.entries()) {
    printh(`ITEM ${item} QTY ${count}`);
  }
}
