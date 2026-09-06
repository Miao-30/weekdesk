import test from 'node:test';
import assert from 'node:assert/strict';
import raw from './fixtures/school-all.json';
import {parsePage,parseWeeks,teachingWeek,weekSignature} from '../src/core';

const schedule=parsePage(raw);
test('解析单双周与不连续周次',()=>{
  assert.deepEqual(parseWeeks('5~7(单),8~10'),[5,7,8,9,10]);
  assert.deepEqual(parseWeeks('2~6(双)'),[2,4,6]);
  assert.throws(()=>parseWeeks('待定'));
});
test('教学周按北京时间计算',()=>{
  assert.equal(teachingWeek('2026-08-31',new Date('2026-09-06T15:59:59Z')),1);
  assert.equal(teachingWeek('2026-08-31',new Date('2026-09-06T16:00:00Z')),2);
});
test('匿名演示课表保留教师变更、地点变更和晚课',()=>{
  const systems=schedule.arrangements.filter(x=>x.name==='系统设计');
  assert.deepEqual(systems.filter(x=>x.weeks.includes(1)).map(x=>[x.day,x.room]),[[5,'R-105']]);
  assert.deepEqual(systems.filter(x=>x.weeks.includes(2)).map(x=>[x.day,x.room]),[[4,'R-204']]);
  const network=schedule.arrangements.filter(x=>x.name==='网络系统');
  assert.equal(network.find(x=>x.weeks.includes(3))?.teacher,'教师丁');
  assert.equal(network.find(x=>x.weeks.includes(4))?.teacher,'教师戊');
  assert.equal(schedule.arrangements.find(x=>x.name==='晚间专题')?.end,12);
});
test('演示课表包含未排时间课程且在停课周没有安排',()=>{
  assert.equal(schedule.unscheduled.length,3);
  assert.equal(weekSignature(schedule,6).length,0);
  assert.equal(schedule.periods.length,12);
});
