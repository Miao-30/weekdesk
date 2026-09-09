import React,{useEffect,useRef,useState} from 'react';
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

const initial:AppState={schedule:null,todos:[],ui:{activeView:'schedule',focusTodoId:null},preferences:{topmost:false,opacity:.94,fontSize:14,todoFontSize:14,autoStart:false,showInactive:true,showWeekend:true,theme:'soft',todoSort:'due',todoFilter:'today'},sync:{status:'idle',message:'登录教务系统，开启你的周课表'}};
const clampFont=(value:number)=>Math.min(18,Math.max(6,Math.round(value)));

function App(){
 const [state,setState]=useState(initial),[now,setNow]=useState(new Date()),[settings,setSettings]=useState(false),[error,setError]=useState('');
 const api=window.desktop;
 const zoomRef=useRef({schedule:initial.preferences.fontSize,todos:initial.preferences.todoFontSize});
 useEffect(()=>{if(api){api.getState().then(setState).catch(e=>setError(String(e)));return api.onState(setState);}fetch('/preview.json').then(r=>r.ok?r.json():null).then(s=>{if(s)setState({...initial,...s,todos:s.todos??[],ui:s.ui??initial.ui,preferences:{...initial.preferences,...s.preferences}});}).catch(()=>{});},[]);
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),15000);const online=()=>{setNow(new Date());void api?.sync();};const focus=()=>setNow(new Date());window.addEventListener('online',online);window.addEventListener('focus',focus);return()=>{clearInterval(t);window.removeEventListener('online',online);window.removeEventListener('focus',focus);};},[]);
 const applyLocal=(fn:(s:AppState)=>AppState)=>{setState(s=>fn(s));return Promise.resolve();};
 const save=(change:Partial<Preferences>)=>{if(api)void api.settings(change).catch(e=>setError(String(e)));else setState(s=>({...s,preferences:{...s.preferences,...change}}));};
 const p=state.preferences;
 useEffect(()=>{zoomRef.current={schedule:p.fontSize,todos:p.todoFontSize??p.fontSize};},[p.fontSize,p.todoFontSize]);
 useEffect(()=>{const wheel=(event:WheelEvent)=>{if(!event.ctrlKey)return;event.preventDefault();const view=state.ui.activeView;const key=view==='schedule'?'fontSize':'todoFontSize';const current=view==='schedule'?zoomRef.current.schedule:zoomRef.current.todos;const next=clampFont(current+(event.deltaY<0?1:-1));if(next===current)return;if(view==='schedule')zoomRef.current.schedule=next;else zoomRef.current.todos=next;save({[key]:next});};window.addEventListener('wheel',wheel,{passive:false});return()=>window.removeEventListener('wheel',wheel);},[state.ui.activeView,api]);
 const setView=(view:UIState['activeView'])=>{setError('');if(api)void api.setActiveView(view).catch(e=>setError(String(e)));else setState(s=>({...s,ui:{activeView:view,focusTodoId:null}}));};
 const create=(input:TodoInput)=>api?api.createTodo(input):applyLocal(s=>({...s,todos:[...s.todos,localCreate(input,s.schedule)]}));
 const update=(id:string,input:TodoInput)=>api?api.updateTodo(id,input):applyLocal(s=>({...s,todos:s.todos.map(t=>t.id===id?localUpdate(t,input,s.schedule):t)}));
 const complete=(id:string,value:boolean)=>api?api.completeTodo(id,value):applyLocal(s=>({...s,todos:localComplete(s.todos,id,value)}));
 const remove=(id:string)=>api?api.deleteTodo(id):applyLocal(s=>({...s,todos:s.todos.filter(t=>t.id!==id)}));
 const perform=(fn:(()=>Promise<void>)|undefined)=>{setError('');if(fn)void fn().catch(e=>setError(String(e)));};
 const today=dateInShanghai(now),badge=state.todos.filter(t=>!t.completedAt&&!!t.dueDate&&t.dueDate<=today).length;
 const todoFont=p.todoFontSize??p.fontSize;
 return <main data-theme={p.theme??'soft'} style={{'--surface-alpha':p.opacity,'--base-font':p.fontSize+'px','--font-scale':p.fontSize/14,'--todo-font':todoFont+'px','--todo-scale':todoFont/14,'--schedule-dialog-scale':Math.min(1,p.fontSize/14),'--todo-dialog-scale':Math.min(1,todoFont/14)} as React.CSSProperties}>
  <header className="titlebar"><div className="brand"><img className="app-mark" src={appIcon} alt=""/></div><nav className="main-nav"><button className={state.ui.activeView==='schedule'?'active':''} onClick={()=>setView('schedule')}>课表</button><button className={state.ui.activeView==='todos'?'active':''} onClick={()=>setView('todos')}>待办{badge>0&&<b>{badge>99?'99+':badge}</b>}</button></nav><div className="window-actions"><button aria-label="切换置顶" title="切换置顶" className={p.topmost?'selected':''} onClick={()=>save({topmost:!p.topmost})}>⌖ <span>{p.topmost?'已置顶':'置顶'}</span></button><button aria-label="设置" onClick={()=>setSettings(true)}>⚙</button><button aria-label="收起到托盘" title="收起到托盘" onClick={()=>perform(api?.hide)}>─</button></div></header>
  {error&&<div className="global-error" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}
  {state.ui.activeView==='schedule'?<ScheduleView state={state} now={now} save={save} sync={()=>perform(api?.sync)} login={()=>perform(api?.login)}/>:<TodoView state={state} now={now} save={save} create={create} update={update} complete={complete} remove={remove}/>} 
  {settings&&<div className="modal-backdrop" onClick={()=>setSettings(false)}><section className={`modal settings ${state.ui.activeView}`} role="dialog" aria-modal="true" aria-label="程序设置" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSettings(false)}>×</button><div className="eyebrow">让周序适合你的桌面</div><h2>程序设置</h2><fieldset className="theme-picker"><legend>界面主题</legend><button className={(p.theme??'soft')==='soft'?'active':''} onClick={()=>save({theme:'soft'})}><span className="theme-preview soft"><i/><i/><i/><i/></span><b>柔和浅灰</b><small>低饱和、安静耐看</small></button><button className={p.theme==='bright'?'active':''} onClick={()=>save({theme:'bright'})}><span className="theme-preview bright"><i/><i/><i/><i/></span><b>明亮纯色</b><small>清爽背景、鲜亮课程色</small></button></fieldset><label>背景不透明度 <b>{Math.round(p.opacity*100)}%</b><input type="range" min="72" max="100" value={p.opacity*100} onChange={e=>save({opacity:+e.target.value/100})}/></label><label>课表大小 <b>{p.fontSize}px</b><input type="range" min="6" max="18" value={p.fontSize} onChange={e=>save({fontSize:+e.target.value})}/></label><label>待办大小 <b>{todoFont}px</b><input type="range" min="6" max="18" value={todoFont} onChange={e=>save({todoFontSize:+e.target.value})}/></label><label className="check"><span>显示周六和周日</span><input type="checkbox" checked={p.showWeekend} onChange={e=>save({showWeekend:e.target.checked})}/></label><label className="check"><span>始终显示在其他窗口上方</span><input type="checkbox" checked={p.topmost} onChange={e=>save({topmost:e.target.checked})}/></label><label className="check"><span>开机启动</span><input type="checkbox" checked={p.autoStart} onChange={e=>save({autoStart:e.target.checked})}/></label><p>课表和待办页面都可以按住 Ctrl 滚动鼠标滚轮，分别调整大小。拖动顶部移动窗口，拖动边缘调整窗口尺寸。</p><button onClick={()=>perform(api?.login)}>打开教务登录窗口</button><button className="quit" onClick={()=>perform(api?.quit)}>退出程序</button></section></div>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
