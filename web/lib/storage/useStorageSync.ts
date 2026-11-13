import { useEffect } from "react";
import { browserStorage, load, type State } from ".";

// Pages save from the State they loaded at mount, so a stale tab would erase another tab's progress.
// With blocked storage load(null) is the empty state and would wipe the game held in memory: skip it.
export function useStorageSync(setState: (s: State) => void) {
  useEffect(() => {
    const reload = () => {
      const storage = browserStorage();
      if (storage) setState(load(storage));
    };
    const visible = () => document.visibilityState === "visible" && reload();
    window.addEventListener("storage", reload);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("storage", reload);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [setState]);
}
