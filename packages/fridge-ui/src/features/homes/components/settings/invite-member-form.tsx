import { useState, type FormEvent } from "react";
import { useHomes } from "../../use-homes";

export function InviteMemberForm({
  onFeedback,
}: {
  onFeedback: (message: string) => void;
}) {
  const { home, busy, inviteMember } = useHomes();
  const [email, setEmail] = useState("");
  if (!home) return null;
  const homeId = home.id;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    onFeedback("");
    const saved = await inviteMember(homeId, email.trim());
    if (saved) {
      setEmail("");
      onFeedback("Invitation saved. They'll see this home when they sign in.");
    }
  }

  return (
    <form className="home-form home-settings-section" onSubmit={handleSubmit}>
      <label htmlFor="invite-email">Invite someone</label>
      <p className="field-hint">
        Use their Google account email. No acceptance needed.
      </p>
      <div className="home-input-action">
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="Their Google email"
          disabled={busy}
        />
        <button className="primary-button" disabled={busy || !email.trim()}>
          Invite
        </button>
      </div>
    </form>
  );
}
