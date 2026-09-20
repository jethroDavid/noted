import { useState } from "react";
import { useHomes } from "../../use-homes";
import { HomeDialog } from "../home-dialog";
import { HomeMembers } from "./home-members";
import { InviteMemberForm } from "./invite-member-form";
import { RenameHomeForm } from "./rename-home-form";

export function HomeSettingsDialog({ onClose }: { onClose: () => void }) {
  const { home, busy, error, removeMember, leaveHome } = useHomes();
  const [message, setMessage] = useState("");
  if (!home) return null;
  const homeId = home.id;
  const creator = home.role === "creator";

  async function handleRemove(memberId: string, label: string) {
    setMessage("");
    const saved = await removeMember(homeId, memberId);
    if (saved) setMessage(`${label} was removed from this home.`);
  }

  function handleLeave() {
    setMessage("");
    void leaveHome(homeId);
  }

  return (
    <HomeDialog
      title={home.name}
      eyebrow="People & settings"
      busy={busy}
      error={error}
      onClose={onClose}
    >
      {!error && message && (
        <p className="home-success" role="status">
          {message}
        </p>
      )}
      <HomeMembers
        members={home.members}
        canRemove={creator}
        busy={busy}
        onRemove={handleRemove}
      />
      {creator && (
        <>
          <InviteMemberForm onFeedback={setMessage} />
          {home.pendingInvitations.length > 0 && (
            <section className="home-pending" aria-label="Pending invitations">
              <h3>Waiting for first sign-in</h3>
              <ul>
                {home.pendingInvitations.map((invite) => (
                  <li key={invite.id}>{invite.email}</li>
                ))}
              </ul>
            </section>
          )}
          <RenameHomeForm onFeedback={setMessage} />
        </>
      )}
      {!creator && (
        <div className="home-settings-section">
          <button
            className="remove-button"
            disabled={busy}
            onClick={handleLeave}
          >
            Leave this home
          </button>
          <p className="field-hint">
            You&apos;ll need a new invitation to come back.
          </p>
        </div>
      )}
    </HomeDialog>
  );
}
