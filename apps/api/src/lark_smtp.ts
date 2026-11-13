import { randomUUID } from "node:crypto";
import tls, { type TLSSocket } from "node:tls";

export const COMMERCIAL_SENDER = "comercial@wstecnologiaaplicada.com.br";

export class LarkSmtpError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "LarkSmtpError";
  }
}

type SmtpResponse = { code: number; lines: string[] };

class SmtpSession {
  private buffer = "";
  private multiline: string[] = [];
  private readonly waiters: Array<{ resolve: (response: SmtpResponse) => void; reject: (error: Error) => void }> = [];
  private closed = false;

  constructor(private readonly socket: TLSSocket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string | Buffer) => { this.buffer += chunk.toString(); this.consume(); });
    socket.on("error", (error) => this.fail(error instanceof Error ? error : new Error("Falha no transporte SMTP")));
    socket.on("close", () => { if (!this.closed) this.fail(new Error("Conexão SMTP encerrada antes da resposta")); });
  }

  private consume() {
    while (true) {
      const end = this.buffer.indexOf("\r\n");
      if (end < 0) return;
      const line = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      if (!/^\d{3}[ -]/.test(line)) continue;
      this.multiline.push(line);
      if (line[3] !== " ") continue;
      const response: SmtpResponse = { code: Number(line.slice(0, 3)), lines: this.multiline.splice(0) };
      this.waiters.shift()?.resolve(response);
    }
  }

  private fail(error: Error) {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length) this.waiters.shift()?.reject(error);
  }

  response(): Promise<SmtpResponse> {
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async command(value: string): Promise<SmtpResponse> {
    const response = this.response();
    this.socket.write(`${value}\r\n`);
    return response;
  }

  async data(value: string): Promise<SmtpResponse> {
    const response = this.response();
    const normalized = value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    this.socket.write(normalized.endsWith("\r\n") ? normalized : `${normalized}\r\n`);
    this.socket.write(".\r\n");
    return response;
  }

  async quit() {
    if (this.closed) return;
    try { await this.command("QUIT"); } catch { /* a closed connection is already safe to finish */ }
    this.closed = true;
    this.socket.end();
  }
}

const config = () => {
  const password = process.env.LARK_SMTP_APP_PASSWORD?.trim() ?? "";
  const sender = (process.env.LARK_SMTP_USER ?? COMMERCIAL_SENDER).trim().toLowerCase();
  return { host: process.env.LARK_SMTP_HOST?.trim() || "smtp.larksuite.com", port: Number(process.env.LARK_SMTP_PORT ?? 465), sender, password };
};

export function larkSmtpStatus() {
  const current = config();
  return { configured: Boolean(current.password) && current.sender === COMMERCIAL_SENDER, sender: COMMERCIAL_SENDER, host: current.host, port: current.port };
}

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const cleanHeader = (value: string, name: string) => {
  if (/[\r\n]/.test(value)) throw new LarkSmtpError("INVALID_HEADER", `${name} inválido`);
  return value.trim();
};
const recipientList = (value: string) => value.split(/[;,]/).map((item) => item.trim()).filter(Boolean).map((item) => {
  if (!validEmail(item)) throw new LarkSmtpError("INVALID_RECIPIENT", `Destinatário inválido: ${item}`);
  return item;
});
const subjectHeader = (value: string) => `=?UTF-8?B?${Buffer.from(cleanHeader(value, "Assunto"), "utf8").toString("base64")}?=`;
const plainTextFromHtml = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").trim();

const expect = (response: SmtpResponse, codes: number[], operation: string) => {
  if (!codes.includes(response.code)) throw new LarkSmtpError(`SMTP_${response.code}`, `${operation} recusado pelo Lark (${response.code})`);
  return response;
};

async function openAuthenticatedSession() {
  const current = config();
  if (!current.password) throw new LarkSmtpError("LARK_SMTP_NOT_CONFIGURED", "Configure LARK_SMTP_APP_PASSWORD no ambiente do eChat");
  if (current.sender !== COMMERCIAL_SENDER) throw new LarkSmtpError("LARK_SMTP_SENDER_INVALID", `O remetente deve ser ${COMMERCIAL_SENDER}`);
  if (!Number.isInteger(current.port) || current.port < 1 || current.port > 65535) throw new LarkSmtpError("LARK_SMTP_PORT_INVALID", "Porta SMTP inválida");
  const socket = tls.connect({ host: current.host, port: current.port, servername: current.host, rejectUnauthorized: true });
  await new Promise<void>((resolve, reject) => { socket.once("secureConnect", resolve); socket.once("error", reject); });
  const session = new SmtpSession(socket);
  expect(await session.response(), [220], "Abertura da conexão SMTP");
  const hello = expect(await session.command("EHLO echat"), [250], "EHLO");
  const capabilities = hello.lines.join(" ").toUpperCase();
  if (capabilities.includes("AUTH PLAIN")) {
    const token = Buffer.from(`\u0000${current.sender}\u0000${current.password}`, "utf8").toString("base64");
    expect(await session.command(`AUTH PLAIN ${token}`), [235], "Autenticação Lark");
  } else {
    expect(await session.command("AUTH LOGIN"), [334], "Autenticação Lark");
    expect(await session.command(Buffer.from(current.sender, "utf8").toString("base64")), [334], "Usuário SMTP");
    expect(await session.command(Buffer.from(current.password, "utf8").toString("base64")), [235], "Senha SMTP");
  }
  return { session, sender: current.sender };
}

export async function testLarkSmtp() {
  const { session } = await openAuthenticatedSession();
  await session.quit();
  return larkSmtpStatus();
}

export async function sendLarkEmail(input: { to: string; cc?: string; bcc?: string; subject: string; bodyHtml: string; bodyText?: string }) {
  const to = recipientList(input.to);
  const cc = recipientList(input.cc ?? "");
  const bcc = recipientList(input.bcc ?? "");
  if (!to.length) throw new LarkSmtpError("INVALID_RECIPIENT", "Informe um destinatário");
  const subject = cleanHeader(input.subject, "Assunto");
  const bodyHtml = input.bodyHtml.trim();
  const bodyText = input.bodyText?.trim() || plainTextFromHtml(bodyHtml);
  const messageId = `<${randomUUID()}@echat.local>`;
  const boundary = `=_eChat_${randomUUID().replace(/-/g, "")}`;
  const current = config();
  const headers = [
    `From: ${COMMERCIAL_SENDER}`,
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${subjectHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const message = `${headers.join("\r\n")}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${bodyText}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${bodyHtml}\r\n--${boundary}--`;
  const { session, sender } = await openAuthenticatedSession();
  try {
    expect(await session.command(`MAIL FROM:<${sender}>`), [250], "Remetente");
    for (const recipient of [...to, ...cc, ...bcc]) expect(await session.command(`RCPT TO:<${recipient}>`), [250, 251], "Destinatário");
    expect(await session.command("DATA"), [354], "Conteúdo");
    expect(await session.data(message), [250], "Entrega SMTP");
    return { messageId, sender: COMMERCIAL_SENDER };
  } finally {
    await session.quit();
  }
}
