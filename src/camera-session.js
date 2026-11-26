import { conflict, fail, integer, isId } from './core.js';

export const exteriorAngles={front_left:315,front:0,front_right:45,right:90,rear_right:135,rear:180,rear_left:225,left:270};
const shots=new Set([...Object.keys(exteriorAngles),'cockpit','instruments','odometer','front_seats','rear_seats','trunk','engine_bay','wheels','equipment','damage']);
const frameCounts=[12,24,36];
const invalidCapture=()=>fail(422,'Sprawdź rodzaj ujęcia i kąt sesji.','Check the shot type and session angle.');
const validAngle=(angle,count)=>Number.isInteger(angle)&&angle>=0&&angle<360&&angle%(360/count)===0;

export function cameraState(saved,photos,spin) {
  const captured=Object.fromEntries(Object.entries(saved?.shots||{}).filter(([shot,id])=>shots.has(shot)&&photos.includes(id)));
  const skipped=[...new Set(Array.isArray(saved?.skipped)?saved.skipped:[])].filter(shot=>shots.has(shot)&&!captured[shot]);
  const count=saved?.spinCount;
  const frames=Object.fromEntries(Object.entries(saved?.frames||{}).filter(([angle,id])=>
    frameCounts.includes(count)&&validAngle(Number(angle),count)&&spin.includes(id)));
  return {shots:captured,skipped,spinCount:frameCounts.includes(count)?count:null,frames};
}

export function keepCameraState(data,camera) {
  if(Object.keys(camera.shots).length||camera.skipped.length||camera.spinCount) data.smartCamera=camera;
  else delete data.smartCamera;
}

export function setSkipped(camera,action) {
  if(!action||!shots.has(action.shot)||typeof action.skip!=='boolean'||(action.skip&&camera.shots[action.shot])) invalidCapture();
  camera.skipped=camera.skipped.filter(shot=>shot!==action.shot);
  if(action.skip) camera.skipped.push(action.shot);
}

export function setSpinCount(camera,count,spin) {
  if(!frameCounts.includes(count)) invalidCapture();
  if(spin.length&&camera.spinCount!==count)
    fail(409,'Ukończ lub usuń obecną serię 360°.','Finish or remove the current spin sequence.');
  camera.spinCount=count;
}

export function cameraTarget(headers,group) {
  const shot=headers.get('X-Studio-Shot'), count=headers.get('X-Studio-Frames'), angle=headers.get('X-Studio-Angle');
  const replace=headers.get('X-Studio-Replace'), reuse=headers.get('X-Studio-Reuse');
  if([shot,count,angle,replace,reuse].every(v=>v===null)) return null;
  if((replace!==null&&!isId(replace))||(reuse!==null&&!isId(reuse))) invalidCapture();
  if(group==='photos') {
    if(!shots.has(shot)||count!==null||angle!==null||reuse!==null) invalidCapture();
    return {shot,replace,reuse};
  }
  const spinCount=integer(count,12,36),degree=integer(angle,0,359);
  if(shot!==null||!frameCounts.includes(spinCount)||!validAngle(degree,spinCount)) invalidCapture();
  return {spinCount,angle:degree,replace,reuse};
}

export function currentSlot(camera,target) {
  return target.shot?camera.shots[target.shot]:camera.spinCount===target.spinCount?camera.frames[target.angle]:undefined;
}

export function checkCameraSlot(state,target) {
  const camera=state.smartCamera;
  if(!target.shot&&state.spin.length&&camera.spinCount!==target.spinCount)
    fail(409,'Szkic zawiera już inną serię 360°. Usuń ją, aby rozpocząć nową.','This draft already has another spin sequence. Remove it to start a new one.');
  if((currentSlot(camera,target)??null)!==target.replace) conflict();
  if(target.reuse&&!Object.entries(camera.shots).some(([shot,id])=>id===target.reuse&&exteriorAngles[shot]===target.angle))
    fail(422,'Do tego kąta wybierz zgodne zdjęcie zewnętrzne z tej galerii.','Use a matching exterior shot from this gallery for this angle.');
}

export function cameraCapture(state,group,target,id) {
  const camera=structuredClone(state.smartCamera), data={...state.data};
  const registered=target.shot?camera.shots:camera.frames;
  if(Object.values(registered).includes(id))
    fail(422,'To zdjęcie przypisano już do innego ujęcia.','This image already belongs to another shot.');
  let media;
  if(target.shot) {
    // An ordinary gallery photo may be tagged in place without duplicating it.
    if(target.replace&&state.photos.includes(id))
      fail(422,'Zdjęcie zastępcze jest już w galerii.','The replacement is already in the gallery.');
    media=target.replace?state.photos.map(key=>key===target.replace?id:key):state.photos.includes(id)?state.photos:[...state.photos,id];
    camera.shots[target.shot]=id;
    camera.skipped=camera.skipped.filter(shot=>shot!==target.shot);
    if(target.replace&&data.photoDetails?.[target.replace]) {
      data.photoDetails={...data.photoDetails,[id]:data.photoDetails[target.replace]};
      delete data.photoDetails[target.replace];
    }
  } else {
    if(state.photos.includes(id)&&!Object.entries(camera.shots).some(([shot,key])=>key===id&&exteriorAngles[shot]===target.angle))
      fail(422,'Zdjęcie z galerii musi mieć zgodny kąt.','The gallery shot must match this angle.');
    camera.spinCount=target.spinCount;
    camera.frames[target.angle]=id;
    media=orderedFrames(camera);
  }
  keepCameraState(data,camera);
  return {data,[group]:media};
}

export function orderedFrames(camera) {
  return Object.entries(camera.frames).sort(([a],[b])=>Number(a)-Number(b)).map(([,id])=>id);
}
