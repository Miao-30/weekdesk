export interface Period { number:number; start:string; end:string }
export interface RawCourse { name:string; code:string; day:number; cellStart:number; cellSpan:number; lines:string[] }
export interface RawPage { semester:string; semesterId:string; startDate:string; selectedWeek:string; hasExperiment:boolean; maxWeek:number; periods:Period[]; courses:RawCourse[]; unscheduled:{name:string;code:string;raw:string}[]; capturedAt:string }
export interface Arrangement { id:string; name:string;code:string;day:number;start:number;end:number;weeks:number[];weekText:string;teacher:string;campus:string;room:string;classes:string;raw:string[] }
export interface Schedule { version:1; semester:string;semesterId:string;startDate:string;maxWeek:number;periods:Period[];arrangements:Arrangement[];unscheduled:RawPage['unscheduled'];syncedAt:string;source:string }
export type TodoPriority='high'|'medium'|'normal';
export type TodoReminder='none'|'at-time'|'10m'|'1h'|'1d';
export type TodoRecurrence='none'|'daily'|'weekly'|'monthly';
export type TodoFilter='today'|'upcoming'|'all'|'completed';
export type TodoSort='due'|'priority'|'created';
export interface Todo { id:string;title:string;notes:string;createdAt:string;dueDate:string|null;dueTime:string|null;priority:TodoPriority;tags:string[];courseCode:string|null;courseName:string|null;reminder:TodoReminder;recurrence:TodoRecurrence;completedAt:string|null;remindedFor:string|null;generatedFrom:string|null }
export interface TodoInput { title:string;notes?:string;dueDate?:string|null;dueTime?:string|null;priority?:TodoPriority;tags?:string[];courseCode?:string|null;courseName?:string|null;reminder?:TodoReminder;recurrence?:TodoRecurrence }
export interface Preferences { topmost:boolean;opacity:number;fontSize:number;autoStart:boolean;showInactive:boolean;todoSort:TodoSort;todoFilter:TodoFilter;bounds?:{x:number;y:number;width:number;height:number} }
export interface UIState { activeView:'schedule'|'todos'; focusTodoId:string|null }
export interface AppState { schedule:Schedule|null;todos:Todo[];ui:UIState;preferences:Preferences;sync:{status:'idle'|'syncing'|'ok'|'error'|'login';message:string} }
export interface DesktopAPI { getState():Promise<AppState>;sync():Promise<void>;login():Promise<void>;settings(p:Partial<Preferences>):Promise<void>;createTodo(p:TodoInput):Promise<void>;updateTodo(id:string,p:TodoInput):Promise<void>;completeTodo(id:string,completed:boolean):Promise<void>;deleteTodo(id:string):Promise<void>;setActiveView(view:UIState['activeView']):Promise<void>;hide():Promise<void>;quit():Promise<void>;onState(fn:(s:AppState)=>void):()=>void }
declare global { interface Window { desktop?:DesktopAPI } }
