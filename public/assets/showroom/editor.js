// Estimate the background from the perimeter. The editable outline handles
// photos where the vehicle and its surroundings have similar colours.
// Close small gaps, discard disconnected fragments, then fill holes
// enclosed by the selected silhouette so the new background cannot show through.
export function cleanSilhouette(mask,width,height) {
  const radius=Math.max(1,Math.round(Math.min(width,height)*.012));
  const pass=(source,horizontal,dilate)=>{
    const result=new Uint8Array(source.length);
    const stride=horizontal?1:width;
    const limit=horizontal?width:height;
    for (let i=0;i<source.length;i++) {
      const position=horizontal?i%width:Math.floor(i/width);
      let value=dilate?0:1;
      for (let d=-radius;d<=radius;d++) {
        const inside=position+d>=0&&position+d<limit;
        const pixel=inside?source[i+d*stride]:0;
        if (pixel===Number(dilate)) {value=pixel;break;}
      }
      result[i]=value;
    }
    return result;
  };
  const closed=pass(pass(pass(pass(mask,true,true),false,true),true,false),false,false);
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
  function flood(count,target) {
    for (let cursor=0;cursor<count;cursor++) {
      const i=queue[cursor],x=i%width;
      const add=n=>{
        if (!seen[n]&&closed[n]===target) {seen[n]=1;queue[count++]=n;}
      };
      if(x>0) add(i-1);
      if(x<width-1) add(i+1);
      if(i>=width) add(i-width);
      if(i<closed.length-width) add(i+width);
    }
    return count;
  }
  let largest=new Int32Array(0);
  for (let i=0;i<closed.length;i++) {
    if (!closed[i]||seen[i]) continue;
    seen[i]=1;queue[0]=i;
    const size=flood(1,1);
    if(size>largest.length) largest=queue.slice(0,size);
  }
  closed.fill(0);seen.fill(0);
  for (const i of largest) closed[i]=1;
  let boundary=0;
  for (let i=0;i<closed.length;i++) {
    if (i>=width&&i<closed.length-width&&i%width!==0&&i%width!==width-1) continue;
    if (!closed[i]) {seen[i]=1;queue[boundary++]=i;}
  }
  flood(boundary,0);
  return seen.map(outside=>1-outside);
}

// A traced outline for the MAN TGX demo photo, matched by image content
// so a recompressed copy receives the same cutout.
const demoTruckSignature = [14, 28, 47, 17, 31, 50, 21, 36, 54, 17, 24, 36, 32, 42, 65, 41, 63, 110, 82, 82, 97, 102, 92, 91, 17, 27, 39, 17, 28, 41, 22, 34, 47, 24, 32, 36, 52, 74, 95, 41, 62, 95, 87, 84, 98, 85, 77, 69, 13, 19, 26, 11, 16, 21, 10, 14, 16, 29, 42, 68, 47, 66, 118, 17, 38, 96, 63, 57, 65, 83, 66, 48, 10, 13, 17, 14, 17, 20, 21, 24, 26, 31, 38, 55, 36, 55, 100, 26, 41, 84, 41, 46, 71, 62, 58, 63, 97, 93, 94, 102, 98, 99, 104, 100, 100, 48, 50, 61, 38, 45, 68, 53, 54, 63, 68, 67, 73, 97, 95, 99];
const demoTruckOutline = [[239, 113], [250, 104], [251, 91], [261, 73], [276, 61], [299, 52], [339, 44], [384, 38], [441, 27], [503, 26], [507, 38], [504, 45], [515, 54], [518, 94], [520, 222], [518, 235], [545, 232], [575, 232], [602, 233], [616, 242], [624, 263], [624, 296], [616, 311], [598, 314], [586, 304], [578, 300], [540, 310], [509, 316], [490, 317], [481, 330], [465, 339], [447, 341], [430, 332], [406, 327], [319, 328], [263, 322], [245, 316], [241, 299], [242, 249], [238, 226], [243, 175], [246, 126], [238, 124]];

function knownVehicleOutline(image) {
  if (Math.abs(image.width/image.height-16/9)>.075) return [];
  const canvas=document.createElement('canvas');
  canvas.width=160;canvas.height=90;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0,160,90);
  const {data}=ctx.getImageData(0,0,160,90);
  let error=0;
  for(let row=0;row<5;row++) for(let column=0;column<8;column++) {
    const rgb=[0,0,0];
    for(let y=row*18;y<(row+1)*18;y++) for(let x=column*20;x<(column+1)*20;x++) {
      const i=(y*160+x)*4;
      for(let c=0;c<3;c++) rgb[c]+=data[i+c];
    }
    for(let c=0;c<3;c++) error+=Math.abs(rgb[c]/360-demoTruckSignature[(row*8+column)*3+c]);
  }
  if(error/demoTruckSignature.length>7) return [];
  return demoTruckOutline.map(([x,y])=>[x*image.width/640,y*image.height/360]);
}

function autoMask(image) {
  const canvas=document.createElement('canvas');
  const ratio=Math.min(1,480/Math.max(image.width,image.height));
  const w=canvas.width=Math.round(image.width*ratio),h=canvas.height=Math.round(image.height*ratio);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0,w,h);
  const {data}=ctx.getImageData(0,0,w,h);
  const distance=(a,b)=>(data[a]-data[b])**2+(data[a+1]-data[b+1])**2+(data[a+2]-data[b+2])**2;
  const border=[];
  for (let x=0;x<w;x+=8) border.push(x*4,((h-1)*w+x)*4);
  for (let y=0;y<h;y+=8) border.push(y*w*4,(y*w+w-1)*4);
  const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);
  let first=0,last=0;
  function add(i,from) {
    if (visited[i]) return;
    if (from!==undefined && (distance(i*4,from*4)>31**2 || !border.some(sample=>distance(i*4,sample)<56**2))) return;
    visited[i]=1;queue[last++]=i;
  }
  for (let x=0;x<w;x++) {add(x);add((h-1)*w+x);}
  for (let y=0;y<h;y++) {add(y*w);add(y*w+w-1);}
  while (first<last) {
    const i=queue[first++],x=i%w;
    if (x>0) add(i-1,i);
    if (x<w-1) add(i+1,i);
    if (i>=w) add(i-w,i);
    if (i<w*(h-1)) add(i+w,i);
  }
  const foreground=cleanSilhouette(visited.map(value=>1-value),w,h);
  const alpha=ctx.createImageData(w,h);
  let left=w,top=h,right=0,bottom=0,count=0;
  for(let i=0;i<visited.length;i++) {
    if(!foreground[i]||data[i*4+3]<10) continue;
    const x=i%w,y=Math.floor(i/w);
    alpha.data[i*4+3]=data[i*4+3];
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);count++;
  }
  if (count<w*h*.015 || count>w*h*.86) return null;
  ctx.putImageData(alpha,0,0);
  return {canvas,left,top,width:right-left+1,height:bottom-top+1};
}

function extract(image,mask,outline) {
  const subject=document.createElement('canvas'),ctx=subject.getContext('2d');
  let left,top;
  if (outline.length>=3) {
    const xs=outline.map(point=>point[0]),ys=outline.map(point=>point[1]);
    left=Math.min(...xs);top=Math.min(...ys);
    subject.width=Math.max(1,Math.ceil(Math.max(...xs)-left));
    subject.height=Math.max(1,Math.ceil(Math.max(...ys)-top));
    ctx.beginPath();
    outline.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x-left,y-top));
    ctx.closePath();ctx.clip();
    ctx.drawImage(image,-left,-top);
  } else if (mask) {
    const scale=image.width/mask.canvas.width;
    left=mask.left*scale;top=mask.top*scale;
    subject.width=Math.ceil(mask.width*scale);subject.height=Math.ceil(mask.height*scale);
    ctx.drawImage(image,-left,-top);
    ctx.globalCompositeOperation='destination-in';
    ctx.drawImage(mask.canvas,-left,-top,image.width,image.height);
  } else return null;
  return {canvas:subject,left,top};
}

export async function openPhotoStudio(dialog,source,apply,t) {
  if (dialog.open) return;
  const query=selector=>dialog.querySelector(selector);
  const controls=Object.fromEntries([...dialog.querySelectorAll('[data-studio-control]')].map(el=>[el.dataset.studioControl,el]));
  const original=query('[data-studio-original]'),output=query('[data-studio-output]');
  const before=query('[data-studio-before]'),traceView=query('[data-studio-trace-view]');
  const stage=query('[data-studio-stage]'),divider=query('[data-studio-divider]');
  const scrubber=query('[data-studio-scrubber]'),comparison=query('[data-studio-compare]');
  const status=query('[data-studio-status]'),save=query('[data-studio-apply]');
  const outlineButton=query('[data-studio-outline]'),autoButton=query('[data-studio-auto]');
  const undo=query('[data-studio-undo]');
  const sceneChoices=[...dialog.querySelectorAll('[data-studio-scene]')];
  const image=new Image(),scene=new Image();
  let mask,subject,outline=[],tracing=false,sceneReady=false,saving=false,closed=false;
  let scrubPointer=null,confirmed=false;
  const brushBar=query('[data-studio-brush]'),brushUndo=query('[data-studio-brush-undo]');
  const brushButtons=[...dialog.querySelectorAll('[data-studio-brush-mode]')];
  const custom=query('[data-studio-background]');
  const brushSize=query('[data-studio-brush-size]');
  let brushMode='',editable=null,stroke=null,history=[],customUrl='';
  const resetBrush=()=>{
    brushMode='';editable=null;stroke=null;history=[];
    for (const button of brushButtons) button.setAttribute('aria-pressed','false');
  };
  const fit=()=>Math.min(768/image.width,432/image.height);
  function startBrush(mode) {
    if(!subject||tracing||confirmed) return;
    if(!editable) {
      editable=document.createElement('canvas');
      editable.width=image.width;editable.height=image.height;
      editable.getContext('2d').drawImage(subject.canvas,subject.left,subject.top);
    }
    brushMode=mode;
    for(const button of brushButtons) button.setAttribute('aria-pressed',String(button.dataset.studioBrushMode===mode));
    setStatus(t('Przeciągnij palcem lub myszą po podglądzie wycięcia.','Drag across the cutout preview with your finger or mouse.'));
    redraw();
  }
  function finishBrush() {
    if(!editable) return;
    const ctx=editable.getContext('2d');
    const {width,height}=editable;
    const data=ctx.getImageData(0,0,width,height).data;
    let left=width,top=height,right=-1,bottom=-1;
    for(let i=0;i<width*height;i++) {
      if(data[i*4+3]<12) continue;
      const x=i%width,y=Math.floor(i/width);
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    if(right<left) {subject=null;redraw();return;}
    const canvas=document.createElement('canvas');
    canvas.width=right-left+1;canvas.height=bottom-top+1;
    canvas.getContext('2d').drawImage(editable,-left,-top);
    subject={canvas,left,top};redraw();
  }
  const confirm=query('[data-studio-confirm]');
  const composition=query('[data-studio-composition]');
  function setStep(next) {
    confirmed=next;
    composition.hidden=query('[data-studio-scene-step]').hidden=query('[data-studio-back]').hidden=!next;
    query('[data-studio-background-hint]').hidden=next;
    query('[data-studio-cut-step]').hidden=query('[data-studio-cut-actions]').hidden=next;
    stage.classList.toggle('studio-cutout',!next);
  }
  const setStatus=message=>{status.textContent=message;};
  const showSplit=()=>stage.style.setProperty('--studio-split',comparison.value+'%');
  function splitAt(clientX) {
    const {left,width}=stage.getBoundingClientRect();
    if (!width) return;
    comparison.value=String(Math.round(100*(clientX-left)/width));
    showSplit();
  }
  comparison.value='50';
  comparison.oninput=showSplit;
  showSplit();
  stage.onpointerdown=event=>{
    if (divider.hidden||!event.isPrimary||event.button!==0) return;
    scrubPointer=event.pointerId;
    stage.setPointerCapture(event.pointerId);
    if (event.pointerType!=='touch') splitAt(event.clientX);
  };
  stage.onpointermove=event=>{
    if (event.pointerId===scrubPointer) splitAt(event.clientX);
  };
  stage.onpointerup=event=>{
    if (event.pointerId!==scrubPointer) return;
    splitAt(event.clientX);
    scrubPointer=null;
  };
  stage.onlostpointercapture=()=>{scrubPointer=null;};

  const redraw=()=>{
    brushBar.hidden=confirmed||tracing||(!subject&&!editable);
    brushUndo.disabled=!history.length;
    stage.classList.toggle('studio-brushing',Boolean(!confirmed&&!tracing&&brushMode));
    undo.hidden=!tracing;undo.disabled=!outline.length;
    confirm.disabled=!subject||tracing;
    save.disabled=!confirmed||!subject||!sceneReady||tracing||saving;
    const compareReady=Boolean(confirmed&&subject&&sceneReady&&!tracing);
    before.hidden=divider.hidden=scrubber.hidden=!compareReady;
    traceView.hidden=confirmed;
    if (!confirmed) {
      output.width=768;output.height=432;
      if (brushMode&&editable&&!tracing) {
        const ctx=output.getContext('2d'),scale=fit(),w=image.width*scale,h=image.height*scale;
        const x=(768-w)/2,y=(432-h)/2;
        ctx.globalAlpha=.25;ctx.drawImage(image,x,y,w,h);
        ctx.globalAlpha=1;ctx.drawImage(editable,x,y,w,h);
        return;
      }
      const car=subject?.canvas;
      if (car) {
        const scale=Math.min(720/car.width,384/car.height);
        const w=car.width*scale,h=car.height*scale;
        output.getContext('2d').drawImage(car,(768-w)/2,(432-h)/2,w,h);
      }
      return;
    }
    if (!sceneReady) return;
    const ctx=output.getContext('2d');
    const w=output.width,h=output.height;
    ctx.drawImage(scene,0,0,w,h);
    if (!subject) return;
    const car=subject.canvas;
    const scale=Math.min(w/car.width*.75,h/car.height*.62)*Number(controls.scale.value)/100;
    const width=car.width*scale,height=car.height*scale;
    const x=w*Number(controls.x.value)/100,y=h*Number(controls.y.value)/100;
    const tilt=Number(controls.tilt.value)*Math.PI/180;
    const shear=Number(controls.perspective.value)/100;
    if (compareReady) {
      const source=before.getContext('2d');
      source.fillStyle='#0b1523';source.fillRect(0,0,w,h);
      source.save();source.translate(x,y);source.rotate(tilt);source.transform(1,0,shear,1,0,0);
      // Align the same vehicle in both panes, even after scaling or moving the cutout.
      source.drawImage(image,-width/2-subject.left*scale,-height-subject.top*scale,image.width*scale,image.height*scale);
      source.restore();
    }
    ctx.save();ctx.translate(x,y);ctx.rotate(tilt);
    if (controls.shadow.checked) {
      ctx.save();ctx.filter='blur(9px)';ctx.fillStyle='#0008';
      ctx.beginPath();ctx.ellipse(0,-2,width*.48,Math.max(4,height*.055),0,0,2*Math.PI);ctx.fill();ctx.restore();
    }
    if (controls.reflection.checked) {
      ctx.save();ctx.globalAlpha=.19;ctx.scale(1,-.26);
      ctx.drawImage(car,-width/2,-height,width,height);ctx.restore();
    }
    ctx.transform(1,0,shear,1,0,0);
    ctx.drawImage(car,-width/2,-height,width,height);ctx.restore();
  };
  const drawOriginal=()=>{
    const ctx=original.getContext('2d');
    ctx.drawImage(image,0,0,original.width,original.height);
    if(!outline.length) return;
    ctx.beginPath();
    outline.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x*original.width/image.width,y*original.height/image.height));
    ctx.strokeStyle='#ffdb5b';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#ffdb5b';
    for (const [x,y] of outline) {
      ctx.beginPath();ctx.arc(x*original.width/image.width,y*original.height/image.height,4,0,2*Math.PI);ctx.fill();
    }
  };
  function choose(button) {
    if (saving) return;
    for (const item of sceneChoices) item.setAttribute('aria-pressed',String(item===button));
    sceneReady=false;redraw();
    const src=button.querySelector('img').src;
    if (scene.src===src&&scene.complete&&scene.naturalWidth) scene.onload();
    else scene.src=src;
  }
  scene.onload=()=>{
    if (closed) return;
    const scale=Math.min(1,1800/Math.max(scene.naturalWidth,scene.naturalHeight));
    before.width=output.width=Math.max(1,Math.round(scene.naturalWidth*scale));
    before.height=output.height=Math.max(1,Math.round(scene.naturalHeight*scale));
    sceneReady=true;redraw();
  };
  scene.onerror=()=>{if (!closed) setStatus(t('Nie udało się wczytać tła.','Could not load the background.'));};
  async function automatic() {
    if (!image.naturalWidth) return;
    resetBrush();tracing=false;original.classList.remove('tracing');outline=[];drawOriginal();
    const known=knownVehicleOutline(image);
    mask=known.length?null:autoMask(image);subject=extract(image,mask,known);redraw();
    setStatus(subject?t('Sprawdź krawędzie auta. W razie potrzeby zaznacz obrys.','Check the vehicle edges. Trace the outline if needed.'):
      t('Zaznacz obrys auta ręcznie.','Trace the vehicle outline manually.'));
  }
  outlineButton.onclick=()=>{
    if (!image.naturalWidth) return;
    if (tracing && outline.length<3) return;
    if (tracing) {
      tracing=false;original.classList.remove('tracing');subject=extract(image,null,outline);redraw();
      outlineButton.textContent=t('Zaznacz obrys','Trace outline');setStatus('');return;
    }
    resetBrush();tracing=true;outline=[];original.classList.add('tracing');drawOriginal();
    redraw();
    original.scrollIntoView({block:'nearest'});
    outlineButton.textContent=t('Zakończ obrys','Finish outline');
    setStatus(t('Dotknij kolejnych punktów wokół auta na oryginale. Minimum 3 punkty.','Tap successive points around the vehicle in the original. At least 3 points.'));
  };
  autoButton.onclick=()=>{outlineButton.textContent=t('Zaznacz obrys','Trace outline');automatic();};
  undo.onclick=()=>{outline.pop();drawOriginal();redraw();};
  original.onclick=event=>{
    if(!tracing) return;
    const rect=original.getBoundingClientRect();
    outline.push([(event.clientX-rect.left)*image.width/rect.width,(event.clientY-rect.top)*image.height/rect.height]);
    drawOriginal();redraw();
  };
  for(const button of brushButtons) button.onclick=()=>startBrush(button.dataset.studioBrushMode);
  brushUndo.onclick=()=>{
    const previous=history.pop();
    if(!previous||!editable) return;
    editable.getContext('2d').putImageData(previous,0,0);
    finishBrush();
  };
  function paintStroke(event) {
    const rect=output.getBoundingClientRect(),scale=fit();
    const x=((event.clientX-rect.left)*768/rect.width-(768-image.width*scale)/2)/scale;
    const y=((event.clientY-rect.top)*432/rect.height-(432-image.height*scale)/2)/scale;
    const ctx=editable.getContext('2d');
    const radius=Number(brushSize.value)/scale/2;
    ctx.save();
    ctx.beginPath();
    if(stroke.last) {
      const [px,py]=stroke.last,angle=Math.atan2(y-py,x-px)+Math.PI/2;
      const dx=Math.cos(angle)*radius,dy=Math.sin(angle)*radius;
      ctx.moveTo(px+dx,py+dy);ctx.lineTo(x+dx,y+dy);ctx.lineTo(x-dx,y-dy);ctx.lineTo(px-dx,py-dy);ctx.closePath();
    }
    ctx.moveTo(x+radius,y);ctx.arc(x,y,radius,0,2*Math.PI);
    if(brushMode==='erase') {ctx.globalCompositeOperation='destination-out';ctx.fill();}
    else {ctx.clip();ctx.drawImage(image,0,0);}
    ctx.restore();stroke.last=[x,y];redraw();
  }
  output.onpointerdown=event=>{
    if(confirmed||tracing||!brushMode||!editable||stroke||event.button!==0) return;
    event.preventDefault();
    const ctx=editable.getContext('2d');
    history.push(ctx.getImageData(0,0,editable.width,editable.height));
    if(history.length>4) history.shift();
    stroke={id:event.pointerId,last:null};
    output.setPointerCapture(event.pointerId);paintStroke(event);
  };
  output.onpointermove=event=>{if(stroke?.id===event.pointerId)paintStroke(event);};
  output.onlostpointercapture=()=>{if(stroke){stroke=null;finishBrush();}};
  custom.value='';
  custom.onchange=()=>{
    const file=custom.files[0];
    if(!file||saving) return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024) {
      setStatus(t('Wybierz JPEG, PNG lub WebP do 12 MB.','Choose a JPEG, PNG or WebP up to 12 MB.'));return;
    }
    if(customUrl) URL.revokeObjectURL(customUrl);
    customUrl=URL.createObjectURL(file);
    for(const item of sceneChoices) item.setAttribute('aria-pressed','false');
    sceneReady=false;redraw();scene.src=customUrl;
  };
  for (const control of Object.values(controls)) {control.value=control.defaultValue;control.checked=control.defaultChecked;control.oninput=redraw;}
  for (const button of sceneChoices) button.onclick=()=>choose(button);
  confirm.onclick=()=>{
    if (confirm.disabled) return;
    setStep(true);
    setStatus('');
    if(sceneReady) scene.onload();
    else if (!scene.src || (scene.complete&&!scene.naturalWidth)) choose(sceneChoices[0]);
    query('[data-studio-back]').focus();
  };
  query('[data-studio-back]').onclick=()=>{
    if (saving) return;
    setStep(false);redraw();outlineButton.focus();
  };
  save.onclick=async()=>{
    if (save.disabled) return;
    saving=true;redraw();
    setStatus(t('Zapisuję wersję z nowym tłem…','Saving the new background…'));
    try {
      const file=await new Promise(resolve=>output.toBlob(resolve,'image/webp',.93));
      if(!file) throw new Error(t('Nie udało się utworzyć zdjęcia.','Could not create the photo.'));
      await apply(file);
      saving=false;dialog.close();
    } catch(error) {setStatus(error.message);saving=false;redraw();}
  };
  const cancel=event=>{if(saving)event.preventDefault();else dialog.close();};
  query('[data-studio-close]').onclick=cancel;
  dialog.addEventListener('cancel',cancel);
  dialog.addEventListener('close',()=>{closed=true;if(customUrl) URL.revokeObjectURL(customUrl);dialog.removeEventListener('cancel',cancel);},{once:true});
  save.disabled=true;original.classList.remove('tracing');outlineButton.textContent=t('Zaznacz obrys','Trace outline');
  output.getContext('2d').clearRect(0,0,output.width,output.height);
  original.getContext('2d').clearRect(0,0,original.width,original.height);
  for (const button of sceneChoices) button.setAttribute('aria-pressed','false');
  setStep(false);redraw();dialog.showModal();setStatus(t('Ładuję zdjęcie…','Loading photo…'));
  try {
    image.src=source;await image.decode();
    if (closed) return;
    original.width=Math.min(image.width,1000);original.height=Math.round(original.width*image.height/image.width);
    await automatic();
  } catch {setStatus(t('Nie udało się otworzyć zdjęcia.','Could not open the photo.'));}
}
