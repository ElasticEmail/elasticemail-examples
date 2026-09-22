// GET  /api/contacts            -> contacts on ELASTICEMAIL_LIST_NAME
// POST /api/contacts            -> body { email, firstName?, lastName? }
import { NextResponse } from "next/server";
import { apiError, contactsApi, listName, listsApi } from "@/lib/elasticemail";

export async function GET() {
  try {
    const { data } = await listsApi.listsByListnameContactsGet(listName, 50, 0);
    return NextResponse.json({
      list: listName,
      total: data.length,
      contacts: data.map((c) => ({
        Email: c.Email,
        FirstName: c.FirstName,
        LastName: c.LastName,
        Status: c.Status,
        Source: c.Source,
        DateAdded: c.DateAdded,
      })),
    });
  } catch (err) {
    const { status, message: error } = apiError(err);
    if (status === 404) {
      return NextResponse.json({ list: listName, total: 0, contacts: [], note: "List does not exist yet" });
    }
    return NextResponse.json({ error }, { status });
  }
}

// Elastic Email lists are addressed by name, not by id. Create it if missing.
async function ensureList() {
  try {
    await listsApi.listsPost({ ListName: listName, AllowUnsubscribe: true });
  } catch (err) {
    const { status, message } = apiError(err);
    if (status === 400 && /exist/i.test(message)) return;
    throw err;
  }
}

export async function POST(request: Request) {
  const { email, firstName = "", lastName = "" } = await request.json().catch(() => ({}));

  if (!email) {
    return NextResponse.json({ error: "Missing required field: email" }, { status: 400 });
  }

  try {
    await ensureList();

    // Add the contact and put it on the list in one call
    const { data } = await contactsApi.contactsPost(
      [
        {
          Email: email,
          FirstName: firstName,
          LastName: lastName,
          Status: "Active",
        },
      ],
      [listName],
    );
    return NextResponse.json({
      success: true,
      list: listName,
      contact: { Email: data[0]?.Email, Status: data[0]?.Status, Source: data[0]?.Source },
    });
  } catch (err) {
    const { status, message: error } = apiError(err);
    return NextResponse.json({ error }, { status });
  }
}
