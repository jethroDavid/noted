"use client";

import { Button, Modal } from "@noted/ui/src";
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
    <Modal title="Home members" placement="side" onClose={onClose}>
      <div className="flex flex-col gap-6">
        {detail.isLoading && <p className="text-[#65705a]">Loading…</p>}
        {detail.error && (
          <p role="alert" className="text-[#85513e]">
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
                <label className="text-[17px] text-[#394b38]">
                  Home name
                  <input
                    value={nameDraft ?? home.name}
                    onChange={(event) => setNameDraft(event.target.value)}
                    maxLength={80}
                    className="mt-2 min-h-11 w-full rounded-[3px_7px_4px_6px] border border-[#829070]/40 bg-[#fffaf0] px-3 py-2 text-[19px] text-[#394b38] focus:outline-2 focus:outline-offset-2 focus:outline-[#829070]/50"
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
              <p className="text-lg font-medium text-[#394b38]">{home.name}</p>
            )}

            <section>
              <h3 className="mb-2 text-[17px] font-semibold text-[#394b38]">
                Members
              </h3>
              <ul className="flex flex-col gap-2">
                {home.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-2 text-[17px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[#394b38]">
                        {member.displayName ?? member.email}
                        {member.email === ownEmail && (
                          <span className="ml-1 text-[#65705a]">(you)</span>
                        )}
                      </span>
                      {member.displayName && (
                        <span className="block truncate text-[14px] text-[#65705a]">
                          {member.email}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {member.isCreator && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[14px] text-amber-900">
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
                          className="rounded px-2 py-0.5 text-[14px] text-[#85513e] hover:bg-[#ead5c6]"
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
                  <h3 className="mb-2 text-[17px] font-semibold text-[#394b38]">
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
                      aria-label="Email address"
                      className="min-h-11 min-w-0 flex-1 rounded-[3px_7px_4px_6px] border border-[#829070]/40 bg-[#fffaf0] p-2 text-[17px] text-[#394b38] focus:outline-2 focus:outline-offset-2 focus:outline-[#829070]/50"
                    />
                    <Button
                      type="submit"
                      disabled={invite.isPending || !inviteEmail.trim()}
                    >
                      Invite
                    </Button>
                  </form>
                  <p className="mt-1 text-[14px] text-[#65705a]">
                    They join automatically on their first Google sign-in.
                  </p>
                </section>

                {home.pendingInvitations.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-[17px] font-semibold text-[#394b38]">
                      Pending invitations
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {home.pendingInvitations.map((invitation) => (
                        <li
                          key={invitation.id}
                          className="flex items-center justify-between gap-2 text-[17px] text-[#394b38]"
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
                            className="shrink-0 rounded px-2 py-0.5 text-[14px] text-[#85513e] hover:bg-[#ead5c6]"
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
                variant="danger"
                className="self-start"
              >
                Leave home
              </Button>
            )}

            {error && (
              <p role="alert" className="text-[17px] text-[#85513e]">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
