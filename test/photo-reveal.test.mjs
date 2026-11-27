import assert from 'node:assert/strict';
import test from 'node:test';
import { animatePhotoReveal } from '../public/assets/photo-reveal-effect.js';

test('reduced motion preserves the timer completion and restores controls when interrupted',t=>{
  const animations=[];
  function element() {
    return {
      style:{}, children:[], setAttribute(){},
      getBoundingClientRect:()=>({left:0,top:0,width:390,height:100,bottom:100}),
      append(child){this.children.push(child);child.parent=this;},
      remove(){this.parent.children=this.parent.children.filter(node=>node!==this);},
      animate(frames,options){
        const animation={node:this,frames,options,cancelled:false,cancel(){this.cancelled=true;}};
        animations.push(animation);
        return animation;
      }
    };
  }
  for(const [name,value] of Object.entries({
    matchMedia:query=>({matches:query==='(prefers-reduced-motion: reduce)'}),
    document:{createElement:element},getComputedStyle:()=>({opacity:'1'}),innerHeight:844
  })) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name];});
  }
  for(const mode of ['classic','scatter']) {
    const card=element(), photo=element(), control=element();
    card.append(photo);card.append(control);
    for(const interrupt of [true,false]) {
      animations.length=0;
      let completed=0;
      const cancel=animatePhotoReveal(card,[control],{mode,onFinish:()=>completed++});
      const layer=card.children.at(-1);
      assert.ok(layer.inert);
      assert.equal(layer.children.length,0,'reduced motion has no fragments or wave');
      assert.deepEqual(animations.map(item=>item.node),[control,layer]);
      const [fade,timeline]=animations;
      assert.deepEqual(fade.frames,[{opacity:'1'},{opacity:0}]);
      assert.ok(timeline.options.duration>0 && timeline.options.duration<200);
      if(interrupt)cancel();
      timeline.onfinish();
      timeline.onfinish();
      assert.equal(completed,interrupt?0:1,'late finish must not commit a cancelled view');
      assert.deepEqual(card.children,[photo,control]);
      assert.ok(animations.every(animation=>animation.cancelled));
    }
  }
});
