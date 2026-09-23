import { useState } from "react";
import { CreateHomeDialog } from "./create-home-dialog";
import { HomeSwitcher } from "./home-switcher";

export function HomeSwitcherView({
  playgroundHref,
}: {
  playgroundHref: string;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <HomeSwitcher
        playgroundHref={playgroundHref}
        hideError={creating}
        onCreate={() => setCreating(true)}
      />
      {creating && (
        <div className="noted-app">
          <CreateHomeDialog onClose={() => setCreating(false)} />
        </div>
      )}
    </>
  );
}
