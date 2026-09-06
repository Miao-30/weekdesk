import type {Schedule,Todo,TodoFilter,TodoInput,TodoPriority,TodoRecurrence,TodoReminder,TodoSort} from './types';

const priorities:TodoPriority[]=['high','medium','normal'];
const reminders:TodoReminder[]=['none','at-time','10m','1h','1d'];
const recurrences:TodoRecurrence[]=['none','daily','weekly','monthly'];
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
export function validDate(value:string){return datePattern.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
type NormalizedTodoInput={title:string;notes:string;dueDate:string|null;dueTime:string|null;priority:TodoPriority;tags:string[];courseCode:string|null;courseName:string|null;reminder:TodoReminder;recurrence:TodoRecurrence};
export function normalizeTodoInput(input:unknown,schedule:Schedule|null,allowedMissingCourseCode:string|null=null):NormalizedTodoInput{
  if(!input||typeof input!=='object')throw new Error('待办内容无效');const p=input as TodoInput;
  const title=clean(p.title,120);if(!title)throw new Error('请输入待办内容');
  const dueDate=p.dueDate==null||p.dueDate===''?null:clean(p.dueDate,10);if(dueDate&&!validDate(dueDate))throw new Error('截止日期无效');
  const dueTime=p.dueTime==null||p.dueTime===''?null:clean(p.dueTime,5);if(dueTime&&!timePattern.test(dueTime))throw new Error('截止时间无效');
  if(dueTime&&!dueDate)throw new Error('设置具体时间前请先选择截止日期');
  const priority=priorities.includes(p.priority as TodoPriority)?p.priority as TodoPriority:'normal';
  const reminder=reminders.includes(p.reminder as TodoReminder)?p.reminder as TodoReminder:'none';
  const recurrence=recurrences.includes(p.recurrence as TodoRecurrence)?p.recurrence as TodoRecurrence:'none';
  if(reminder!=='none'&&(!dueDate||!dueTime))throw new Error('提醒需要截止日期和具体时间');
  if(recurrence!=='none'&&!dueDate)throw new Error('重复待办需要截止日期');
  const tags=Array.isArray(p.tags)?[...new Set(p.tags.map(x=>clean(x,24)).filter(Boolean))].slice(0,8):[];
  const courseCode=p.courseCode==null||p.courseCode===''?null:clean(p.courseCode,40);
  let courseName=p.courseName==null||p.courseName===''?null:clean(p.courseName,120);
  if(courseCode){
    const course=schedule?.arrangements.find(a=>a.code===courseCode);
    if(course)courseName=course.name;
    else if(courseCode!==allowedMissingCourseCode||!courseName)throw new Error('关联课程无效');
  }else courseName=null;
  return {title,notes:clean(p.notes,4000),dueDate,dueTime,priority,tags,courseCode,courseName,reminder,recurrence};
}
export function createTodo(input:unknown,schedule:Schedule|null,now=new Date(),id:string=crypto.randomUUID()):Todo{
  const p=normalizeTodoInput(input,schedule);return {...p,id,createdAt:now.toISOString(),completedAt:null,remindedFor:null,generatedFrom:null};
}
export function updateTodo(todo:Todo,input:unknown,schedule:Schedule|null):Todo{
  const p=normalizeTodoInput(input,schedule,todo.courseCode);const reminderChanged=p.dueDate!==todo.dueDate||p.dueTime!==todo.dueTime||p.reminder!==todo.reminder;
  return {...todo,...p,remindedFor:reminderChanged?null:todo.remindedFor};
}
const isoDate=(d:Date)=>d.toISOString().slice(0,10);
export function nextDueDate(date:string,recurrence:TodoRecurrence):string{
  const d=new Date(date+'T00:00:00Z');
  if(recurrence==='daily')d.setUTCDate(d.getUTCDate()+1);
  if(recurrence==='weekly')d.setUTCDate(d.getUTCDate()+7);
  if(recurrence==='monthly'){
    const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));
  }
  return isoDate(d);
}
export function completeTodo(todos:Todo[],id:string,completed:boolean,now=new Date(),newId:string=crypto.randomUUID()):Todo[]{
  const index=todos.findIndex(t=>t.id===id);if(index<0)throw new Error('待办不存在');const current=todos[index];
  const changed={...current,completedAt:completed?now.toISOString():null};const next=[...todos];next[index]=changed;
  if(completed&&current.completedAt===null&&current.recurrence!=='none'&&current.dueDate){
    next.push({...current,id:newId,createdAt:now.toISOString(),dueDate:nextDueDate(current.dueDate,current.recurrence),completedAt:null,remindedFor:null,generatedFrom:current.id});
  }
  return next;
}
export function reminderMoment(todo:Todo):number|null{
  if(todo.completedAt||todo.reminder==='none'||!todo.dueDate||!todo.dueTime)return null;
  const due=Date.parse(`${todo.dueDate}T${todo.dueTime}:00+08:00`);if(!Number.isFinite(due))return null;
  const offset={none:0,'at-time':0,'10m':600000,'1h':3600000,'1d':86400000}[todo.reminder];return due-offset;
}
export function reminderKey(todo:Todo):string|null{const moment=reminderMoment(todo);return moment===null?null:String(moment);}
export function dateInShanghai(now=new Date()):string{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function plusDays(date:string,n:number){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return isoDate(d);}
export function matchesFilter(todo:Todo,filter:TodoFilter,now=new Date()):boolean{
  if(filter==='completed')return !!todo.completedAt;if(todo.completedAt)return false;
  const today=dateInShanghai(now);
  if(filter==='today')return !!todo.dueDate?todo.dueDate<=today:dateInShanghai(new Date(todo.createdAt))===today;
  if(filter==='upcoming')return !!todo.dueDate&&todo.dueDate>today&&todo.dueDate<=plusDays(today,7);
  return true;
}
export function sortTodos(todos:Todo[],sort:TodoSort):Todo[]{
  const rank={high:0,medium:1,normal:2};return [...todos].sort((a,b)=>{
    if(a.completedAt||b.completedAt)return (b.completedAt??'').localeCompare(a.completedAt??'');
    if(sort==='priority')return rank[a.priority]-rank[b.priority]||(a.dueDate??'9999').localeCompare(b.dueDate??'9999');
    if(sort==='created')return b.createdAt.localeCompare(a.createdAt);
    return (a.dueDate??'9999').localeCompare(b.dueDate??'9999')||(a.dueTime??'99:99').localeCompare(b.dueTime??'99:99')||rank[a.priority]-rank[b.priority];
  });
}
