const { _electron } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const packaged = process.argv.find(arg => arg.startsWith('--app='))?.slice(6);
const screenshot = process.argv.find(arg => arg.startsWith('--screenshot='))?.slice(13);

async function main() {
  const server = http.createServer((request, response) => {
    if (request.url === '/download') {
      response.writeHead(200, {'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="browser-test.txt"'});
      response.end('Mint Browser download test'); return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end(`<title>${request.url === '/next' ? 'Second page' : 'Browser test'}</title><h1>Browser fixture</h1><a href="/next">Next</a><a href="/popup" target="_blank">Popup</a><script>document.cookie='minttest=1';localStorage.setItem('minttest','1');const f=document.createElement('iframe');f.src=URL.createObjectURL(new Blob(['<canvas id="chart"></canvas>'],{type:'text/html'}));document.body.append(f);</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const launch = () => _electron.launch({ executablePath: packaged || require('electron'), args: packaged ? [] : [root], timeout:30000 });
  try {
    browser = await launch();
    const page = await browser.firstWindow();
    await page.waitForFunction(() => document.querySelector('.tab'));
    if (screenshot) {
      await fs.mkdir(path.dirname(path.resolve(root,screenshot)), {recursive:true});
      await page.screenshot({path:path.resolve(root,screenshot)});
    }
    assert.equal(await page.locator('[data-url="https://sol-incinerator.com"]').count(),2);
    await page.locator('#address').fill(origin); await page.locator('#address').press('Enter');
    await page.waitForFunction(() => document.querySelector('.tab-label').textContent.includes('Browser test'));
    const isolated = await browser.evaluate(async ({BrowserWindow}) => {
      const wc = BrowserWindow.getAllWindows()[0].contentView.children[0].webContents;
      return {preferences:wc.getLastWebPreferences(),rtc:wc.getWebRTCIPHandlingPolicy(),
        access:await wc.executeJavaScript('typeof window.mint+":"+typeof require'),
        geolocation:await wc.executeJavaScript('new Promise(resolve=>navigator.geolocation.getCurrentPosition(()=>resolve(0),error=>resolve(error.code)))')};
    });
    assert.equal(isolated.preferences.sandbox,true);
    assert.equal(isolated.preferences.contextIsolation,true);
    assert.equal(isolated.preferences.nodeIntegration,false);
    assert.equal(isolated.preferences.webSecurity,true);
    assert.equal(isolated.access,'undefined:undefined');
    assert.equal(isolated.rtc,'disable_non_proxied_udp');
    assert.equal(isolated.geolocation,1);
    const frame = await browser.evaluate(async ({BrowserWindow}) => {
      const wc = BrowserWindow.getAllWindows()[0].contentView.children[0].webContents;
      for (let attempt=0;attempt<100;attempt++) {
        const child=wc.mainFrame.framesInSubtree.find(f=>f.url.startsWith('blob:'));
        if (child) return child.executeJavaScript('({canvas:!!document.querySelector("canvas"),access:typeof window.mint+":"+typeof require})');
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      throw new Error('Generated chart frame did not load');
    });
    assert.equal(frame.canvas,true); assert.equal(frame.access,'undefined:undefined');
    await browser.evaluate(({BrowserWindow}) => {
      const wc=BrowserWindow.getAllWindows()[0].contentView.children[0].webContents;
      return wc.mainFrame.framesInSubtree.find(f=>f.url.startsWith('blob:')).executeJavaScript('location.hash="chart"');
    });
    await page.waitForFunction(origin => document.querySelector('#address').value === origin+'/',origin);
    await browser.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript('document.querySelector("a").click()',true));
    await page.waitForFunction(() => !document.querySelector('#back').disabled);
    await page.locator('#back').click();
    await page.waitForFunction(() => document.querySelector('.tab-label').textContent.includes('Browser test'));
    await browser.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript('document.querySelectorAll("a")[1].click()',true));
    await page.waitForFunction(() => document.querySelectorAll('.tab').length===2);
    await page.locator('.tab-close').last().click();
    const output=path.join(root,'.test-output','download.txt');
    await fs.mkdir(path.dirname(output),{recursive:true});
    await browser.evaluate(({session}, destination) => {
      globalThis.downloadDone=false;
      session.fromPartition('mint-session').once('will-download',(_e,item)=>{
        item.setSavePath(destination);item.once('done',(_event,state)=>{globalThis.downloadDone=state==='completed';});
      });
    },output);
    await page.evaluate(url=>window.mint.command('navigate',url),origin+'/download');
    for(let attempt=0;attempt<100;attempt++) {
      if(await browser.evaluate(()=>globalThis.downloadDone)) break;
      await new Promise(resolve=>setTimeout(resolve,30));
    }
    assert.equal(await fs.readFile(output,'utf8'),'Mint Browser download test');
    await page.locator('#new-tab').click();
    await page.locator('#address').fill('file:///private');await page.locator('#address').press('Enter');
    await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Only HTTP'));
    await page.evaluate(()=>{window.mint.command('clear');window.mint.command('new');});
    await page.waitForFunction(()=>document.querySelectorAll('.tab').length===1&&document.querySelector('#notice').textContent==='Session cleared.');
    assert.equal((await browser.evaluate(({session})=>session.fromPartition('mint-session').cookies.get({}))).length,0);
    await page.evaluate(url=>window.mint.command('navigate',url),origin);
    await page.waitForFunction(()=>document.querySelector('.tab-label').textContent.includes('Browser test'));
    await browser.close();browser=await launch();await browser.firstWindow();
    assert.equal((await browser.evaluate(({session})=>session.fromPartition('mint-session').cookies.get({}))).length,0);
    console.log('PASS: chart frames, main-frame address integrity, sandbox, denied location, restricted WebRTC, navigation, tabs, downloads, clearing and session restart.');
  } finally { if(browser) await browser.close(); server.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
