import fs from 'node:fs';
import raw from '../tests/fixtures/school-all.json';
import {parsePage} from '../src/core';
import {defaults} from '../electron/store';
import {createTodo} from '../src/todo-core';
fs.mkdirSync('public',{recursive:true});
const schedule=parsePage(raw);const base=new Date('2026-09-06T02:00:00Z');
const todos=[
 createTodo({title:'完成数据结构课程设计',notes:'整理代码并补齐实验报告。',dueDate:'2026-09-06',dueTime:'20:00',priority:'high',tags:['作业'],courseCode:'400058—005',courseName:'数据结构',reminder:'1h',recurrence:'none'},schedule,base,'preview-1'),
 createTodo({title:'复习离散数学第三章',dueDate:'2026-09-08',priority:'medium',tags:['复习'],courseCode:'022409—003',courseName:'离散数学',recurrence:'weekly'},schedule,base,'preview-2'),
 createTodo({title:'每天背 30 个单词',dueDate:'2026-09-06',priority:'normal',tags:['习惯'],recurrence:'daily'},schedule,base,'preview-3'),
 createTodo({title:'领取快递',priority:'normal',tags:['生活']},schedule,base,'preview-4')
];
fs.writeFileSync('public/preview.json',JSON.stringify({schedule,todos,ui:{activeView:'schedule',focusTodoId:null},preferences:defaults,sync:{status:'ok',message:'已同步并核对全部教学周'}}));
