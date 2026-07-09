import { chromium } from 'playwright';
const BASE='https://dev.ekatmdhamlibrary.xoidlabs.com';
const b=await chromium.launch();
for (const th of ['light','dark']) {
  const p=await b.newPage({viewport:{width:1400,height:1000}});
  await p.addInitScript(t=>localStorage.setItem('book-depo-theme',t), th);
  await p.goto(`${BASE}/`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(6000);
  // Expressions questions
  const q=p.locator('text=/Who am I/').first();
  await q.scrollIntoViewIfNeeded().catch(()=>{});
  await p.waitForTimeout(500);
  await p.screenshot({path:`expr-${th}.png`});
  // Two schools
  const s=p.locator('text=/Bhamati School/').first();
  await s.scrollIntoViewIfNeeded().catch(()=>{});
  await p.waitForTimeout(500);
  await p.screenshot({path:`schools2-${th}.png`});
  await p.close();
}
console.log('done'); await b.close();
