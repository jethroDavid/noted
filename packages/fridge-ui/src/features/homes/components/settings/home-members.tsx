import type { HomeDetail } from "@noted/contracts";

export function HomeMembers({
  members,
  canRemove,
  busy,
  onRemove,
}: {
  members: HomeDetail["members"];
  canRemove: boolean;
  busy: boolean;
  onRemove: (memberId: string, label: string) => Promise<void>;
}) {
  return (
    <section aria-label="People in this home">
      <div className="home-section-heading">
        <h3>People</h3>
        <span>
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
      </div>
      <ul className="home-member-list">
        {members.map((member) => {
          const label = member.displayName || member.email;
          return (
            <li key={member.id}>
              <span className="person-avatar" aria-hidden="true">
                {label.slice(0, 1).toUpperCase()}
              </span>
              <span className="home-member-copy">
                <strong>{label}</strong>
                <small>{member.email}</small>
              </span>
              {member.isCreator ? (
                <span className="member-role">Creator</span>
              ) : (
                canRemove && (
                  <button
                    className="remove-button"
                    disabled={busy}
                    aria-label={`Remove ${label}`}
                    onClick={() =>
                      void onRemove(member.id, label).catch(() => {})
                    }
                  >
                    Remove
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
