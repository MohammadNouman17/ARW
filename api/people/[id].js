import { cleanCans, cleanText, ensureSchema, rowToPerson, sql } from "../db.js";

export default async function handler(request, response) {
  try {
    await ensureSchema();

    const id = Number.parseInt(request.query.id, 10);
    if (!Number.isFinite(id)) {
      response.status(400).json({ error: "Invalid person id" });
      return;
    }

    if (request.method === "PATCH") {
      const existing = await sql`SELECT * FROM people WHERE id = ${id}`;
      if (existing.length === 0) {
        response.status(404).json({ error: "Person not found" });
        return;
      }

      const current = existing[0];
      const next = {
        name: Object.hasOwn(request.body || {}, "name") ? cleanText(request.body.name, 80) : current.name,
        mobile: Object.hasOwn(request.body || {}, "mobile") ? cleanText(request.body.mobile, 24) : current.mobile,
        location: Object.hasOwn(request.body || {}, "loc") || Object.hasOwn(request.body || {}, "location")
          ? cleanText(request.body.loc ?? request.body.location, 80)
          : current.location,
        cans: Object.hasOwn(request.body || {}, "cans") ? cleanCans(request.body.cans) : current.cans,
      };

      if (!next.name) {
        response.status(400).json({ error: "Name is required" });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const rows = await sql`
        UPDATE people
        SET name = ${next.name},
            mobile = ${next.mobile},
            location = ${next.location},
            cans = ${next.cans},
            updated_at = ${now}
        WHERE id = ${id}
        RETURNING *
      `;
      response.status(200).json({ person: rowToPerson(rows[0]) });
      return;
    }

    if (request.method === "DELETE") {
      const rows = await sql`
        DELETE FROM people
        WHERE id = ${id}
        RETURNING id
      `;
      response.status(200).json({ deleted: rows.length > 0 });
      return;
    }

    response.setHeader("Allow", "PATCH, DELETE");
    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    response.status(500).json({ error: error.message || "Server error" });
  }
}
