"use client";

import { Button } from "@noted/ui/src";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../platform/auth/auth-provider";
import { useTRPC } from "../../trpc/react";

interface MembersPanelProps {
  homeId: string;
  onClose: () => void;
  onLeave: () => void;
}

export function MembersPanel({ homeId, onClose, onLeave }: MembersPanelProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detailOptions = trpc.homes.get.queryOptions({ homeId });
  const detail = useQuery(detailOptions);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: detailOptions.queryKey });
  };

  const mutateOptions = {
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (mutationError: { message: string }) =>
      setError(mutationError.message),
  };
  const rename = useMutation(trpc.homes.rename.mutationOptions(mutateOptions));
  const invite = useMutation(
    trpc.homes.invite.mutationOptions({
      ...mutateOptions,
      onSuccess: () => {
        setInviteEmail("");
        mutateOptions.onSuccess();
      },
    }),
  );
  const revoke = useMutation(
    trpc.homes.revokeInvitation.mutationOptions(mutateOptions),
  );
  const remove = useMutation(
    trpc.homes.removeMember.mutationOptions(mutateOptions),
  );
  const leave = useMutation(
    trpc.homes.leave.mutationOptions({
      ...mutateOptions,
      onSuccess: () => onLeave(),
    }),
  );

  const home = detail.data?.home;
  const isCreator = home?.role === "creator";
  const ownEmail = auth.status === "signed-in" ? (auth.user.email ?? "") : "";

  return (
    <aside
      aria-label="Home members"
      className="fixed top-0 right-0 z-40 flex h-full w-80 flex-col gap-5 overflow-y-auto bg-white p-5 shadow-2xl"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Home</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close members panel"
          className="rounded px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
        >
          x
        </button>
      </div>

      {detail.isLoading && <p className="text-slate-600">Loading…</p>}
      {detail.error && (
        <p role="alert" className="text-red-600">
          {detail.error.message}
        </p>
      )}

      {home && (
        <>
          {isCreator ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (nameDraft !== null && nameDraft.trim()) {
                  rename.mutate({ homeId, name: nameDraft.trim() });
                }
              }}
              className="flex flex-col gap-2"
            >
              <label className="text-sm text-slate-700">
                Home name
                <input
                  value={nameDraft ?? home.name}
                  onChange={(event) => setNameDraft(event.target.value)}
                  maxLength={80}
                  className="mt-1 w-full rounded border border-slate-300 p-2 text-slate-900"
                />
              </label>
              <Button
                type="submit"
                disabled={rename.isPending || nameDraft === null}
                className="self-start"
              >
                Rename
              </Button>
            </form>
          ) : (
            <p className="text-lg font-medium text-slate-900">{home.name}</p>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Members
            </h3>
            <ul className="flex flex-col gap-2">
              {home.members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-slate-900">
                      {member.displayName ?? member.email}
                      {member.email === ownEmail && (
                        <span className="ml-1 text-slate-500">(you)</span>
                      )}
                    </span>
                    {member.displayName && (
                      <span className="block truncate text-xs text-slate-500">
                        {member.email}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {member.isCreator && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                        creator
                      </span>
                    )}
                    {isCreator && !member.isCreator && (
                      <button
                        type="button"
                        aria-label={`Remove ${member.email}`}
                        onClick={() =>
                          remove.mutate({ homeId, userId: member.id })
                        }
                        className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {isCreator && (
            <>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">
                  Invite by email
                </h3>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (inviteEmail.trim()) {
                      invite.mutate({ homeId, email: inviteEmail.trim() });
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="family@example.com"
                    className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-sm text-slate-900"
                  />
                  <Button type="submit" disabled={invite.isPending}>
                    Invite
                  </Button>
                </form>
                <p className="mt-1 text-xs text-slate-500">
                  They join automatically on their first Google sign-in.
                </p>
              </section>

              {home.pendingInvitations.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    Pending invitations
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {home.pendingInvitations.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="flex items-center justify-between gap-2 text-sm text-slate-900"
                      >
                        <span className="truncate">{invitation.email}</span>
                        <button
                          type="button"
                          onClick={() =>
                            revoke.mutate({
                              homeId,
                              invitationId: invitation.id,
                            })
                          }
                          className="shrink-0 rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {!isCreator && (
            <Button
              onClick={() => leave.mutate({ homeId })}
              disabled={leave.isPending}
              className="self-start bg-red-600"
            >
              Leave home
            </Button>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
