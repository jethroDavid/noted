import { useContext } from "react";
import { HomesContext } from "./homes-context";

/** Read the existing provider's state and operations; do not create new state. */
export function useHomes() {
  const homes = useContext(HomesContext);
  if (!homes) throw new Error("useHomes must be used inside HomesProvider.");
  return homes;
}
