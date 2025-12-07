// Puppeteer smoke test for Research -> Activities (history)
// Run this after starting a local server serving project root (e.g. python -m http.server 8000)
// Usage: node history-smoke.test.js

const puppeteer = require('puppeteer');

(async () => {
  const base = 'http://localhost:8000/research.html';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  try {
    await page.goto(base, { waitUntil: 'networkidle2' });

    // Scroll to Activities section
    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });

    // Fill the history form
    const unique = `TestActivity-${Date.now()}`;
    await page.waitForSelector('#hist-title');
    await page.type('#hist-title', unique);
    await page.type('#hist-researcher', 'Automated Tester');
    await page.select('#hist-category', 'research');
    await page.type('#hist-role', 'Contributor');
    const start = new Date();
    const startStr = start.toISOString().split('T')[0];
    const end = new Date(start.getTime() + 2*24*60*60*1000);
    const endStr = end.toISOString().split('T')[0];
    await page.type('#hist-start', startStr);
    await page.type('#hist-end', endStr);
    await page.select('#hist-status', 'ongoing');
    await page.type('#hist-desc', 'Smoke test entry for automated test.');

    // Submit
    await Promise.all([
      page.click('#form-submit-btn'),
      page.waitForResponse(response => response.status() === 200 || response.status() === 0, { timeout: 2000 }).catch(()=>{}),
    ]).catch(()=>{});

    // Wait for the card to appear
    await page.waitForFunction((title) => {
      const nodes = Array.from(document.querySelectorAll('.history-card h4'));
      return nodes.some(n => n.textContent.trim() === title);
    }, {}, unique);

    console.log('Added activity found in timeline.');

    // Toggle status (Mark Completed)
    const toggleSelector = await page.evaluateHandle((title) => {
      const cards = Array.from(document.querySelectorAll('.history-card'));
      for(const c of cards){
        const h = c.querySelector('h4');
        if(h && h.textContent.trim() === title){
          return c.querySelector('.history-actions button:nth-child(3)');
        }
      }
      return null;
    }, unique);

    if(toggleSelector){
      await toggleSelector.asElement().click();
      await page.waitForTimeout(500);
      console.log('Toggled status (completed).');
    } else {
      throw new Error('Toggle button not found');
    }

    // Edit: change title
    const editBtnHandle = await page.evaluateHandle((title) => {
      const cards = Array.from(document.querySelectorAll('.history-card'));
      for(const c of cards){
        const h = c.querySelector('h4');
        if(h && h.textContent.trim() === title){
          return c.querySelector('.history-actions button:nth-child(1)');
        }
      }
      return null;
    }, unique);

    if(editBtnHandle){
      await editBtnHandle.asElement().click();
      await page.waitForSelector('#hist-title');
      const newTitle = unique + '-edited';
      await page.click('#hist-title', { clickCount: 3 });
      await page.type('#hist-title', newTitle);
      await page.click('#form-submit-btn');
      await page.waitForFunction((t) => {
        const nodes = Array.from(document.querySelectorAll('.history-card h4'));
        return nodes.some(n => n.textContent.trim() === t);
      }, {}, newTitle);
      console.log('Edited activity title.');

      // Delete the edited item
      const delBtnHandle = await page.evaluateHandle((title) => {
        const cards = Array.from(document.querySelectorAll('.history-card'));
        for(const c of cards){
          const h = c.querySelector('h4');
          if(h && h.textContent.trim() === title){
            return c.querySelector('.history-actions button:nth-child(2)');
          }
        }
        return null;
      }, newTitle);

      // confirm dialog handler
      page.on('dialog', async dialog => { await dialog.accept(); });
      await delBtnHandle.asElement().click();
      await page.waitForTimeout(500);
      const exists = await page.evaluate((t) => {
        return Array.from(document.querySelectorAll('.history-card h4')).some(n => n.textContent.trim() === t);
      }, newTitle);
      if(!exists) console.log('Deleted activity successfully.'); else throw new Error('Delete failed');
    } else {
      throw new Error('Edit button not found');
    }

    console.log('Smoke test completed successfully.');

  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
