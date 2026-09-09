import fs from 'node:fs';
import path from 'node:path';
import type {AppState,Preferences} from '../src/types';
export const defaults:Preferences={topmost:false,opacity:0.94,fontSize:14,todoFontSize:14,autoStart:false,showInactive:true,showWeekend:true,theme:'soft',todoSort:'due',todoFilter:'today'};
export function readStore(file:string):AppState{
  try{const s=JSON.parse(fs.readFileSync(file,'utf8'));return {schedule:s.schedule?.version===1?s.schedule:null,todos:Array.isArray(s.todos)?s.todos:[],ui:{activeView:s.ui?.activeView==='todos'?'todos':'schedule',focusTodoId:null},preferences:{...defaults,...s.preferences},sync:{status:'idle',message:'等待同步'}};}
  catch{return {schedule:null,todos:[],ui:{activeView:'schedule',focusTodoId:null},preferences:{...defaults},sync:{status:'idle',message:'登录教务系统，开启你的周课表'}};}
}
export function writeStore(file:string,s:Pick<AppState,'schedule'|'preferences'> & Partial<Pick<AppState,'todos'|'ui'>>){
  fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify({schedule:s.schedule,todos:s.todos??[],ui:{activeView:s.ui?.activeView==='todos'?'todos':'schedule',focusTodoId:null},preferences:s.preferences},null,2),'utf8');fs.renameSync(tmp,file);
}
