import {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,powerMonitor,screen,Notification as SystemNotification} from 'electron';
import type {WebFrameMain} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {extractDocument} from '../src/extract';
import {parsePage,weekSignature} from '../src/core';
import {completeTodo as applyCompletion,createTodo,reminderKey,reminderMoment,updateTodo} from '../src/todo-core';
import {readStore,writeStore} from './store';
import type {AppState,Preferences,RawPage,TodoInput} from '../src/types';

const SCHOOL='https://jwgl.njucm.edu.cn';
const COURSE=SCHOOL+'/student/for-std/course-table';
const DIRECT_LOGIN=SCHOOL+'/student/login?refer='+encodeURIComponent(SCHOOL+'/student/home');
app.setName('Weekdesk');
const userDataOverride=process.env.WEEKDESK_USER_DATA;
app.setPath('userData',userDataOverride?path.resolve(userDataOverride):path.join(app.getPath('appData'),'Weekdesk'));
let main:BrowserWindow;let school:BrowserWindow|null=null;let tray:Tray;let state:AppState;let file:string;let quitting=false;let busy=false;let interactive=false;let reminderTimer:NodeJS.Timeout|undefined;
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const notify=()=>{if(main&&!main.isDestroyed())main.webContents.send('state-change',state);};
const persist=()=>writeStore(file,state);
function status(value:AppState['sync']['status'],message:string){state.sync={status:value,message};notify();}
function showTodo(todoId:string){state.ui={activeView:'todos',focusTodoId:todoId};persist();notify();main.show();main.focus();}
function scheduleReminders(){
  clearTimeout(reminderTimer);const now=Date.now();
  const due=state.todos.map(t=>({todo:t,moment:reminderMoment(t),key:reminderKey(t)})).filter(x=>x.moment!==null&&x.key!==x.todo.remindedFor).sort((a,b)=>a.moment!-b.moment!);
  if(!due.length)return;
  const wait=Math.max(0,due[0].moment!-now);
  reminderTimer=setTimeout(()=>{
    const current=Date.now();let changed=false;
    for(const item of due.filter(x=>x.moment!<=current+1000)){
      const live=state.todos.find(t=>t.id===item.todo.id);if(!live||live.completedAt||reminderKey(live)!==item.key||live.remindedFor===item.key)continue;
      live.remindedFor=item.key;changed=true;
      const dueText=live.dueDate?`${live.dueDate}${live.dueTime?' '+live.dueTime:''}`:'无截止时间';
      const notification=new SystemNotification({title:live.courseName?`${live.courseName} · ${live.title}`:live.title,body:`截止：${dueText}${live.notes?'\n'+live.notes.slice(0,100):''}`,icon:path.join(__dirname,'icon.png')});
      notification.on('click',()=>showTodo(live.id));notification.show();
    }
    if(changed){persist();notify();}scheduleReminders();
  },Math.min(wait,2147483000));
}
function getSchool(){
  if(school&&!school.isDestroyed())return school;
  school=new BrowserWindow({width:1100,height:780,show:false,title:'登录南京中医药大学教务系统',autoHideMenuBar:true,webPreferences:{partition:'persist:njucm-school',nodeIntegration:false,contextIsolation:true,sandbox:true}});
  school.webContents.setWindowOpenHandler(({url})=>{try{if(new URL(url).protocol==='https:')void school?.loadURL(url);}catch{}return {action:'deny'};});
  school.on('close',event=>{if(!quitting){event.preventDefault();school?.hide();interactive=false;}});
  school.webContents.on('did-finish-load',()=>{
    const url=school?.webContents.getURL()??'';
    if(url.startsWith(SCHOOL+'/student/login')){
      // This student account uses the teaching system's own credentials. Keep the
      // unsupported campus SSO choice out of the embedded login flow.
      void school?.webContents.executeJavaScript(`(()=>{
        const student=document.querySelector('input[name="login-terminal"][value="student"]');
        if(student){student.checked=true;student.dispatchEvent(new Event('change',{bubbles:true}));}
        const sso=[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='/student/sso/login');
        if(sso)sso.closest('.form-group')?.remove();
        const fields=document.querySelector('.login-fields');
        if(fields&&!document.querySelector('#weekdesk-login-tip')){
          const tip=document.createElement('div');tip.id='weekdesk-login-tip';
          tip.textContent='请使用教务系统学生账号登录；这里不是统一身份认证账号。';
          tip.style.cssText='margin:0 0 14px;padding:10px 12px;background:#eef6f2;color:#356b5d;border-left:3px solid #4d8b79;font-size:14px';
          fields.prepend(tip);
        }
      })()`).catch(()=>{});
    }
    const authenticated=url.startsWith(SCHOOL+'/student/')&&!/\/student\/(?:login|sso\/login)(?:[/?#]|$)/.test(url);
    if(interactive&&authenticated){
      interactive=false;school?.hide();setTimeout(()=>void sync(),0);
    }
  });
  return school;
}
async function courseFrame(win:BrowserWindow):Promise<WebFrameMain>{
  for(let i=0;i<25;i++){
    if(win.isDestroyed())throw new Error('教务窗口已关闭');
    if(/\/login(?:[/?]|$)/.test(win.webContents.getURL()))throw new Error('LOGIN');
    for(const f of win.webContents.mainFrame.framesInSubtree){
      if(!f.url.startsWith(SCHOOL))continue;
      if(await f.executeJavaScript('!!document.querySelector("table.courseTable .dayPartUnit")').catch(()=>false))return f;
    }
    await pause(600);
  }
  throw new Error('教务页面未加载完整，请稍后重试');
}
async function selectWeek(f:WebFrameMain,value:string){
  await f.executeJavaScript(`(()=>{const el=document.querySelector('#weeks');if(!el)throw Error('周次控件缺失');if(el.selectize){el.selectize.setValue(${JSON.stringify(value)});}else{el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
}
async function readStable(f:WebFrameMain,week:string):Promise<RawPage>{
  let previous='';let repeats=0;
  for(let i=0;i<30;i++){
    await pause(400);
    const raw=await f.executeJavaScript(`(${extractDocument.toString()})(document)`) as RawPage;
    const hash=JSON.stringify({...raw,capturedAt:''});
    if(raw.selectedWeek===week&&hash===previous)repeats++;else repeats=0;
    if(repeats>=2)return raw;
    previous=hash;
  }
  throw new Error('课表持续变化或加载超时，保留上次数据');
}
async function sync(){
  if(busy)return;busy=true;status('syncing','正在读取教务课表…');
  try{
    const win=getSchool();
    await win.loadURL(COURSE);
    const frame=await courseFrame(win);
    await frame.executeJavaScript(`(()=>{const cb=document.querySelector('#hasExperiment');if(cb&&!cb.checked)cb.click();})()`);
    await selectWeek(frame,'all');
    const raw=await readStable(frame,'all');
    // The selectize options are the school's own week dropdown, not a guessed term length.
    const max=await frame.executeJavaScript(`(()=>{const el=document.querySelector('#weeks');return Math.max(1,...Object.keys(el.selectize?.options??{}).map(Number).filter(n=>n>0&&n<61));})()`) as number;
    raw.maxWeek=Math.max(raw.maxWeek,max);
    const next=parsePage(raw);
    const old=state.schedule;
    const changed=!old||JSON.stringify({...old,syncedAt:''})!==JSON.stringify({...next,syncedAt:''});
    if(changed){
      for(let week=1;week<=next.maxWeek;week++){
        status('syncing',`正在核对第 ${week} / ${next.maxWeek} 周…`);
        await selectWeek(frame,String(week));const weekly=parsePage(await readStable(frame,String(week)),true);
        if(weekly.semesterId!==next.semesterId||weekly.startDate!==next.startDate||JSON.stringify(weekSignature(weekly,week))!==JSON.stringify(weekSignature(next,week)))throw new Error(`第 ${week} 周与教务视图不一致，未替换原课表`);
      }
    }
    // Read all again to detect a schedule change occurring during the audit.
    await selectWeek(frame,'all');const finalRaw=await readStable(frame,'all');finalRaw.maxWeek=next.maxWeek;
    const finalData=parsePage(finalRaw);
    if(JSON.stringify({...next,syncedAt:''})!==JSON.stringify({...finalData,syncedAt:''}))throw new Error('核对期间教务数据有变化，请重新同步');
    // Persist first. A failed write must never replace the in-memory successful cache.
    writeStore(file,{...state,schedule:finalData});state.schedule=finalData;
    status('ok',changed?'已同步并核对全部教学周':'已同步，课程安排无变化');
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    status(message==='LOGIN'?'login':'error',message==='LOGIN'?'登录已失效，请重新登录；已保存的课表仍可查看':message.includes('ERR_')?'无法连接教务系统；正在显示上次成功同步的课表':message);
  }finally{busy=false;}
}
function clampPrefs(p:Partial<Preferences>):Preferences{
  const next={...state.preferences,...Object.fromEntries(['topmost','autoStart','showInactive','showWeekend'].filter(k=>typeof p[k as keyof Preferences]==='boolean').map(k=>[k,p[k as keyof Preferences]])),opacity:typeof p.opacity==='number'&&Number.isFinite(p.opacity)?Math.min(1,Math.max(.72,p.opacity)):state.preferences.opacity,fontSize:typeof p.fontSize==='number'&&Number.isFinite(p.fontSize)?Math.min(18,Math.max(6,p.fontSize)):state.preferences.fontSize,todoFontSize:typeof p.todoFontSize==='number'&&Number.isFinite(p.todoFontSize)?Math.min(18,Math.max(6,p.todoFontSize)):state.preferences.todoFontSize};
  if(p.theme==='soft'||p.theme==='bright')next.theme=p.theme;
  if(['due','priority','created'].includes(String(p.todoSort)))next.todoSort=p.todoSort!;
  if(['today','upcoming','all','completed'].includes(String(p.todoFilter)))next.todoFilter=p.todoFilter!;
  return next;
}
function trayMenu(){tray.setContextMenu(Menu.buildFromTemplate([{label:'显示周课表',click:()=>{main.show();main.focus();}},{label:'置顶',type:'checkbox',checked:state.preferences.topmost,click:()=>{state.preferences.topmost=!state.preferences.topmost;main.setAlwaysOnTop(state.preferences.topmost);persist();notify();trayMenu();}},{label:'立即同步',click:()=>void sync()},{type:'separator'},{label:'退出',click:()=>{quitting=true;app.quit();}}]));}
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{main?.show();main?.focus();});
app.whenReady().then(()=>{
  app.setAppUserModelId('cn.local.weekdesk');
  file=path.join(app.getPath('userData'),'schedule.json');state=readStore(file);
  const importArg=process.argv.find(a=>a.startsWith('--import-raw='));
  if(importArg&&!state.schedule){
    try{state.schedule=parsePage(JSON.parse(fs.readFileSync(importArg.slice(13),'utf8')));persist();state.sync.message='已导入教务快照，等待联网同步';}
    catch{state.sync={status:'error',message:'导入快照校验失败，请登录教务系统同步'};}
  }
  const area=screen.getPrimaryDisplay().workArea;let b=state.preferences.bounds;
  if(b&&!screen.getAllDisplays().some(d=>b!.x>=d.workArea.x&&b!.x<d.workArea.x+d.workArea.width-100&&b!.y>=d.workArea.y&&b!.y<d.workArea.y+d.workArea.height-60))b=undefined;
  main=new BrowserWindow({width:Math.min(b?.width??1180,area.width),height:Math.min(b?.height??900,area.height),...(b?{x:b.x,y:b.y}:{}),minWidth:320,minHeight:240,frame:false,transparent:true,backgroundColor:'#00000000',show:false,title:'周序 · 桌面课表',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  main.setAlwaysOnTop(state.preferences.topmost);
  main.setIcon(path.join(__dirname,'icon.png'));
  main.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  main.webContents.on('will-navigate',e=>e.preventDefault());
  main.once('ready-to-show',()=>main.show());
  main.on('close',e=>{if(!quitting){e.preventDefault();main.hide();}});
  let saveTimer:NodeJS.Timeout;const saveBounds=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!main.isDestroyed()){state.preferences.bounds=main.getBounds();persist();}},350);};
  main.on('moved',saveBounds);main.on('resized',saveBounds);
  const icon=nativeImage.createFromPath(path.join(__dirname,'icon.png')).resize({width:32,height:32});
  tray=new Tray(icon);tray.setToolTip('周序 · 桌面课表');tray.on('double-click',()=>main.show());trayMenu();
  const handle=(name:string,fn:(...args:any[])=>unknown)=>ipcMain.handle(name,(e,...args)=>{if(e.sender!==main.webContents||e.senderFrame!==main.webContents.mainFrame)throw new Error('未授权请求');return fn(...args);});
  handle('state',()=>state);handle('sync',sync);
  handle('login',async()=>{
    if(busy)return;
    const win=getSchool();
    // "重新登录" deliberately starts a clean local teaching-system session.
    await win.webContents.session.clearStorageData({storages:['cookies']});
    await win.webContents.session.clearCache();
    interactive=true;win.show();win.focus();
    status('login','请使用教务系统学生账号登录；成功后会自动同步课表');
    await win.loadURL(DIRECT_LOGIN);
  });
  handle('settings',(p:Partial<Preferences>)=>{if(!p||typeof p!=='object')return;state.preferences=clampPrefs(p);main.setAlwaysOnTop(state.preferences.topmost);app.setLoginItemSettings({openAtLogin:state.preferences.autoStart});persist();notify();trayMenu();});
  handle('todo-create',(p:TodoInput)=>{state.todos.push(createTodo(p,state.schedule));persist();scheduleReminders();notify();});
  handle('todo-update',(id:string,p:TodoInput)=>{const index=state.todos.findIndex(t=>t.id===id);if(index<0)throw new Error('待办不存在');state.todos[index]=updateTodo(state.todos[index],p,state.schedule);persist();scheduleReminders();notify();});
  handle('todo-complete',(id:string,completed:boolean)=>{if(typeof completed!=='boolean')throw new Error('完成状态无效');state.todos=applyCompletion(state.todos,id,completed);persist();scheduleReminders();notify();});
  handle('todo-delete',(id:string)=>{const index=state.todos.findIndex(t=>t.id===id);if(index<0)throw new Error('待办不存在');state.todos.splice(index,1);persist();scheduleReminders();notify();});
  handle('active-view',(view:AppState['ui']['activeView'])=>{if(view!=='schedule'&&view!=='todos')throw new Error('页面无效');state.ui={activeView:view,focusTodoId:null};persist();notify();});
  handle('hide',()=>main.hide());handle('quit',()=>{quitting=true;app.quit();});
  void main.loadFile(path.join(__dirname,'../dist/index.html'));
  setInterval(()=>void sync(),3600000);
  powerMonitor.on('resume',()=>{notify();scheduleReminders();void sync();});
  // Login / offline failures preserve the last good cache.
  void sync();
  scheduleReminders();
});
app.on('before-quit',()=>{quitting=true;});
app.on('window-all-closed',()=>{if(quitting)app.quit();});
}
