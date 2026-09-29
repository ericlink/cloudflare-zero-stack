import { Hono } from "hono";
import { notifyOwner } from "./email";
import {
  MAX_MESSAGE_LENGTH,
  type Bindings,
  type FeedbackJson,
  type FeedbackRow,
} from "./types";

const app = new Hono<{ Bindings: Bindings }>();

function toJson(row: FeedbackRow): FeedbackJson {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    // Image uploads / R2 disabled for now
    imageUrl: null,
    createdAt: row.created_at,
  };
}

/** List recent feedback (newest first). */
app.get("/api/feedback", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, message, image_key, created_at
     FROM feedback
     ORDER BY created_at DESC, id DESC
     LIMIT 100`
  ).all<FeedbackRow>();

  return c.json({ items: (results ?? []).map(toJson) });
});

/** Create feedback (multipart or form: name, message). Image fields are ignored. */
app.post("/api/feedback", async (c) => {
  let body: Record<string, string | File>;
  try {
    body = await c.req.parseBody({ all: true });
  } catch {
    return c.json({ error: "Invalid multipart body" }, 400);
  }

  const name = String(body.name ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }
  if (name.length > 80) {
    return c.json({ error: "Name must be 80 characters or fewer" }, 400);
  }
  if (!message) {
    return c.json({ error: "Message is required" }, 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return c.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
      400
    );
  }

  // Image / R2 uploads disabled — ignore any file fields
  const imageKey: string | null = null;

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO feedback (id, name, message, image_key, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, name, message, imageKey, createdAt)
    .run();

  const row: FeedbackRow = {
    id,
    name,
    message,
    image_key: imageKey,
    created_at: createdAt,
  };

  // Fire-and-forget notification (don't fail the request if email fails)
  c.executionCtx.waitUntil(
    notifyOwner(c.env, row).catch((err) => {
      console.error("[feedback-wall] notifyOwner failed", err);
    })
  );

  return c.json({ item: toJson(row) }, 201);
});

/** Image serving disabled (R2 not configured). */
app.get("/img/:key", (c) => c.text("Not found", 404));

export default app;
