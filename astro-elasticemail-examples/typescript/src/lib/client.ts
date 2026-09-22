// Small helpers used by the page scripts: submit a form as JSON, show the result, fill tables.

export interface ApiResult {
  error?: string;
  success?: boolean;
  [key: string]: unknown;
}

interface FormOptions {
  endpoint: string;
  method: "GET" | "POST";
  fields: string[];
  numeric?: string[];
  extra?: Record<string, unknown>;
  loadingLabel: string;
  onSuccess?: () => void;
}

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function showResult(data: ApiResult | null, working = false) {
  const box = byId<HTMLDivElement>("result");
  box.hidden = false;
  box.replaceChildren();
  if (working) {
    box.className = "result";
    box.append(el("p", "muted", "Working..."));
    return;
  }
  if (!data) {
    box.hidden = true;
    return;
  }
  if (data.error) {
    box.className = "result result-error";
    box.append(el("h3", "", "Error"), el("p", "", data.error));
    return;
  }
  box.className = "result result-success";
  box.append(el("h3", "", box.dataset.title || "Result"), el("pre", "", JSON.stringify(data, null, 2)));
}

export function bindForm(opts: FormOptions) {
  const form = byId<HTMLFormElement>("example-form");
  const button = byId<HTMLButtonElement>("submit-btn");
  const label = button.textContent;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const body: Record<string, unknown> = { ...(opts.extra ?? {}) };
    for (const name of opts.fields) {
      const value = String(formData.get(name) ?? "");
      body[name] = opts.numeric?.includes(name) ? Number(value) : value;
    }

    button.disabled = true;
    button.textContent = opts.loadingLabel;
    showResult(null, true);

    try {
      const response =
        opts.method === "GET"
          ? await fetch(`${opts.endpoint}?${new URLSearchParams(body as Record<string, string>)}`)
          : await fetch(opts.endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
      const data = (await response.json()) as ApiResult;
      showResult(data);
      if (data.success) opts.onSuccess?.();
    } catch (err) {
      showResult({ error: (err as Error).message });
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

function el(tag: string, className: string, text: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

async function loadTable(endpoint: string, key: string, row: (item: Record<string, any>) => string[]) {
  const status = byId<HTMLParagraphElement>("table-status");
  const table = byId<HTMLTableElement>("table");
  const tbody = table.querySelector("tbody") as HTMLTableSectionElement;
  try {
    const data = (await (await fetch(endpoint)).json()) as ApiResult;
    if (data.error) throw new Error(data.error);
    const items = (data[key] as Record<string, any>[]) ?? [];
    tbody.replaceChildren(
      ...items.map((item) => {
        const tr = document.createElement("tr");
        tr.append(...row(item).map((cell) => el("td", "", cell)));
        return tr;
      }),
    );
    table.hidden = items.length === 0;
    status.hidden = items.length > 0;
    status.textContent = items.length ? "" : `No ${key} yet.`;
    return data;
  } catch (err) {
    table.hidden = true;
    status.hidden = false;
    status.textContent = (err as Error).message;
    return null;
  }
}

export async function loadContacts(endpoint: string) {
  const data = await loadTable(endpoint, "contacts", (c) => [
    c.Email ?? "",
    [c.FirstName, c.LastName].filter(Boolean).join(" "),
    c.Status ?? "",
    c.DateAdded ? new Date(c.DateAdded).toLocaleDateString() : "",
  ]);
  if (data?.list) byId("list-name").textContent = String(data.list);
}

const flag = (value: unknown) => (value ? "ok" : "missing");

export function loadDomains(endpoint: string) {
  return loadTable(endpoint, "domains", (d) => [
    d.Domain ?? "",
    flag(d.Spf),
    flag(d.Dkim),
    flag(d.MX),
    flag(d.DMARC),
    d.TrackingStatus ?? "n/a",
    d.DefaultDomain ? "yes" : "no",
  ]);
}
