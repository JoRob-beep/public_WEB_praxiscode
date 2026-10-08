
const KEY='planning-pro-v2';
const COLORS=['#2563eb','#16a34a','#dc2626','#9333ea','#ea580c','#0891b2','#db2777'];
const TASK_STATUSES=[{id:'todo',label:'Offen'},{id:'inprogress',label:'In Arbeit'},{id:'done',label:'Erledigt'}];
const defaultState={theme:'light',weekOffset:0,topics:[{id:1,name:'Projekt',color:COLORS[0]},{id:2,name:'Lernen',color:COLORS[1]},{id:3,name:'Privat',color:COLORS[2]}],tasks:[
{id:11,text:'Wochenziele festlegen',done:false,status:'todo',order:1,priority:'Hoch',topic:1,date:'',startTime:'08:00',endTime:'09:00',rec:'none'},
{id:12,text:'Materialien vorbereiten',done:false,status:'todo',order:2,priority:'Mittel',topic:2,date:'',startTime:'09:00',endTime:'10:00',rec:'none'}],
boxes:[{id:21,title:'Fokusarbeit',minutes:50,remaining:3000,running:false},{id:22,title:'Pause',minutes:10,remaining:600,running:false}],
events:[]};
// Start with a default clone; actual state will be loaded asynchronously in init()
let state=structuredClone(defaultState), modalType=null, timer=null;
const dayNames=['Mo','Di','Mi','Do','Fr','Sa','So'], times=['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

function normalizeTasks(tasks){return tasks.map((t,i)=>{let status=TASK_STATUSES.some(x=>x.id===t.status)?t.status:(t.done?'done':'todo');return {...t,status,done:status==='done',order:Number.isFinite(+t.order)?+t.order:i+1,date:t.date||t.due||'',dueDate:t.dueDate||'',sprints:t.sprints||'',startTime:t.startTime||'08:00',endTime:t.endTime||'09:00'}})}
// Try to load state from a local/synced JSON file first (planning.json),
// fallback to localStorage, otherwise use defaultState.
async function load(){
  // Try fetching a planning.json file in the same folder (e.g. synced by Syncthing or served by a static server)
  try{
	const res = await fetch('./planning.json?_=' + Date.now());
	if(res.ok){
	  const data = await res.json();
	  const loaded = {...defaultState, ...data};
	  loaded.tasks = normalizeTasks(loaded.tasks);
	  return loaded;
	}
  }catch(e){
	// fetch failed (file missing, CORS, file:// restrictions etc.) — fallthrough to localStorage
  }

  // Fallback: localStorage
  try{
	let loaded = {...defaultState, ...JSON.parse(localStorage.getItem(KEY)||'{}')};
	loaded.tasks = normalizeTasks(loaded.tasks);
	return loaded;
  }catch{
	return structuredClone(defaultState);
  }
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){let d=new Date();d.setHours(0,0,0,0);return d}
function monday(offset=0){let d=today(),n=(d.getDay()+6)%7;d.setDate(d.getDate()-n+offset*7);return d}
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function topicName(id){return state.topics.find(x=>x.id==id)?.name||'Ohne Topic'}
function topicColor(id){return state.topics.find(x=>x.id==id)?.color||'#64748b'}
function render(){
 document.documentElement.dataset.theme=state.theme==='dark'?'dark':'light';
 document.getElementById('themeBtn').textContent=state.theme==='dark'?'☀':'◐';
 const q=document.getElementById('search').value.trim().toLowerCase();
 renderTopics(q);renderTasks(q);renderBoxes();renderCalendar(q);
}

// Async initialization: load state (from planning.json or localStorage) then render
async function init(){
  state = await load();
  render();
}
function renderTopics(q=''){let arr=state.topics.filter(t=>!q||t.name.toLowerCase().includes(q));let e=document.getElementById('topics');e.innerHTML=arr.length?arr.map(t=>`<div class="topic"><button class="x" onclick="delTopic(${t.id})">×</button><div><span class="dot" style="background:${t.color}"></span><span class="topic-name">${esc(t.name)}</span></div><div class="topic-meta">${state.tasks.filter(x=>x.topic==t.id&&!x.done).length} offen</div></div>`).join(''):'<div class="empty">Keine passenden Topics.</div>'}
function taskMatches(t,q){return !q||t.text.toLowerCase().includes(q)||topicName(t.topic).toLowerCase().includes(q)||(t.sprints||'').toLowerCase().includes(q)}
function taskCard(t){return `<article class="task${t.status==='done'?' done':''}" draggable="true" ondragstart="dragTask(event,${t.id})" ondragend="endTaskDrag(event)" ondragover="allowTaskDrop(event);event.stopPropagation()" ondrop="dropTask(event,${t.id},'${t.status}')"><div class="tasktext">${esc(t.text)}<small>Nr. ${t.order} · ${esc(topicName(t.topic))}${t.date?' · '+new Date(t.date+'T00:00').toLocaleDateString('de-DE')+' · '+esc(t.startTime)+'–'+esc(t.endTime):''}${t.dueDate?' · Fällig: '+new Date(t.dueDate+'T00:00').toLocaleDateString('de-DE'):''}${t.rec!=='none'?' · ↻ '+esc(t.rec):''}</small>${t.sprints?`<small class="task-sprints"><b>Sprints:</b> ${esc(t.sprints)}</small>`:''}</div><span class="pill priority-${t.priority.toLowerCase()}">${esc(t.priority)}</span><select class="task-status" aria-label="Status für ${esc(t.text)}" onchange="setTaskStatus(${t.id},this.value)">${TASK_STATUSES.map(s=>`<option value="${s.id}" ${t.status===s.id?'selected':''}>${s.label}</option>`).join('')}</select><button class="btn icon" aria-label="ToDo bearbeiten" onclick="editTask(${t.id})">✎</button><button class="btn icon" aria-label="ToDo löschen" onclick="delTask(${t.id})">×</button></article>`}
function renderTasks(q=''){let arr=state.tasks.filter(t=>taskMatches(t,q));arr.sort((a,b)=>a.order-b.order);let e=document.getElementById('todos');e.innerHTML=`<div class="kanban-board">${TASK_STATUSES.map(status=>{let tasks=arr.filter(t=>t.status===status.id);return `<section class="kanban-column" data-status="${status.id}" ondragover="allowTaskDrop(event)" ondragleave="leaveTaskDrop(event)" ondrop="dropTask(event,null,'${status.id}')"><header class="kanban-column-head"><strong>${status.label}</strong><span>${tasks.length}</span></header><div class="kanban-cards">${tasks.length?tasks.map(taskCard).join(''):`<div class="kanban-empty">Aufgabe hier ablegen</div>`}</div></section>`}).join('')}</div>`;
let counts=TASK_STATUSES.map(s=>`<span class="stat"><b>${state.tasks.filter(t=>t.status===s.id).length}</b> ${s.label}</span>`);document.getElementById('stats').innerHTML=counts.join('')}
function renderBoxes(){let e=document.getElementById('timeboxes');e.innerHTML=state.boxes.length?state.boxes.map(b=>{let pct=Math.max(0,Math.min(100,100-b.remaining/(b.minutes*60)*100));return `<div class="box"><div style="display:flex;justify-content:space-between"><h3>${esc(b.title)}</h3><button class="btn icon" onclick="delBox(${b.id})">×</button></div><div class="muted">${b.minutes} Minuten</div><div class="clock" id="clock${b.id}">${fmt(b.remaining)}</div><div class="progress"><i style="width:${pct}%"></i></div><div style="margin-top:9px;display:flex;gap:6px"><button class="btn" onclick="toggleBox(${b.id})">${b.running?'Pause':'Start'}</button><button class="btn" onclick="resetBox(${b.id})">Reset</button></div></div>`}).join(''):'<div class="empty">Noch keine Timeboxes.</div>'}
function fmt(s){s=Math.max(0,s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function renderCalendar(q=''){let start=monday(state.weekOffset);let lab=start.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+' – '+new Date(start.getTime()+6*864e5).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});document.getElementById('weekLabel').textContent=lab;
let weekDates=dayNames.map((_,i)=>iso(new Date(start.getTime()+i*864e5)));
let h='<div class="day">Zeit</div>'+dayNames.map((n,i)=>`<div class="day">${n}<br><small>${new Date(start.getTime()+i*864e5).getDate()}</small></div>`).join('');
h+='<div class="deadline-label">Fällig</div>'+weekDates.map(key=>`<div class="deadline-cell">${state.tasks.filter(t=>t.dueDate===key&&taskMatches(t,q)).map(t=>`<div class="event deadline-event${t.status==='done'?' deadline-done':''}" title="Fällig: ${esc(t.text)}" onclick="editTask(${t.id})"><b>${esc(t.text)}</b><small>ToDo${t.sprints?' · '+esc(t.sprints):''}</small></div>`).join('')}</div>`).join('');
for(const time of times){h+=`<div class="time">${time}</div>`;for(let d=0;d<7;d++){let date=new Date(start.getTime()+d*864e5),key=iso(date);let ev=state.events.filter(x=>x.date===key&&x.time===time&&(!q||x.title.toLowerCase().includes(q)||topicName(x.topic).toLowerCase().includes(q)));let tasks=state.tasks.filter(x=>x.date===key&&(x.startTime||'').slice(0,2)+':00'===time&&taskMatches(x,q));h+=`<div class="cell" data-date="${key}" data-time="${time}" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="dropEvent(event,'${key}','${time}')">${ev.map(x=>`<div class="event" draggable="true" ondragstart="dragEvent(event,${x.id})" style="border-color:${topicColor(x.topic)}"><b>${esc(x.title)}</b><small>${esc(topicName(x.topic))}</small><button class="btn icon" onclick="editEvent(${x.id});event.stopPropagation()">✎</button></div>`).join('')}${tasks.map(x=>`<div class="event task-event" style="border-color:#db2777" onclick="editTask(${x.id});event.stopPropagation()"><b>${esc(x.text)}</b><small>${esc(x.startTime)}–${esc(x.endTime)} · ToDo</small></div>`).join('')}</div>`}}document.getElementById('calendar').innerHTML=h}
function toggleTheme(){state.theme=state.theme==='dark'?'light':'dark';save();render()}
function clearSearch(){document.getElementById('search').value='';render()}
function shiftWeek(n){state.weekOffset+=n;save();render()}
function setTaskStatus(id,status){let t=state.tasks.find(x=>x.id===id);if(!t||!TASK_STATUSES.some(x=>x.id===status))return;let wasDone=t.status==='done';t.status=status;t.done=status==='done';if(!wasDone&&t.done&&t.rec!=='none')scheduleRecurring(t);save();render()}
function scheduleRecurring(t){let d=t.date?new Date(t.date+'T00:00'):today();if(t.rec==='daily')d.setDate(d.getDate()+1);if(t.rec==='weekly')d.setDate(d.getDate()+7);let due=t.dueDate?new Date(t.dueDate+'T00:00'):null;if(due&&t.rec==='daily')due.setDate(due.getDate()+1);if(due&&t.rec==='weekly')due.setDate(due.getDate()+7);state.tasks.push({...t,id:Date.now(),order:Math.max(...state.tasks.map(x=>x.order||0),0)+1,status:'todo',done:false,date:iso(d),dueDate:due?iso(due):''})}
function delTask(id){state.tasks=state.tasks.filter(x=>x.id!==id);save();render()}
function editTask(id){openModal('task',state.tasks.find(x=>x.id===id))}
function delTopic(id){if(confirm('Topic und Zuordnung löschen?')){state.tasks.forEach(t=>{if(t.topic==id)t.topic=null});state.topics=state.topics.filter(x=>x.id!==id);save();render()}}
function delBox(id){state.boxes=state.boxes.filter(x=>x.id!==id);save();render()}
function toggleBox(id){let b=state.boxes.find(x=>x.id===id);b.running=!b.running;if(b.running&&!timer)startTimer();save();render()}
function resetBox(id){let b=state.boxes.find(x=>x.id===id);b.remaining=b.minutes*60;b.running=false;save();render()}
function startTimer(){timer=setInterval(()=>{let active=false,finishedIndex=-1;for(let i=0;i<state.boxes.length;i++){let b=state.boxes[i];if(b.running){active=true;b.remaining--;if(b.remaining<=0){b.remaining=0;b.running=false;finishedIndex=i}}}if(finishedIndex>=0){let next=state.boxes.slice(finishedIndex+1).find(b=>b.remaining>0);if(next)next.running=true}if(active||finishedIndex>=0){save();for(const b of state.boxes){let c=document.getElementById('clock'+b.id);if(c)c.textContent=fmt(b.remaining)}}else{clearInterval(timer);timer=null;render()}},1000)}
function dragTask(e,id){e.dataTransfer.setData('task',String(id));e.dataTransfer.effectAllowed='move';e.currentTarget.classList.add('dragging')}
function endTaskDrag(e){e.currentTarget.classList.remove('dragging');document.querySelectorAll('.kanban-column.over').forEach(x=>x.classList.remove('over'))}
function allowTaskDrop(e){if(e.dataTransfer.types.includes('task')){e.preventDefault();e.currentTarget.closest('.kanban-column').classList.add('over')}}
function leaveTaskDrop(e){if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.classList.remove('over')}
function dropTask(e,targetId,targetStatus){e.preventDefault();e.stopPropagation();document.querySelectorAll('.kanban-column.over').forEach(x=>x.classList.remove('over'));let task=state.tasks.find(x=>x.id===+e.dataTransfer.getData('task'));if(!task||!TASK_STATUSES.some(x=>x.id===targetStatus)||task.id===targetId)return;let oldStatus=task.status,wasDone=task.status==='done';task.status=targetStatus;task.done=targetStatus==='done';let sameStatus=oldStatus===targetStatus;let lane=state.tasks.filter(x=>x.status===targetStatus&&x.id!==task.id).sort((a,b)=>a.order-b.order);let target=targetId===null?-1:lane.findIndex(x=>x.id===targetId);lane.splice(target<0?lane.length:target,0,task);lane.forEach((x,i)=>x.order=i+1);if(!sameStatus)state.tasks.filter(x=>x.status===oldStatus).sort((a,b)=>a.order-b.order).forEach((x,i)=>x.order=i+1);if(!wasDone&&task.done&&task.rec!=='none')scheduleRecurring(task);save();render()}
function dragEvent(e,id){e.dataTransfer.setData('event',id)}
function dropEvent(e,date,time){e.currentTarget.classList.remove('over');let id=+e.dataTransfer.getData('event');let x=state.events.find(x=>x.id===id);if(x){x.date=date;x.time=time;save();render()}}
function editEvent(id){openModal('event',state.events.find(x=>x.id===id))}
function openModal(type,obj=null){modalType=type;document.getElementById('modal').classList.add('open');document.getElementById('modalTitle').textContent={topic:'Topic',task:obj?'ToDo bearbeiten':'ToDo hinzufügen',timebox:'Pomodoro-Ablauf',event:'Termin'}[type];
let topicOpts=state.topics.map(t=>`<option value="${t.id}" ${obj?.topic==t.id?'selected':''}>${esc(t.name)}</option>`).join('');
let f='';
if(type==='topic')f=`<div class="fields"><div class="field full"><label>Name</label><input name="name" required autofocus></div><div class="field"><label>Farbe</label><select name="color">${COLORS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div></div>`;
if(type==='task')f=`<div class="fields"><div class="field full"><label>Aufgabe</label><input name="text" value="${esc(obj?.text||'')}" required autofocus></div><div class="field"><label>Status</label><select name="status">${TASK_STATUSES.map(s=>`<option value="${s.id}" ${s.id===(obj?.status||(obj?.done?'done':'todo'))?'selected':''}>${s.label}</option>`).join('')}</select></div><div class="field"><label>Reihenfolge</label><input type="number" name="order" min="1" step="1" value="${obj?.order||state.tasks.length+1}" required></div><div class="field"><label>Topic</label><select name="topic"><option value="">Ohne</option>${topicOpts}</select></div><div class="field"><label>Priorität</label><select name="priority"><option ${obj?.priority==='Hoch'?'selected':''}>Hoch</option><option ${obj?.priority==='Mittel'||!obj?'selected':''}>Mittel</option><option ${obj?.priority==='Niedrig'?'selected':''}>Niedrig</option></select></div><div class="field"><label>Geplant am</label><input type="date" name="date" value="${obj?.date||''}"></div><div class="field"><label>Fälligkeitsdatum</label><input type="date" name="dueDate" value="${obj?.dueDate||''}"></div><div class="field"><label>Anfang</label><input type="time" name="startTime" value="${obj?.startTime||'08:00'}"></div><div class="field"><label>Ende</label><input type="time" name="endTime" value="${obj?.endTime||'09:00'}"></div><div class="field"><label>Wiederholung</label><select name="rec"><option value="none">Keine</option><option value="daily" ${obj?.rec==='daily'?'selected':''}>Täglich</option><option value="weekly" ${obj?.rec==='weekly'?'selected':''}>Wöchentlich</option></select></div><div class="field full"><label>Sprints</label><textarea name="sprints" rows="3">${esc(obj?.sprints||'')}</textarea></div></div>`;
if(type==='timebox')f=`<div class="fields"><div class="field full"><label>Name</label><input name="title" required autofocus></div><div class="field"><label>Minuten</label><input type="number" name="minutes" min="1" max="600" value="25" required></div></div>`;
if(type==='event')f=`<div class="fields"><div class="field full"><label>Titel</label><input name="title" value="${esc(obj?.title||'')}" required autofocus></div><div class="field"><label>Datum</label><input type="date" name="date" value="${obj?.date||iso(monday(state.weekOffset))}" required></div><div class="field"><label>Uhrzeit</label><select name="time">${times.map(t=>`<option ${obj?.time===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field full"><label>Topic</label><select name="topic"><option value="">Ohne</option>${topicOpts}</select></div></div>`;
document.getElementById('form').innerHTML=f+`<div class="dialog-actions"><button type="button" class="btn" onclick="closeModal()">Abbrechen</button><button class="btn primary">Speichern</button></div>`;
document.getElementById('form').dataset.id=obj?.id||''}
function closeModal(){document.getElementById('modal').classList.remove('open');modalType=null}
function saveModal(e){e.preventDefault();let d=Object.fromEntries(new FormData(e.target)),id=+e.target.dataset.id||Date.now();
if(modalType==='topic')state.topics.push({id,name:d.name,color:d.color});
if(modalType==='task'){let old=state.tasks.find(x=>x.id===id),order=Math.max(1,parseInt(d.order,10)||state.tasks.length+1),status=TASK_STATUSES.some(x=>x.id===d.status)?d.status:'todo';if(old){let wasDone=old.status==='done';Object.assign(old,{text:d.text,status,done:status==='done',order,topic:d.topic?+d.topic:null,priority:d.priority,date:d.date,dueDate:d.dueDate,sprints:d.sprints,startTime:d.startTime,endTime:d.endTime,rec:d.rec});if(!wasDone&&old.done&&old.rec!=='none')scheduleRecurring(old)}else state.tasks.push({id,text:d.text,status,done:status==='done',order,topic:d.topic?+d.topic:null,priority:d.priority,date:d.date,dueDate:d.dueDate,sprints:d.sprints,startTime:d.startTime,endTime:d.endTime,rec:d.rec})}
if(modalType==='timebox'){let sec=+d.minutes*60;state.boxes.push({id,title:d.title,minutes:+d.minutes,remaining:sec,running:false})}
if(modalType==='event'){let old=state.events.find(x=>x.id===id);if(old)Object.assign(old,{title:d.title,date:d.date,time:d.time,topic:d.topic?+d.topic:null});else state.events.push({id,title:d.title,date:d.date,time:d.time,topic:d.topic?+d.topic:null})}
closeModal();save();render()}
function exportData(){let blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='planning-backup.json';a.click();URL.revokeObjectURL(a.href)}
function importData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{state={...defaultState,...JSON.parse(r.result)};state.tasks=normalizeTasks(state.tasks);save();render();alert('Import erfolgreich.')}catch{alert('Ungültige JSON-Datei.')}};r.readAsText(f)}

// Start async initialization
init();
