"use client";

import { useState, type FormEvent } from "react";
import type { Home, HomeDetail, MeResponse } from "@noted/contracts";

import { FridgeApp } from "./fridge-app";
import type { FridgeAssets } from "./types";

export type HomePortalProps = {
  assets: FridgeAssets;
  playgroundHref: string;
  mode: "loading" | "setup" | "signed-out" | "ready";
  me: MeResponse | null;
  home: HomeDetail | null;
  busy: boolean;
  error: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onSelectHome: (id: string) => void;
  onBack: () => void;
  onCreateHome: (name: string) => Promise<void>;
  onRenameHome: (name: string) => Promise<void>;
  onInvite: (email: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onLeave: () => Promise<void>;
};

function Brand({ href }: { href: string }) {
  return (
    <a className="portal-brand" href={href} aria-label="Noted playground">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      noted<span className="brand-dot">.</span>
    </a>
  );
}

function HomeTile({ home, onOpen }: { home: Home; onOpen: () => void }) {
  return (
    <button className="portal-home-tile" onClick={onOpen}>
      <span className="portal-home-illustration" aria-hidden="true">
        <span />
      </span>
      <span className="portal-home-copy">
        <strong>{home.name}</strong>
        <small>
          {home.role === "creator" ? "Your home" : "Shared with you"}
        </small>
      </span>
      <span aria-hidden="true">↗</span>
    </button>
  );
}

export function HomePortal(props: HomePortalProps) {
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState("");
  const [email, setEmail] = useState("");
  const [showPeople, setShowPeople] = useState(false);

  async function submit(event: FormEvent, work: () => Promise<void>) {
    event.preventDefault();
    try {
      await work();
    } catch {
      // The platform controller reports the request error in the portal.
    }
  }

  if (props.home) {
    const home = props.home;
    return (
      <div className="noted-app portal-home-view">
        {props.error && (
          <p className="portal-error" role="alert">
            {props.error}
          </p>
        )}
        {showPeople && (
          <section
            className="portal-people"
            aria-label="People and home settings"
          >
            <div className="portal-people-head">
              <div>
                <p className="portal-eyebrow">Together here</p>
                <h2>People in {home.name}</h2>
              </div>
              <span>
                {home.members.length}{" "}
                {home.members.length === 1 ? "person" : "people"}
              </span>
            </div>
            <ul className="portal-member-list">
              {home.members.map((member) => (
                <li key={member.id}>
                  <span>
                    <strong>{member.displayName || member.email}</strong>
                    <small>
                      {member.email}
                      {member.isCreator ? " · Creator" : ""}
                    </small>
                  </span>
                  {home.role === "creator" && !member.isCreator && (
                    <button
                      disabled={props.busy}
                      onClick={() => {
                        void props.onRemoveMember(member.id).catch(() => {});
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {home.role === "creator" ? (
              <div className="portal-settings-grid">
                <form
                  onSubmit={(event) =>
                    submit(event, async () => {
                      await props.onInvite(email);
                      setEmail("");
                    })
                  }
                >
                  <label htmlFor="invite-email">Invite by Google email</label>
                  <div>
                    <input
                      id="invite-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      placeholder="person@gmail.com"
                    />
                    <button disabled={props.busy}>Invite</button>
                  </div>
                  <p>
                    They will see this home when they sign in. No acceptance
                    needed.
                  </p>
                </form>
                <form
                  onSubmit={(event) =>
                    submit(event, async () => {
                      await props.onRenameHome(rename);
                      setRename("");
                    })
                  }
                >
                  <label htmlFor="rename-home">Rename home</label>
                  <div>
                    <input
                      id="rename-home"
                      value={rename}
                      onChange={(event) => setRename(event.target.value)}
                      required
                      maxLength={80}
                      placeholder={home.name}
                    />
                    <button disabled={props.busy}>Save</button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                className="portal-leave"
                disabled={props.busy}
                onClick={() => {
                  void props.onLeave().catch(() => {});
                }}
              >
                Leave this home
              </button>
            )}
            {home.role === "creator" && home.pendingInvitations.length > 0 && (
              <div className="portal-pending">
                <h3>Waiting for first sign-in</h3>
                <ul>
                  {home.pendingInvitations.map((invitation) => (
                    <li key={invitation.id}>{invitation.email}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        <FridgeApp
          key={home.id}
          assets={props.assets}
          homeName={home.name}
          isPlayground={false}
          brandHref={props.playgroundHref}
          headerAction={
            <>
              <button
                onClick={() => {
                  setShowPeople(false);
                  props.onBack();
                }}
              >
                Homes
              </button>
              <button
                onClick={() => setShowPeople(!showPeople)}
                aria-expanded={showPeople}
              >
                {showPeople ? "Close people" : "People"}
              </button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="noted-app portal-shell">
      <header className="portal-header">
        <Brand href={props.playgroundHref} />
        <div>
          {props.mode === "ready" && props.me && (
            <span>{props.me.user.displayName || props.me.user.email}</span>
          )}
          {props.mode === "ready" && (
            <button onClick={props.onSignOut}>Sign out</button>
          )}
          <a href={props.playgroundHref}>Playground ↗</a>
        </div>
      </header>
      <main className="portal-main">
        <p className="portal-eyebrow">Choose a fridge</p>
        <h1>Your homes.</h1>
        {props.mode === "loading" && (
          <p role="status">Getting your homes ready…</p>
        )}
        {props.mode === "setup" && (
          <div className="portal-intro">
            <p>
              Google sign-in needs a Firebase project before shared homes can
              open.
            </p>
            <p>Follow the Firebase setup in the README, then return here.</p>
            <a className="portal-primary-link" href={props.playgroundHref}>
              Explore the fridge playground
            </a>
          </div>
        )}
        {props.mode === "signed-out" && (
          <div className="portal-intro">
            <p>Sign in to see the homes you belong to, or create a new one.</p>
            <button
              className="portal-primary"
              onClick={props.onSignIn}
              disabled={props.busy}
            >
              Continue with Google
            </button>
          </div>
        )}
        {props.error && (
          <p className="portal-error" role="alert">
            {props.error}
          </p>
        )}
        {props.mode === "ready" && props.me && (
          <div className="portal-content">
            <section aria-label="Your homes">
              <p className="portal-section-label">Places you belong</p>
              {props.me.homes.length ? (
                <div className="portal-home-list">
                  {props.me.homes.map((home) => (
                    <HomeTile
                      key={home.id}
                      home={home}
                      onOpen={() => props.onSelectHome(home.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="portal-empty">
                  No homes yet. Create one, or wait for someone to invite this
                  Google account.
                </p>
              )}
            </section>
            <section className="portal-create" aria-label="Create a home">
              <span aria-hidden="true">✳</span>
              <h2>Start a home.</h2>
              <p>
                Give your family fridge a name. You can invite people once
                you’re inside.
              </p>
              <form
                onSubmit={(event) =>
                  submit(event, async () => {
                    await props.onCreateHome(newName);
                    setNewName("");
                  })
                }
              >
                <label htmlFor="new-home-name">Home name</label>
                <input
                  id="new-home-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  required
                  maxLength={80}
                  placeholder="The Sunday home"
                />
                <button className="portal-primary" disabled={props.busy}>
                  Create home ↗
                </button>
              </form>
            </section>
          </div>
        )}
      </main>
      <footer className="portal-footer">
        noted · the little things, together
      </footer>
    </div>
  );
}
