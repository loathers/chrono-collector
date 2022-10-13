import { canInteract, Familiar } from "kolmafia";
import { $familiar, $familiars, $item, have } from "libram";

import { freeFightFamiliar } from "./freeFightFamiliar";
import { canOpenRedPresent, pocketProfessorLectures, timeToMeatify } from "./lib";

export { canOpenRedPresent, timeToMeatify, pocketProfessorLectures, freeFightFamiliar };

export const chooseFamiliar = () =>
  canInteract()
    ? $familiars`Reagnimated Gnome, Temporal Riftlet`.find((f) => have(f)) ?? freeFightFamiliar()
    : freeFightFamiliar();
export const chooseFamEquip = (fam: Familiar) =>
  fam === $familiar`Reagnimated Gnome`
    ? $item`gnomish housemaid's kgnee`
    : fam.elementalDamage || fam.physicalDamage
    ? $item`oversized fish scaler`
    : $item`tiny stillsuit`;
