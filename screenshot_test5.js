const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu'],
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1400, height: 900});
  
  // First load: set localStorage to skip wizard
  await page.goto('http://localhost:3000/', {waitUntil: 'domcontentloaded'});
  await page.evaluate(() => {
    localStorage.setItem('proquote_profile', JSON.stringify({name:'Luke',company:'Adonai Electrical',abn:'12 345 678 901',phone:'0407769296',email:'luke@adonaielectrical.com',labourSell:100,labourCost:75,markup:100,deposit:20,_done:true}));
    localStorage.setItem('proquote_setup_done', '1');
  });
  
  // Reload so wizard is skipped
  await page.goto('http://localhost:3000/', {waitUntil: 'networkidle0'});
  await new Promise(r => setTimeout(r, 800));
  
  const result = await page.evaluate(() => {
    try {
      if(typeof S === 'undefined') return 'S not defined';
      window._id = 100;
      S.sections = [{
        id:1, name:'Electrical',
        parents:[
          {id:2,name:'Dedicated 32a Circuit',description:'Install 32a circuit for air con',qty:1,discount:0,optional:false,lumpSum:false,category:'Power',activeCats:{supply:true,wire:true,install:true},
           subitems:[
             {id:10,cat:'supply',qty:2,markup:100,wireMin:0,instMin:30,item:{c:'20A-BKR',d1:'20A Single Pole Breaker',d2:'MCB',u:'EA',p:12.5}},
             {id:11,cat:'wire',qty:1,markup:0,wireMin:45,instMin:0,item:null,customName:'6mm Twin & Earth',customPrice:3.2,customUnit:'m'},
           ],photos:[]},
          {id:3,name:'GPO Power Points',description:'',qty:2,discount:0,optional:false,lumpSum:false,category:'Power',activeCats:{supply:true,wire:true,install:true},
           subitems:[{id:20,cat:'supply',qty:4,markup:100,wireMin:0,instMin:15,item:{c:'GPO-DB',d1:'Double Power Outlet',d2:'White',u:'EA',p:8.5}}],photos:[]},
          {id:4,name:'Smoke Detectors',description:'',qty:3,discount:5,optional:false,lumpSum:false,category:'Safety',activeCats:{supply:true,wire:true,install:true},
           subitems:[{id:30,cat:'supply',qty:1,markup:100,wireMin:0,instMin:20,item:{c:'SMKD-230',d1:'240V Smoke Detector',d2:'',u:'EA',p:45}}],photos:[]}
        ]
      }];
      selectSection('1');
      return 'ok';
    } catch(e) { return 'error: ' + e.message; }
  });
  console.log('inject:', result);
  
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({path: '/tmp/pq_v3_main.png'});
  
  await page.evaluate(() => { try { openSubitemPanel('1', '2'); } catch(e){console.error(e)} });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({path: '/tmp/pq_v3_panel.png'});
  
  await browser.close();
  console.log('Done');
})().catch(e => { console.error(e.message); process.exit(1); });
