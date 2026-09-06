import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {AppState,Preferences,TodoInput,UIState} from './types';
import {completeTodo as localComplete,createTodo as localCreate,dateInShanghai,updateTodo as localUpdate} from './todo-core';
import {ScheduleView} from './ScheduleView';
import {TodoView} from './TodoView';
import appIcon from '../assets/icon.png';
import './style.css';
import './refinements.css';
import './todo.css';
import './v12.css';

const initial:AppState={schedule:null,todos:[],ui:{activeView:'schedule',focusTodoId:null},preferences:{topmost:false,opacity:.94,fontSize:14,autoStart:false,showInactive:true,todoSort:'due',todoFilter:'today'},sync:{status:'idle',message:'登录教务系统，开启你的周课表'}};
function App(){
 const [state,setState]=useState(initial),[now,setNow]=useState(new Date()),[settings,setSettings]=useState(false),[error,setError]=useState('');const api=window.desktop;
 useEffect(()=>{if(api){api.getState().then(setState).catch(e=>setError(String(e)));return api.onState(setState);}fetch('/preview.json').then(r=>r.ok?r.json():null).then(s=>{if(s)setState({...initial,...s,todos:s.todos??[],ui:s.ui??initial.ui,preferences:{...initial.preferences,...s.preferences}});}).catch(()=>{});},[]);
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),15000);const online=()=>{setNow(new Date());void api?.sync();};const focus=()=>setNow(new Date());window.addEventListener('online',online);window.addEventListener('focus',focus);return()=>{clearInterval(t);window.removeEventListener('online',online);window.removeEventListener('focus',focus);};},[]);
 const applyLocal=(fn:(s:AppState)=>AppState)=>{setState(s=>fn(s));return Promise.resolve();};
 const save=(p:Partial<Preferences>)=>{if(api)void api.settings(p).catch(e=>setError(String(e)));else setState(s=>({...s,preferences:{...s.preferences,...p}}));};
 const setView=(view:UIState['activeView'])=>{setError('');if(api)void api.setActiveView(view).catch(e=>setError(String(e)));else setState(s=>({...s,ui:{activeView:view,focusTodoId:null}}));};
 const create=(p:TodoInput)=>api?api.createTodo(p):applyLocal(s=>({...s,todos:[...s.todos,localCreate(p,s.schedule)]}));
 const update=(id:string,p:TodoInput)=>api?api.updateTodo(id,p):applyLocal(s=>({...s,todos:s.todos.map(t=>t.id===id?localUpdate(t,p,s.schedule):t)}));
 const complete=(id:string,v:boolean)=>api?api.completeTodo(id,v):applyLocal(s=>({...s,todos:localComplete(s.todos,id,v)}));
 const remove=(id:string)=>api?api.deleteTodo(id):applyLocal(s=>({...s,todos:s.todos.filter(t=>t.id!==id)}));
 const perform=(fn:(()=>Promise<void>)|undefined)=>{setError('');if(fn)void fn().catch(e=>setError(String(e)));};
 const today=dateInShanghai(now),badge=state.todos.filter(t=>!t.completedAt&&!!t.dueDate&&t.dueDate<=today).length,p=state.preferences;
 return <main style={{'--surface-alpha':p.opacity,'--base-font':p.fontSize+'px','--font-scale':p.fontSize/14} as React.CSSProperties}>
  <header className="titlebar"><div className="brand"><img className="app-mark" src={appIcon} alt=""/></div><nav className="main-nav"><button className={state.ui.activeView==='schedule'?'active':''} onClick={()=>setView('schedule')}>课表</button><button className={state.ui.activeView==='todos'?'active':''} onClick={()=>setView('todos')}>待办{badge>0&&<b>{badge>99?'99+':badge}</b>}</button></nav><div className="window-actions"><button aria-label="切换置顶" title="切换置顶" className={p.topmost?'selected':''} onClick={()=>save({topmost:!p.topmost})}>⌖ <span>{p.topmost?'已置顶':'置顶'}</span></button><button aria-label="设置" onClick={()=>setSettings(true)}>⚙</button><button aria-label="收起到托盘" title="收起到托盘" onClick={()=>perform(api?.hide)}>─</button></div></header>
  {error&&<div className="global-error" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}
  {state.ui.activeView==='schedule'?<ScheduleView state={state} now={now} save={save} sync={()=>perform(api?.sync)} login={()=>perform(api?.login)}/>:<TodoView state={state} now={now} save={save} create={create} update={update} complete={complete} remove={remove}/>} 
  {settings&&<div className="modal-backdrop" onClick={()=>setSettings(false)}><section className="modal settings" role="dialog" aria-modal="true" aria-label="课表设置" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSettings(false)}>×</button><div className="eyebrow">让周序适合你的桌面</div><h2>程序设置</h2><label>背景不透明度 <b>{Math.round(p.opacity*100)}%</b><input type="range" min="72" max="100" value={p.opacity*100} onChange={e=>save({opacity:+e.target.value/100})}/></label><label>文字大小 <b>{p.fontSize}px</b><input type="range" min="10" max="18" value={p.fontSize} onChange={e=>save({fontSize:+e.target.value})}/></label><label className="check"><span>始终显示在其他窗口上方</span><input type="checkbox" checked={p.topmost} onChange={e=>save({topmost:e.target.checked})}/></label><label className="check"><span>开机启动</span><input type="checkbox" checked={p.autoStart} onChange={e=>save({autoStart:e.target.checked})}/></label><p>拖动顶部标题栏移动窗口，拖动边缘调整大小。右上角「─」收起到托盘，待办提醒仍会运行。</p><button onClick={()=>perform(api?.login)}>打开教务登录窗口</button><button className="quit" onClick={()=>perform(api?.quit)}>退出程序</button></section></div>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
