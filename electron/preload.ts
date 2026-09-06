import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('desktop',{
  getState:()=>ipcRenderer.invoke('state'),sync:()=>ipcRenderer.invoke('sync'),login:()=>ipcRenderer.invoke('login'),
  settings:(p:unknown)=>ipcRenderer.invoke('settings',p),createTodo:(p:unknown)=>ipcRenderer.invoke('todo-create',p),updateTodo:(id:string,p:unknown)=>ipcRenderer.invoke('todo-update',id,p),completeTodo:(id:string,completed:boolean)=>ipcRenderer.invoke('todo-complete',id,completed),deleteTodo:(id:string)=>ipcRenderer.invoke('todo-delete',id),setActiveView:(view:string)=>ipcRenderer.invoke('active-view',view),hide:()=>ipcRenderer.invoke('hide'),quit:()=>ipcRenderer.invoke('quit'),
  onState:(fn:(s:unknown)=>void)=>{const listener=(_:unknown,s:unknown)=>fn(s);ipcRenderer.on('state-change',listener);return()=>ipcRenderer.removeListener('state-change',listener);}
});
