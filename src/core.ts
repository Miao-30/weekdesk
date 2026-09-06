import type { Arrangement, RawPage, Schedule } from './types';
export function parseWeeks(input:string):number[]{
  const text=input.replace(/[（]/g,'(').replace(/[）]/g,')').replace(/\s|周/g,'').replace(/[，、]/g,',').replace(/[～—–-]/g,'~');
  const result=new Set<number>();
  for(const item of text.split(',')){
    const m=/^(\d+)(?:~(\d+))?(?:\((单|双)\))?$/.exec(item);
    if(!m) throw new Error(`无法识别周次：${input}`);
    const a=Number(m[1]), b=Number(m[2]??m[1]);
    if(a<1||b<a||b>60) throw new Error(`周次超出范围：${input}`);
    for(let n=a;n<=b;n++) if(!m[3]||(m[3]==='单'?n%2===1:n%2===0))result.add(n);
  }
  if(!result.size)throw new Error(`周次为空：${input}`);
  return [...result].sort((a,b)=>a-b);
}
export function dateInBeijing(now=new Date()):string { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function addDays(date:string,days:number):string { return new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10); }
export function teachingWeek(start:string,now=new Date()):number {return Math.floor((Date.parse(dateInBeijing(now)+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/604800000)+1;}
export function mergeArrangements(items:Arrangement[]):Arrangement[]{
  const groups=new Map<string,Arrangement[]>();
  for(const a of items){const key=JSON.stringify([a.code,a.name,a.day,a.weeks,a.teacher,a.campus,a.room,a.classes]);const g=groups.get(key)??[];g.push({...a,raw:[...a.raw]});groups.set(key,g);}
  const merged:Arrangement[]=[];
  for(const group of groups.values()){
    group.sort((a,b)=>a.start-b.start);let last:Arrangement|undefined;
    for(const a of group){if(last&&a.start===last.end+1){last.end=a.end;last.raw.push(...a.raw);}else if(last&&a.start===last.start&&a.end===last.end){last.raw.push(...a.raw);}else{last=a;merged.push(a);}}
  }
  return merged.sort((a,b)=>a.day-b.day||a.start-b.start||a.code.localeCompare(b.code)).map((a,i)=>({...a,id:`${a.code}-${a.day}-${a.start}-${i}`}));
}
export function parsePage(page:RawPage,allowWeek=false):Schedule{
  if(!page.semester||!/^\d{4}-\d{2}-\d{2}$/.test(page.startDate)||!Number.isFinite(Date.parse(page.startDate)))throw new Error('未读到学期或起始日期');
  if(!allowWeek&&page.selectedWeek!=='all')throw new Error('未能切换到全部周次，保留原课表');
  if(!page.hasExperiment)throw new Error('未包含实验安排，保留原课表');
  if(page.periods.length!==12||page.periods.some((p,i)=>p.number!==i+1||!/^\d{1,2}:\d{2}$/.test(p.start)||!/^\d{1,2}:\d{2}$/.test(p.end)))throw new Error('节次时间表不完整');
  const arrangements:Arrangement[]=[];
  for(const c of page.courses){
    if(!c.name||!c.code||c.day<1||c.day>7)throw new Error('课程标识或星期不完整');
    const detailLines=c.lines.filter(l=>/[（(].*周[）)]/.test(l));
    const classes=c.lines.filter(l=>!detailLines.includes(l)).join('；');
    if(!detailLines.length)throw new Error(`课程缺少安排：${c.name}`);
    for(const raw of detailLines){
      const m=/^[（(](.+?)周[）)]\s*[（(](\d+)[-~～](\d+)节[）)]([\s\S]*)$/.exec(raw.trim());
      if(!m)throw new Error(`无法解析安排：${c.name} ${raw}`);
      const start=+m[2],end=+m[3],weeks=parseWeeks(m[1]);
      if(start<1||end<start||end>12||start<c.cellStart||end>c.cellStart+c.cellSpan-1)throw new Error(`节次与单元格不一致：${c.name}`);
      const tail=m[4].replace(/\u00a0/g,' ').trim();
      // The school separates the location and teacher with two spaces. Missing location is allowed.
      const parts=tail.split(/\s{2,}/).filter(Boolean);
      let teacher='',location='';
      if(parts.length>=2){teacher=parts.pop()!;location=parts.join(' ');}else{
        const tokens=tail.split(/\s+/);teacher=tokens.pop()??'';location=tokens.join(' ');
      }
      if(!teacher)throw new Error(`教师字段为空：${c.name}`);
      const cm=location.match(/^(\S*校区)\s*/);const campus=cm?.[1]??'';
      const room=location.slice(cm?.[0].length??0).replace(/^(?:自定义教室[：:]\s*)+/,'').trim();
      arrangements.push({id:'',name:c.name,code:c.code,day:c.day,start,end,weeks,weekText:m[1]+'周',teacher,campus,room,classes,raw:[raw]});
    }
  }
  if(!allowWeek&&!arrangements.length&&!page.unscheduled.length)throw new Error('课表为空，无法确认读取完整性');
  const maxWeek=Math.max(page.maxWeek,...arrangements.flatMap(a=>a.weeks),1);
  return {version:1,semester:page.semester,semesterId:page.semesterId,startDate:page.startDate,maxWeek,periods:page.periods,arrangements:mergeArrangements(arrangements),unscheduled:page.unscheduled,syncedAt:page.capturedAt,source:'https://jwgl.njucm.edu.cn/student/for-std/course-table'};
}
export function weekSignature(s:Schedule,week:number):string[]{return s.arrangements.filter(a=>a.weeks.includes(week)).flatMap(a=>Array.from({length:a.end-a.start+1},(_,i)=>JSON.stringify([a.code,a.name,a.day,a.start+i,a.teacher,a.campus,a.room,a.classes]))).sort();}
