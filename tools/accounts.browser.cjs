// Optional end-to-end checks: requires Playwright and Chrome, plus a running test server.
// NIHONGO_TEST_URL=http://127.0.0.1:8786 NODE_PATH=/path/to/node_modules node tools/accounts.browser.cjs
// Run against a disposable database: this creates real test accounts.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const url = process.env.NIHONGO_TEST_URL;
if (!url) throw new Error('Set NIHONGO_TEST_URL to a disposable local test server');
const stamp = Date.now().toString(36);
const loginA = 'testa_' + stamp, loginB = 'testb_' + stamp, code = '1234';
const guest = {v:2,epoch:0,words:{'ねこ|猫':{b:3,due:20774,t:1000,m:1}},dev:{deviceA:{t:70,d:{'2026-11-17':70}}},days:{'2026-11-17':1},passed:{}};
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const errors = [];
    async function device() {
      const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      const page = await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://fonts.googleapis.com/**',r=>r.abort());
      await page.goto(url+'/#debug');
      await page.waitForFunction(()=>!document.querySelector('#authFields').disabled);
      await page.locator('[data-tab="profile"]').click();
      return {context,page};
    }
    async function openAuth(page) {
      if (!await page.locator('#authDialog').evaluate(e=>e.open)) await page.locator('#authOpen').click();
    }
    async function authenticate(page, login, register=false) {
      await openAuth(page);
      await page.locator(`[data-auth-mode="${register?'register':'login'}"]`).click();
      await page.locator('#authLogin').fill(login);
      await page.locator('#authCode').fill(code);
      if(register) await page.locator('#authConfirm').fill(code);
      await page.locator('#authSubmit').click();
      await page.waitForFunction(()=>document.querySelector('#authForm').hidden);
      await page.waitForFunction(()=>document.querySelector('#sync').classList.contains('ok'));
    }
    async function xp(page) {return page.evaluate(()=>Object.values(window.__tango.state().dev).reduce((n,d)=>n+d.t,0));}
    async function logout(page) {
      await page.locator('#authLogout').click();
      await page.waitForFunction(()=>!document.querySelector('#authForm').hidden && !document.querySelector('#authFields').disabled);
    }
    const first=await device(), page=first.page;
    await page.evaluate(s=>localStorage.setItem('tango-drill-v2',JSON.stringify(s)),guest);
    await page.reload();
    await page.waitForFunction(()=>!document.querySelector('#authFields').disabled);
    await page.locator('[data-tab="profile"]').click();
    await openAuth(page);
    await page.locator('[data-auth-mode="register"]').click();
    await page.locator('#authLogin').fill(loginA);
    await page.locator('#authCode').fill(code);
    await page.locator('#authConfirm').fill('different-code');
    await page.locator('#authSubmit').click();
    assert.match(await page.locator('#authDialogStatus').textContent(),/не совпадают/);
    await authenticate(page,loginA,true);
    assert.equal(await xp(page),70,'registration automatically imports guest progress');
    assert.equal(await page.locator('#profileTitle').textContent(),'Профиль '+loginA);
    assert.equal(await page.locator('#accountPanel').isVisible(),false);
    assert.equal(await page.evaluate(()=>!!(document.querySelector('#resetBtn').compareDocumentPosition(document.querySelector('#authLogout')) & Node.DOCUMENT_POSITION_FOLLOWING)),true,'logout is below profile settings');
    assert.equal(await page.locator('#authGuestImport').count(),0,'manual guest import is removed');
    const second=await device();
    await authenticate(second.page,loginA);
    assert.equal(await xp(second.page),70,'second device loads account progress');
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#authForm').hidden);
    await page.locator('[data-tab="profile"]').click();
    assert.equal(await xp(page),70,'session survives reload');
    await logout(page);
    assert.equal(await xp(page),70,'logout returns to guest, not account storage');
    const third = await device();
    await authenticate(third.page,loginB,true);
    assert.equal(await xp(third.page),0,'registration without guest data starts empty');
    await authenticate(page,loginB);
    assert.equal(await xp(page),0,'login to an existing account does not import guest progress');
    await logout(page);
    await openAuth(page);
    await page.locator('#authLogin').fill(loginA);
    await page.locator('#authCode').fill('incorrect-code');
    await page.locator('#authSubmit').click();
    await page.waitForFunction(()=>document.querySelector('#authDialogStatus').textContent.includes('Неверный'));
    assert.equal(await page.locator('#authCode').inputValue(),'','code clears after failure');
    await authenticate(page,loginA);
    assert.equal(await xp(page),70);
    // Changing the cookie in another tab must not write A's data into B.
    await page.evaluate(async ({login,code})=>fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Nihongo-Request':'1'},body:JSON.stringify({login,code})}),{login:loginB,code});
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.waitForFunction(()=>document.querySelector('#authDialogStatus').textContent.includes('другой вкладке'));
    assert.equal(await xp(page),70,'expired account cache is retained');
    await authenticate(page,loginB);
    assert.equal(await xp(page),0,'other-tab session cannot leak progress');
    for (const lang of ['en','ja','ru']) {
      await page.locator(`[data-lang="${lang}"]`).click();
      assert.ok((await page.locator('#accountName').textContent()).includes(loginB));
    }
    await logout(page);
    await openAuth(page);
    await page.locator('[data-auth-mode="register"]').click();
    await page.locator('#profile .scroll').evaluate(e=>e.scrollTop=0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#authCode').fill('1234');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#authDialog').evaluate(e=>e.open),false);
    await page.waitForFunction(()=>document.querySelector('#authCode').value === '');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'authOpen');
    const banner = await page.locator('#accountPanel').boundingBox();
    assert.ok(banner.height < 110,'guest banner stays compact');
    const button = await page.locator('#authOpen').boundingBox();
    const message = await page.locator('#accountName').boundingBox();
    assert.ok(button.x > message.x + message.width,'sign-in button is on the right');
    await page.screenshot({path:'/private/tmp/nihongo-auth-profile.png'});
    await openAuth(page);
    await page.locator('[data-auth-mode="register"]').click();
    await page.screenshot({path:'/private/tmp/nihongo-auth-dialog.png'});
    await page.locator('#authClose').click();
    assert.equal(await page.locator('#authDialog').evaluate(e=>e.open),false);
    assert.deepEqual(errors,[],'no browser runtime errors');
    console.log('PASS: registration, code mismatch, login errors, session reload, guest import, second device, account isolation, cross-tab cookie changes, 3 languages, mobile layout');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
