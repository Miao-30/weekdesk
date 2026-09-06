import test from 'node:test';
import assert from 'node:assert/strict';
import raw from './fixtures/school-all.json';
import {parsePage} from '../src/core';
import {completeTodo,createTodo,matchesFilter,nextDueDate,normalizeTodoInput,reminderMoment} from '../src/todo-core';

const schedule=parsePage(raw),now=new Date('2026-09-06T04:00:00Z');
test('待办校验课程关联和日期',()=>{
  const todo=normalizeTodoInput({title:'  示例任务 ',tags:['复习','复习'],courseCode:'DEMO-104',courseName:'错误名称'},schedule);
  assert.equal(todo.title,'示例任务');
  assert.equal(todo.courseName,'数据结构示例');
  assert.deepEqual(todo.tags,['复习']);
  assert.throws(()=>normalizeTodoInput({title:'',dueTime:'10:00'},schedule));
});
test('待办筛选、重复和提醒使用北京时间',()=>{
  const todo=createTodo({title:'提醒',dueDate:'2026-09-06',dueTime:'20:00',reminder:'1h',recurrence:'weekly'},schedule,now,'one');
  assert.ok(matchesFilter(todo,'today',now));
  assert.equal(reminderMoment(todo),Date.parse('2026-09-06T19:00:00+08:00'));
  assert.equal(nextDueDate('2026-01-31','monthly'),'2026-02-28');
  const done=completeTodo([todo],'one',true,now,'two');
  assert.equal(done.length,2);
  assert.equal(done[1].dueDate,'2026-09-13');
});
