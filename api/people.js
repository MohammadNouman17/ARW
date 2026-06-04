import { cleanCans, cleanText, ensureSchema, rowToPerson, sql } from "./db.js";

export default async function handler(request, response) {
  try {
    await ensureSchema();

    if (request.method === "GET") {
      const rows = await sql`
        SELECT *
        FROM people
        ORDER BY name ASC, id ASC
      `;
      response.status(200).json({ people: rows.map(rowToPerson) });
      return;
    }

    if (request.method === "POST") {
      const name = cleanText(request.body?.name, 80);
      const mobile = cleanText(request.body?.mobile, 24);
      const location = cleanText(request.body?.loc ?? request.body?.location, 80);
      const cans = cleanCans(request.body?.cans);

      if (!name) {
        response.status(400).json({ error: "Name is required" });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const rows = await sql`
        INSERT INTO people (name, mobile, location, cans, created_at, updated_at)
        VALUES (${name}, ${mobile}, ${location}, ${cans}, ${now}, ${now})
        RETURNING *
      `;
      response.status(201).json({ person: rowToPerson(rows[0]) });
      return;
    }

    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    response.status(500).json({ error: error.message || "Server error" });
  }
}
