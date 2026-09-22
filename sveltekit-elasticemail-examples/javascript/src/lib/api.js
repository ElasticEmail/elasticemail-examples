/** Call an API route and split the outcome into { data } or { error } */
export async function callApi(url, body) {
  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return response.ok ? { data } : { error: data.error || `Request failed with status ${response.status}` };
  } catch {
    return { error: "Network error. Please try again." };
  }
}
