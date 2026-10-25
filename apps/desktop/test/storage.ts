"use client";

import {
  accountDatabaseFilename,
  saveNoteOperation,
  visibleNotesSql,
} from "@noted/offline/src";
import { createDesktopDatabase } from "../src/database";

const account = location.hash === "#bob" ? "bob" : "alice";
const homeId = "10000000-0000-4000-8000-000000000001";
const boardId = "20000000-0000-4000-8000-000000000001";
const result = document.querySelector<HTMLPreElement>("#result")!;
const save = document.querySelector<HTMLButtonElement>("#save")!;
const change = document.querySelector<HTMLButtonElement>("#switch")!;
const text = document.querySelector<HTMLInputElement>("#text")!;
const database = createDesktopDatabase(
  await accountDatabaseFilename(`native-storage-fixture:${account}`),
);

async function refresh() {
  const notes = await database.getAll<{ text_content: string }>(
    visibleNotesSql,
    [boardId, homeId],
  );
  const pending = await database.getUploadQueueStats();
  const transaction = await database.getNextCrudTransaction();
  const operation = transaction?.crud[0]?.metadata;
  result.textContent = JSON.stringify(
    {
      account,
      notes: notes.map((note) => note.text_content),
      pending: pending.count,
      firstOperation: operation ? JSON.parse(operation).operationId : null,
    },
    null,
    2,
  );
}
try {
  await database.init();
  await refresh();
  save.disabled = false;
  change.disabled = false;
  save.onclick = () => {
    save.disabled = true;
    void saveNoteOperation(database, {
      kind: "create",
      operationId: crypto.randomUUID(),
      homeId,
      boardId,
      postId: crypto.randomUUID(),
      value: {
        text: text.value,
        foregroundColor: "#394b38",
        backgroundColor: "#fff1b8",
        x: 0.2,
        y: 0.2,
      },
    })
      .then(refresh)
      .catch((error: Error) => {
        result.textContent = error.message;
      })
      .finally(() => {
        save.disabled = false;
      });
  };
  change.onclick = () => {
    void database.close().then(() => {
      location.hash = account === "alice" ? "bob" : "alice";
      location.reload();
    });
  };
} catch (error) {
  result.textContent = String(error);
}
