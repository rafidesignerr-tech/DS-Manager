// End-to-end role checks against a running server (npm run preview). Usage: node tests/e2e.mjs <path-to-server-log>
// Needs a fresh local database with a manager created through /setup (see README).
import { readFileSync } from "node:fs";
const BASE = "http://localhost:5173";
const LOG = process.argv[2];
let pass = 0, failCount = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : failCount++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); };

class Client {
  constructor() { this.cookies = new Map(); }
  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";"); const i = pair.indexOf("=");
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c) || v === "") this.cookies.delete(k); else this.cookies.set(k, v);
    }
  }
  async get(path) { const r = await fetch(BASE + path, { redirect: "manual", headers: { cookie: this.cookieHeader() } }); this.store(r); return r; }
  async post(path, fields) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) (Array.isArray(v) ? v : [v]).forEach((x) => body.append(k, x));
    const r = await fetch(BASE + path, { method: "POST", redirect: "manual", body, headers: { cookie: this.cookieHeader(), origin: BASE, "content-type": "application/x-www-form-urlencoded" } });
    this.store(r); return r;
  }
  async json(path) { const r = await this.get(path.includes("?") ? path.replace("?", ".data?") : `${path}.data`); return r; }
}

const manager = new Client();
let r = await manager.post("/sign-in", { email: "manager@example.com", password: "sample-password-1" });
check("manager signs in", r.status === 302 && manager.cookies.size > 0, `status ${r.status}`);
check("manager sees team page", (await manager.get("/team")).status === 200);

// Invite a contributor
const email = `contrib${Date.now()}@example.com`;
r = await manager.post("/team", { intent: "invite", email, role: "contributor" });
check("manager invites contributor", r.status === 302);
await new Promise((s) => setTimeout(s, 500));
const log = readFileSync(LOG, "utf8");
const token = [...log.matchAll(/\/invite\/([A-Za-z0-9_-]+)/g)].at(-1)?.[1];
check("invitation email printed with link", !!token);

const contributor = new Client();
r = await contributor.post(`/invite/${token}`, { name: "Sample Contributor", password: "sample-password-2", confirm: "sample-password-2" });
check("contributor accepts invitation", r.status === 302, `status ${r.status}`);
check("invitation can't be reused", (await new Client().get(`/invite/${token}`)).status === 200 && (await (await new Client().get(`/invite/${token}`)).text()).includes("already used"));
check("contributor blocked from team page", (await contributor.get("/team")).status === 403);
check("contributor blocked from creating tasks (page)", (await contributor.get("/tasks/new")).status === 403);
r = await contributor.post("/tasks/new", { title: "Should fail", priority: "low" });
check("contributor blocked from creating tasks (action)", r.status === 403);

// Manager creates an unassigned To do task
r = await manager.post("/tasks/new", { title: "Sample task for review", description: "Sample", status: "todo", priority: "high", dueDate: "2026-11-05", relatedItemIds: ["sample-component-016"] });
const loc = r.headers.get("location") ?? "";
const taskPath = loc.replace(BASE, "");
check("manager creates task", r.status === 302 && taskPath.startsWith("/tasks/"), taskPath);

// Contributor: can't edit details, can self-assign
r = await contributor.post(taskPath, { intent: "details", title: "Hacked", priority: "low", assigneeId: "", dueDate: "" });
check("contributor can't edit manager fields", r.status === 403, `status ${r.status}`);
r = await contributor.post(taskPath, { intent: "status", status: "in_progress" });
check("contributor can't move unassigned task", r.status === 403, `status ${r.status}`);
r = await contributor.post(taskPath, { intent: "self_assign" });
check("contributor self-assigns", r.status === 302);
r = await new Client().post(taskPath, { intent: "self_assign" });
check("visitor can't act on task", r.status === 302 && (r.headers.get("location") ?? "").includes("/sign-in"));
r = await contributor.post(taskPath, { intent: "self_assign" });
check("second claim rejected", r.status === 409, `status ${r.status}`);
r = await contributor.post(taskPath, { intent: "status", status: "in_progress" });
check("contributor starts work", r.status === 302);
r = await contributor.post(taskPath, { intent: "status", status: "blocked", blockerReason: "" });
check("blocked without reason rejected", r.status === 400, `status ${r.status}`);
r = await contributor.post(taskPath, { intent: "status", status: "blocked", blockerReason: "Waiting on sample input" });
check("blocked with reason saved", r.status === 302);
let page = await (await contributor.get(taskPath)).text();
check("blocker reason visible on task", page.includes("Waiting on sample input"));
r = await contributor.post(taskPath, { intent: "status", status: "done" });
check("contributor can't complete (policy)", r.status === 403, `status ${r.status}`);
r = await contributor.post(taskPath, { intent: "status", status: "in_review" });
check("contributor moves to review", r.status === 302);
r = await contributor.post(taskPath, { intent: "progress", progress: "80" });
check("contributor updates progress", r.status === 302);
r = await contributor.post(taskPath, { intent: "comment", body: "Sample comment from contributor" });
check("contributor comments", r.status === 302);
page = await (await manager.get(taskPath)).text();
check("activity shows status change", page.includes("changed status from"));
check("activity shows self-assignment", page.includes("assigned the task to themselves"));
check("comment visible", page.includes("Sample comment from contributor"));
r = await manager.post(taskPath, { intent: "status", status: "done" });
check("manager completes task", r.status === 302);
r = await manager.post(taskPath, { intent: "status", status: "todo" });
check("manager reopens done task", r.status === 302);
page = await (await manager.get(taskPath)).text();
check("reopen recorded in activity", (page.match(/changed status from/g) ?? []).length >= 5);

// Notifications
page = await (await manager.get("/notifications")).text();
check("manager notified of blocked task", page.includes("Task blocked"));
check("manager notified of new comment", page.includes("New comment on a task"));
check("manager notified of invitation accepted", page.includes("Team invitation accepted"));
page = await (await contributor.get("/notifications")).text();
check("contributor notified of status change by manager", page.includes("Task status changed"));
check("actor not notified of own comment", !page.includes("New comment on a task"));
r = await contributor.post("/notifications", { intent: "read_all" });
check("mark all read", r.status === 302);
page = await (await contributor.get("/notifications?filter=unread")).text();
check("unread list empty after mark all", page.includes("all caught up"));

// Feedback
const visitor = new Client();
const sid = crypto.randomUUID();
r = await visitor.post("/feedback", { submissionId: sid, topic: "general", message: "Short", contactEmail: "" });
page = await r.text();
check("feedback validation", r.status === 200 && page.includes("at least 10 characters"));
r = await visitor.post("/feedback", { submissionId: sid, topic: "general", message: "This is a sample feedback message.", contactEmail: "" });
check("visitor submits feedback", (await r.text()).includes("Thanks, we got it"));
await visitor.post("/feedback", { submissionId: sid, topic: "general", message: "This is a sample feedback message.", contactEmail: "" });
page = await (await manager.get("/manage/feedback")).text();
check("duplicate submission stored once", (page.match(/line-clamp-2 text-paragraph-sm text-text-strong-950">This is a sample feedback message\./g) ?? []).length === 1);
check("visitor has no account cookie", ![...visitor.cookies.keys()].some((k) => k.includes("session")));
check("visitor can't see inbox", (await visitor.get("/manage/feedback")).status === 302);
page = await (await manager.get("/notifications")).text();
check("manager notified of feedback", page.includes("New feedback submitted"));
const fbId = page.match(/\/manage\/feedback\/([0-9a-f-]{36})/)?.[1];
r = await contributor.post(`/manage/feedback/${fbId}`, { intent: "status", status: "planned" });
check("contributor can't triage", r.status === 403, `status ${r.status}`);
r = await manager.post(`/manage/feedback/${fbId}`, { intent: "status", status: "planned" });
check("manager triages feedback", r.status === 302);

// Changelog
r = await manager.post("/manage/changelog/new", { title: "Sample release note", summary: "Sample summary", details: "", entryDate: "2026-11-04" });
check("manager saves draft", r.status === 302);
page = await (await manager.get("/manage/changelog")).text();
const entryId = page.match(/\/changelog\/([0-9a-f-]{36})"/)?.[1];
check("draft hidden from public list", !(await (await visitor.get("/changelog")).text()).includes("Sample release note"));
check("draft detail 404 for visitor", (await visitor.get(`/changelog/${entryId}`)).status === 404);
check("contributor can view draft", (await contributor.get(`/changelog/${entryId}`)).status === 200);
r = await contributor.post("/manage/changelog", { intent: "publish", id: entryId });
check("contributor can't publish", r.status === 403);
r = await manager.post("/manage/changelog", { intent: "publish", id: entryId });
check("manager publishes", r.status === 302);
check("published entry public", (await (await visitor.get("/changelog")).text()).includes("Sample release note"));
check("team notified of publish", (await (await contributor.get("/notifications")).text()).includes("Changelog entry published"));

// Roles and suspension
const members = await (await manager.get("/team")).text();
const contribId = members.match(/id="role-([0-9a-f-]{36})"/)?.[1];
r = await manager.post("/team", { intent: "suspend", id: contribId });
check("manager suspends contributor", r.status === 302);
check("suspended user loses access", (await contributor.get("/tasks")).status === 302);
r = await contributor.post("/sign-in", { email, password: "sample-password-2" });
check("suspended user can't sign in", r.status === 200);
await manager.post("/team", { intent: "reactivate", id: contribId });
r = await contributor.post("/sign-in", { email, password: "sample-password-2" });
check("reactivated user signs in", r.status === 302);

// Sign out
r = await contributor.post("/sign-out", {});
check("sign out", r.status === 302 && (await contributor.get("/tasks")).status === 302);

console.log(`\n${pass} passed, ${failCount} failed`);
process.exit(failCount ? 1 : 0);
