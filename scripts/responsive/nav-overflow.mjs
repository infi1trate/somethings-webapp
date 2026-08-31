// Which element in the left nav actually scrolls horizontally, and why.
// A measured answer: overflow is a computed-style + scrollWidth fact, not a look.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3003";
const ROUTES = (process.env.ROUTES ?? "/app/tasks,/admin/mentor,/app/team").split(",");

const PROBE = `(() => {
  const out = [];
  // Every nav/aside plus their descendants — a scrollbar can belong to a child.
  const roots = Array.from(document.querySelectorAll("nav, aside, [data-slot='sidebar']"));
  const seen = new Set();
  for (const root of roots) {
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (seen.has(el)) continue; seen.add(el);
      const over = el.scrollWidth - el.clientWidth;
      if (over <= 0) continue;
      const cs = getComputedStyle(el);
      // Only a non-visible overflow-x paints a bar or steals scroll.
      if (cs.overflowX === "visible") continue;
      // WHAT is too wide: the widest child, named.
      let worst = null;
      for (const c of el.children) {
        const r = c.getBoundingClientRect();
        if (!worst || r.width > worst.w) worst = { w: Math.round(r.width), tag: c.tagName.toLowerCase(), cls: (c.className?.toString?.() ?? "").slice(0, 70) };
      }
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.toString?.() ?? "").slice(0, 80),
        client: el.clientWidth, scroll: el.scrollWidth, over,
        overflowX: cs.overflowX, overflowY: cs.overflowY,
        widestChild: worst,
      });
    }
  }
  return out;
})()`;

const b = await chromium.launch();
for (const w of [1440, 1024, 768, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    const hits = await p.evaluate(PROBE);
    if (!hits.length) { console.log(`  ${w}px ${route}: clean`); continue; }
    console.log(`\n═══ ${w}px ${route} — ${hits.length} horizontally scrollable nav element(s) ═══`);
    for (const h of hits) {
      console.log(`  <${h.tag}> client=${h.client} scroll=${h.scroll} (+${h.over}px)  overflow-x:${h.overflowX} overflow-y:${h.overflowY}`);
      console.log(`     class="${h.cls}"`);
      if (h.widestChild) console.log(`     widest child: <${h.widestChild.tag}> ${h.widestChild.w}px class="${h.widestChild.cls}"`);
    }
  }
  await ctx.close();
}
await b.close();
