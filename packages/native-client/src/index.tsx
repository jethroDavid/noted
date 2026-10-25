"use client";

import { exportDiagnostics } from "@noted/offline/src";
import { Modal, PaperTexture } from "@noted/ui/src";
import type { MediaOperation, NoteOperation } from "@noted/validators/sync";
import type { CommonPowerSyncDatabase } from "@powersync/common";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import type { Auth, User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { NativeAttachments } from "./attachments";
import type { NativeConfiguration } from "./config";
import { NativeScenes } from "./scenes";
import { browserSignIn, openNativeSession, requiresSignIn } from "./session";
import type { NativeSession } from "./session";
import type { NativeMediaStorage } from "./storage";
import "./styles.css";

export { nativeConfiguration } from "./config";
export { createBrowserMediaStorage } from "./storage";
export type { NativeMediaStorage } from "./storage";

interface NativeAppOptions {
  exportDiagnostics?(json: string): Promise<void>;
  auth: Auth;
  configuration: NativeConfiguration;
  createDatabase(filename: string): CommonPowerSyncDatabase;
  createStorage(scope: string): NativeMediaStorage;
  openBrowser(url: string): Promise<void>;
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Your saved work remains on this device.";
}

function useRows<T>(
  database: CommonPowerSyncDatabase,
  sql: string,
  parameters: string[] = [],
) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const parametersKey = JSON.stringify(parameters);
  useEffect(() => {
    const abort = new AbortController();
    setRows([]);
    void (async () => {
      try {
        for await (const result of database.watch(
          sql,
          JSON.parse(parametersKey),
          { signal: abort.signal },
        )) {
          if (!abort.signal.aborted) {
            setRows((result.rows?._array ?? []) as T[]);
            setError(null);
          }
        }
      } catch (error) {
        if (!abort.signal.aborted) setError(message(error));
      }
    })();
    return () => abort.abort();
  }, [database, sql, parametersKey]);
  return { rows, error };
}

function NativeApp(options: NativeAppOptions) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [session, setSession] = useState<NativeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const login = useRef<AbortController | null>(null);
  const lifecycle = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => onAuthStateChanged(options.auth, setUser), [options.auth]);
  useEffect(() => () => login.current?.abort(), []);
  useEffect(() => {
    let active = true;
    let opened: NativeSession | undefined;
    setSession(null);
    const task = lifecycle.current.then(async () => {
      if (!user || !active) return;
      opened = await openNativeSession(
        user,
        options.auth,
        options.configuration,
        options.createDatabase,
        options.createStorage,
      );
      if (active) setSession(opened);
      else {
        await opened.close();
        opened = undefined;
      }
    });
    lifecycle.current = task.catch((error) => {
      if (active) setError(message(error));
    });
    return () => {
      active = false;
      if (opened) opened.active = false;
      lifecycle.current = lifecycle.current
        .catch(() => {})
        .then(async () => {
          await opened?.close();
        });
    };
  }, [
    user?.uid,
    options.auth,
    options.configuration,
    options.createDatabase,
    options.createStorage,
  ]);

  async function signIn() {
    login.current?.abort();
    const controller = new AbortController();
    login.current = controller;
    setSigningIn(true);
    setError(null);
    try {
      const token = await browserSignIn(
        options.configuration.apiUrl,
        options.openBrowser,
        setCode,
        controller.signal,
      );
      if (!controller.signal.aborted)
        await signInWithCustomToken(options.auth, token);
    } catch (error) {
      if (!controller.signal.aborted) setError(message(error));
    } finally {
      if (login.current === controller) {
        setSigningIn(false);
        setCode(null);
      }
    }
  }

  return (
    <main className="relative isolate min-h-svh px-5 py-8 sm:px-10">
      <PaperTexture />
      <div className="relative mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#829070]/30 pb-5">
          <h1 className="text-4xl font-bold">Noted</h1>
          {user && <p className="text-sm">{user.email}</p>}
        </header>
        {user && code && (
          <div role="status" className="mb-6 space-y-3">
            <p>
              Approve the sign-in in your browser using this code:{" "}
              <strong>{code}</strong>
            </p>
            <button
              className="min-h-11 underline"
              onClick={() => {
                login.current?.abort();
                setSigningIn(false);
                setCode(null);
              }}
            >
              Cancel sign-in
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mb-5 text-red-800">
            {error}
          </p>
        )}
        {user === undefined ? (
          <p role="status">Opening your notebook…</p>
        ) : !user ? (
          <section className="max-w-md space-y-6 py-12">
            <h2 className="text-2xl">Your notes, here with you.</h2>
            <p>
              Sign in once while online. Your saved homes and text notes will
              stay available on this device.
            </p>
            <button
              className="min-h-12 rounded border px-5"
              disabled={signingIn}
              onClick={() => void signIn()}
            >
              Continue with Google
            </button>
            {code && (
              <>
                <p>Approve the sign-in in your browser using this code:</p>
                <p className="text-3xl tracking-widest">{code}</p>
                <button
                  className="underline"
                  onClick={() => {
                    login.current?.abort();
                    setSigningIn(false);
                    setCode(null);
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </section>
        ) : session?.accountId === user.uid ? (
          <Workspace
            key={user.uid}
            session={session}
            auth={options.auth}
            onSignIn={() => void signIn()}
            signingIn={signingIn}
            apiUrl={options.configuration.apiUrl}
            onExport={options.exportDiagnostics}
          />
        ) : (
          <p role="status">Opening this account’s local notes…</p>
        )}
      </div>
    </main>
  );
}

interface Home {
  id: string;
  name: string;
}
interface Board {
  id: string;
  home_id: string;
}
interface Outcome {
  id: string;
  code: string;
  operation_json: string;
  outcome_json: string;
}

function Workspace({
  session,
  auth,
  onSignIn,
  signingIn,
  apiUrl,
  onExport,
}: {
  session: NativeSession;
  auth: Auth;
  onSignIn(): void;
  signingIn: boolean;
  apiUrl: string;
  onExport?: (json: string) => Promise<void>;
}) {
  const database = session.database;
  const homes = useRows<Home>(
    database,
    "SELECT h.* FROM homes h WHERE NOT EXISTS (SELECT 1 FROM revoked_homes WHERE id = h.id) ORDER BY name",
  );
  const boards = useRows<Board>(
    database,
    "SELECT b.* FROM boards b WHERE b.kind = 'fridge' AND NOT EXISTS (SELECT 1 FROM revoked_homes WHERE id = b.home_id)",
  );
  const pending = useRows<{ id: string }>(
    database,
    "SELECT id FROM note_pending",
  );
  const pendingMedia = useRows<{ id: string }>(
    database,
    "SELECT id FROM attachments WHERE state=0 AND has_synced=0",
  );
  const outcomes = useRows<Outcome>(
    database,
    "SELECT * FROM note_outcomes ORDER BY created_at",
  );
  const revoked = useRows<{ id: string }>(
    database,
    "SELECT id FROM access_notices WHERE notified = 0",
  );
  const [homeId, setHomeId] = useState<string>(
    () => localStorage.getItem(`noted-view:${auth.currentUser!.uid}`) ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(database.currentStatus);
  const [logout, setLogout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  useEffect(
    () => database.registerListener({ statusChanged: setStatus }),
    [database],
  );
  const home = homes.rows.find((home) => home.id === homeId) ?? homes.rows[0];
  const board = boards.rows.find((board) => board.home_id === home?.id);

  async function logOut(syncFirst: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (syncFirst) {
        const deadline = Date.now() + 30_000;
        while (
          (await database.getUploadQueueStats()).count > 0 ||
          (await session.attachments.pending()) > 0
        ) {
          if (Date.now() >= deadline)
            throw new Error(
              "Sync has not finished. Stay signed in and retry, or log out while keeping your local work.",
            );
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (await database.getOptional("SELECT id FROM note_outcomes LIMIT 1"))
          throw Error(
            "Some changes need your attention. Resolve the sync notices before syncing and logging out.",
          );
      }
      // Pause before removing Firebase credentials; retained files are never
      // deleted by sign-out and will only reopen for this account.
      await session.pause();
      await signOut(auth);
    } catch (error) {
      session.resume();
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3">
          Home{" "}
          <select
            className="min-h-11 rounded border px-3"
            value={home?.id ?? ""}
            onChange={(event) => {
              setHomeId(event.target.value);
              localStorage.setItem(
                `noted-view:${auth.currentUser!.uid}`,
                event.target.value,
              );
            }}
          >
            {homes.rows.map((home) => (
              <option key={home.id} value={home.id}>
                {home.name}
              </option>
            ))}
          </select>
        </label>
        <p role="status">
          {pending.rows.length + pendingMedia.rows.length
            ? "Changes pending sync"
            : status.connected
              ? "Connected"
              : "Saved on this device"}
        </p>
        <button className="min-h-11 underline" onClick={() => setLogout(true)}>
          Sign out
        </button>
        <button
          className="min-h-11 underline"
          onClick={() => setDiagnosticsOpen(true)}
        >
          Sync diagnostics
        </button>
      </div>
      {(error || homes.error || boards.error) && (
        <p role="alert" className="my-4 text-red-800">
          {error ?? homes.error ?? boards.error}
        </p>
      )}
      {(status.uploadError || status.downloadError) && (
        <div role="status" className="my-4">
          Sync is paused.{" "}
          {status.uploadError?.message ?? status.downloadError?.message} Your
          local notes are still available.
          {requiresSignIn(status.uploadError) && (
            <button
              className="ml-3 min-h-11 underline"
              disabled={signingIn}
              onClick={onSignIn}
            >
              Sign in again
            </button>
          )}
        </div>
      )}
      {revoked.rows.map((home) => (
        <div
          key={home.id}
          role="alert"
          className="my-4 border-l-2 border-amber-700 pl-4"
        >
          <p>
            Your access to a home was removed. Its pending work was discarded.
          </p>
          <button
            className="min-h-11 underline"
            onClick={() =>
              void database
                .execute(
                  "UPDATE access_notices SET notified = 1 WHERE id = ?",
                  [home.id],
                )
                .catch((error) => setError(message(error)))
            }
          >
            Dismiss
          </button>
        </div>
      ))}
      {outcomes.rows.map((outcome) => (
        <Recovery
          key={outcome.id}
          outcome={outcome}
          database={database}
          attachments={session.attachments}
          onError={setError}
        />
      ))}
      {home && board ? (
        <>
          <button
            className="min-h-12 rounded border px-5"
            onClick={() => setSceneOpen(true)}
          >
            Open {home.name}
          </button>
          {sceneOpen && (
            <div className="fixed inset-0 z-20">
              <NativeScenes
                session={session}
                auth={auth}
                apiUrl={apiUrl}
                homeId={home.id}
                onBack={() => setSceneOpen(false)}
              />
            </div>
          )}
        </>
      ) : (
        <p className="py-10">
          {status.hasSynced
            ? "No home is available yet. Create or join a home in the web app, then return here."
            : "Connect once to download your homes. Previously saved notes remain available offline."}
        </p>
      )}
      {logout && (
        <Modal
          title="Sign out"
          onClose={() => {
            if (!busy) setLogout(false);
          }}
        >
          <section className="max-w-md space-y-5">
            <h2 className="text-2xl">Before you sign out</h2>
            <p>
              Sync your changes first, or keep them on this device for the next
              time you sign in to this account.
            </p>
            <div className="flex flex-wrap gap-5">
              <button
                className="min-h-11 underline"
                disabled={busy}
                onClick={() => void logOut(true)}
              >
                {busy ? "Working…" : "Sync and log out"}
              </button>
              <button
                className="min-h-11 underline"
                disabled={busy}
                onClick={() => void logOut(false)}
              >
                Log out and keep local work
              </button>
              <button
                className="min-h-11 underline"
                disabled={busy}
                onClick={() => setLogout(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        </Modal>
      )}
      {diagnosticsOpen && (
        <Modal
          title="Export sync diagnostics"
          onClose={() => setDiagnosticsOpen(false)}
        >
          <p>
            The export includes operation IDs, stages, times, versions, and
            error codes. It excludes note text, media, tokens, and signed URLs.
            Nothing is sent automatically.
          </p>
          <button
            className="min-h-11 underline"
            onClick={() =>
              void (async () => {
                const json = await exportDiagnostics(database);
                if (onExport) await onExport(json);
                else {
                  const url = URL.createObjectURL(
                    new Blob([json], { type: "application/json" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "noted-sync-diagnostics.json";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
                setDiagnosticsOpen(false);
              })().catch((error) => setError(message(error)))
            }
          >
            Export diagnostics
          </button>
        </Modal>
      )}
    </>
  );
}

function Recovery({
  outcome,
  database,
  onError,
  attachments,
}: {
  outcome: Outcome;
  database: CommonPowerSyncDatabase;
  onError(message: string | null): void;
  attachments: NativeAttachments;
}) {
  const operation = JSON.parse(outcome.operation_json) as
    NoteOperation | MediaOperation;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const original =
    operation.kind === "create-photo" || operation.kind === "create-video"
      ? operation
      : null;
  const recoveryText =
    operation.kind === "edit"
      ? operation.patch.text
      : operation.kind === "create"
        ? operation.value.text
        : null;
  return (
    <section
      className="my-5 space-y-3 border-l-2 border-amber-700 pl-4"
      role="alert"
    >
      <p>
        {outcome.code === "DELETE_REQUIRES_CONFIRMATION"
          ? "This item changed before your removal reached the server. Review the current item before removing it again."
          : original
            ? "This media change could not be applied. Its original is still saved on this device."
            : "A change could not be applied. Any unsynced text is preserved here."}
      </p>
      {recoveryText && (
        <textarea
          className="min-h-24 w-full border p-3"
          aria-label="Preserved note text"
          readOnly
          value={recoveryText}
        />
      )}
      {original && (
        <button
          className="min-h-11 underline"
          onClick={() =>
            void attachments
              .saveAsNew(original, outcome.id)
              .catch((error) => onError(message(error)))
          }
        >
          Save original as a new item
        </button>
      )}
      <button
        className="min-h-11 underline"
        onClick={() => setConfirmDiscard(true)}
      >
        Dismiss
      </button>
      {confirmDiscard && (
        <Modal
          title="Discard this recovery copy?"
          onClose={() => setConfirmDiscard(false)}
        >
          <p>
            {original
              ? "This removes the rejected original from this device. Save it as a new item first if you want to keep it."
              : "This removes the notice and any preserved text."}
          </p>
          <button
            className="min-h-11 underline"
            onClick={() =>
              void (
                original
                  ? attachments.discard(original.assetId, outcome.id)
                  : database.execute("DELETE FROM note_outcomes WHERE id=?", [
                      outcome.id,
                    ])
              ).catch((error) => onError(message(error)))
            }
          >
            Discard recovery copy
          </button>
        </Modal>
      )}
    </section>
  );
}

export function mountNativeApp(options: NativeAppOptions) {
  const root = document.getElementById("root");
  if (!root) throw new Error("The native application root is missing.");
  createRoot(root).render(<NativeApp {...options} />);
}
