import type {RawPage,RawCourse} from './types';
// Self-contained: also executed inside the isolated school window. Only reads rendered DOM.
export function extractDocument(doc:Document):RawPage {
  const table=doc.querySelector<HTMLTableElement>('table.courseTable');
  if(!table)throw new Error('未找到课表，请先登录教务系统');
  const courses:RawCourse[]=[];const occupied:number[]=[];
  const rows=Array.from(table.tBodies[0].rows);
  const periods=rows.map((row,index)=>{
    const label=row.querySelector('.dayPartUnit')?.textContent??'';
    const time=label.match(/(\d{1,2}:\d{2})\s*[-~～]\s*(\d{1,2}:\d{2})/);
    if(!time)throw new Error('节次时间读取失败');
    let col=0;
    for(const cell of Array.from(row.cells)){
      while((occupied[col]??0)>index)col++;
      const day=col;const colspan=cell.colSpan||1;const span=cell.rowSpan||1;
      for(let c=col;c<col+colspan;c++)occupied[c]=index+span;
      col+=colspan;
      const names=cell.querySelectorAll<HTMLElement>('.course-name');
      for(const name of names){
        let n:ChildNode|null=name.nextSibling;const lines:string[]=[];
        while(n&&!(n.nodeType===1&&(n as Element).classList.contains('course-name'))){
          const text=(n.textContent??'').trim();if(text)lines.push(text);n=n.nextSibling;
        }
        const code=lines.shift()??'';
        courses.push({name:name.textContent?.trim()??'',code,day,cellStart:index+1,cellSpan:span,lines});
      }
    }
    return {number:index+1,start:time[1],end:time[2]};
  });
  const semesterSelect=doc.querySelector<HTMLSelectElement>('#allSemesters');
  const text=doc.body.textContent??'';const startDate=text.match(/学期起始日期\s*[:：]\s*(\d{4}-\d{2}-\d{2})/)?.[1]??'';
  const weekSelect=doc.querySelector<HTMLSelectElement>('#weeks');
  const options=Array.from(doc.querySelectorAll('#weeks option, .selectize-dropdown [data-value]')).map(el=>Number(el.getAttribute('value')??el.getAttribute('data-value'))).filter(n=>n>0&&n<=60);
  const unscheduled=Array.from(doc.querySelectorAll<HTMLTableRowElement>('#lessons tr')).filter(r=>r.querySelector('.courseInfo')).map(row=>{
    const info=row.querySelector('.courseInfo')!;
    return {name:info.querySelector('p')?.textContent?.trim()??'',code:info.getAttribute('data-course')?.match(/\[([^\]]+)\]$/)?.[1]??'',raw:row.innerText??row.textContent??''};
  });
  return {semester:semesterSelect?.selectedOptions[0]?.textContent?.trim()??'',semesterId:semesterSelect?.value??'',startDate,selectedWeek:weekSelect?.value??'',hasExperiment:doc.querySelector<HTMLInputElement>('#hasExperiment')?.checked??false,maxWeek:Math.max(1,...options),periods,courses,unscheduled,capturedAt:new Date().toISOString()};
}
