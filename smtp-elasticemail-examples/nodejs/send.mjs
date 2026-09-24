// Send one email through the Elastic Email SMTP relay using only Node.js built-ins.
// No Nodemailer, no npm install: node:net for the connection, node:tls for STARTTLS.
//
//   node --env-file=.env send.mjs
import { randomUUID } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

const host = process.env.ELASTICEMAIL_SMTP_HOST || "smtp.elasticemail.com";
const port = Number(process.env.ELASTICEMAIL_SMTP_PORT) || 2525;
const username = process.env.ELASTICEMAIL_SMTP_USERNAME;
const password = process.env.ELASTICEMAIL_SMTP_PASSWORD;
const from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
const to = process.env.EMAIL_TO || "you@yourdomain.com";

if (!username || !password) {
  console.error("Set ELASTICEMAIL_SMTP_USERNAME and ELASTICEMAIL_SMTP_PASSWORD (Settings > SMTP in the dashboard).");
  process.exit(1);
}

/** "Acme <hello@yourdomain.com>" -> "hello@yourdomain.com" */
const address = (value) => (value.match(/<([^>]+)>/)?.[1] ?? value).trim();

/** RFC 2047 encoded-word, so non-ASCII subjects and names survive */
const encodeHeader = (value) =>
  /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;

/** Base64 wrapped at 76 characters, as MIME requires */
const base64Lines = (text) => Buffer.from(text).toString("base64").replace(/.{76}/g, "$&\r\n");

/**
 * Minimal SMTP conversation over a socket. Each command waits for the full reply
 * (multi-line replies use "250-" until the last line, which uses "250 ").
 */
class SmtpConnection {
  constructor(socket) {
    this.attach(socket);
  }

  attach(socket) {
    this.socket = socket;
    this.buffer = "";
    this.waiting = null;
    // No setEncoding: the plain socket is handed to TLS later and must stay binary
    socket.on("data", (chunk) => {
      this.buffer += chunk.toString("utf8");
      this.flush();
    });
    socket.on("error", (err) => this.waiting?.reject(err));
  }

  flush() {
    const lines = this.buffer.split("\r\n");
    const last = lines.findIndex((line) => /^\d{3} /.test(line));
    if (last === -1 || !this.waiting) return;
    const reply = lines.slice(0, last + 1);
    this.buffer = lines.slice(last + 1).join("\r\n");
    const { resolve, reject, expect } = this.waiting;
    this.waiting = null;
    const code = Number(reply[last].slice(0, 3));
    if (code === expect) resolve(reply);
    else reject(new Error(`SMTP ${code}: ${reply.join(" | ")}`));
  }

  /** Send a command (or nothing, for the greeting) and wait for the expected reply code */
  command(line, expect) {
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject, expect };
      if (line !== null) this.socket.write(`${line}\r\n`);
      this.flush();
    });
  }

  /** Upgrade the plain connection to TLS after STARTTLS */
  upgrade() {
    const plain = this.socket;
    plain.removeAllListeners("data");
    return new Promise((resolve, reject) => {
      const secure = tls.connect({ socket: plain, servername: host }, () => resolve());
      secure.once("error", reject);
      this.attach(secure);
    });
  }
}

const connect = () =>
  new Promise((resolve, reject) => {
    // Port 465 is TLS from the first byte; the others start in plain text and use STARTTLS
    const socket = port === 465
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(30_000, () => socket.destroy(new Error(`Timed out talking to ${host}:${port}`)));
    socket.once("error", reject);
  });

const date = new Date().toUTCString().replace("GMT", "+0000");
const boundary = `alt-${randomUUID()}`;
const [fromName] = from.split("<");

const message = [
  `From: ${from.includes("<") ? `${encodeHeader(fromName.trim())} <${address(from)}>` : from}`,
  `To: ${to}`,
  `Subject: ${encodeHeader("Hello from Node.js over SMTP")}`,
  `Date: ${date}`,
  `Message-ID: <${randomUUID()}@${address(from).split("@")[1]}>`,
  "MIME-Version: 1.0",
  `Content-Type: multipart/alternative; boundary="${boundary}"`,
  "",
  `--${boundary}`,
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  base64Lines("It works. This message went through Elastic Email SMTP with no dependencies."),
  `--${boundary}`,
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  base64Lines("<p>It works. This message went through <strong>Elastic Email SMTP</strong> with no dependencies.</p>"),
  `--${boundary}--`,
  "",
].join("\r\n");

const smtp = new SmtpConnection(await connect());

try {
  await smtp.command(null, 220); // server greeting
  const hostname = "localhost";
  await smtp.command(`EHLO ${hostname}`, 250);

  if (port !== 465) {
    await smtp.command("STARTTLS", 220);
    await smtp.upgrade();
    await smtp.command(`EHLO ${hostname}`, 250); // capabilities change after TLS
  }

  await smtp.command("AUTH LOGIN", 334);
  await smtp.command(Buffer.from(username).toString("base64"), 334);
  await smtp.command(Buffer.from(password).toString("base64"), 235);

  await smtp.command(`MAIL FROM:<${address(from)}>`, 250);
  await smtp.command(`RCPT TO:<${address(to)}>`, 250);
  await smtp.command("DATA", 354);
  // Dot-stuffing: a line starting with "." gets an extra "." so it is not read as the end
  const reply = await smtp.command(`${message.replace(/^\./gm, "..")}\r\n.`, 250);
  console.log("Accepted:", reply.at(-1));

  await smtp.command("QUIT", 221);
} catch (err) {
  console.error("Send failed:", err.message);
  process.exitCode = 1;
} finally {
  smtp.socket.end();
}
