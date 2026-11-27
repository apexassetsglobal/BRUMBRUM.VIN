// Each polygon contains real pixels from the same icon, including its rim and face.
const shards = [
  'polygon(0 0,58% 0,46% 42%,0 62%)',
  'polygon(58% 0,100% 0,100% 39%,46% 42%)',
  'polygon(100% 39%,100% 100%,68% 100%,46% 42%)',
  'polygon(68% 100%,16% 100%,46% 42%)',
  'polygon(16% 100%,0 100%,0 62%,46% 42%)'
];
const iconSelector = '.ui-icon,[data-reveal-icon]';
const paintProperties = ['color','fill','stroke','stroke-width','display','visibility','opacity','filter'];
const faceProperties = ['background-image','background-position','background-size','background-repeat',
  'background-color','border-radius','rotate','object-fit','object-position'];

function copyPaint(source, copy, properties) {
  const paint = getComputedStyle(source);
  for (const key of properties) copy.style.setProperty(key, paint.getPropertyValue(key));
}

function snapshotIcon(icon) {
  // Most 3D collections render a single atlas tile with the SVG glyph hidden.
  // Copy just that tile so five fragments don't multiply invisible SVG paths.
  const tileOnly = icon.matches('svg.ui-icon') && getComputedStyle(icon).backgroundImage !== 'none' &&
    Array.from(icon.children).every(child => getComputedStyle(child).opacity === '0');
  const face = tileOnly ? document.createElement('span') : icon.cloneNode(true);
  // The detached face no longer has the original button's active/selected ancestry.
  copyPaint(icon, face, [...paintProperties, ...faceProperties]);
  if (!tileOnly) {
    const original = icon.querySelectorAll('*');
    const children = face.querySelectorAll('*');
    original.forEach((node, i) => copyPaint(node, children[i], paintProperties));
  }
  Object.assign(face.style, {
    display:'block', position:'static', margin:'0', width:'100%', height:'100%',
    minWidth:'0', minHeight:'0', maxWidth:'none', maxHeight:'none', scale:'none', pointerEvents:'none'
  });
  return face;
}

function position(rect, box) {
  return {x:rect.left + rect.width / 2 - box.left, y:rect.top + rect.height / 2 - box.top};
}

function particlePath(x, y, width, height, index, turn) {
  const outward = Math.atan2(y - height / 2, x - width / 2);
  const angle = outward + (index - 2) * .54 + turn * .18;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const edge = Math.min(
    dx === 0 ? Infinity : (dx > 0 ? width - x : -x) / dx,
    dy === 0 ? Infinity : (dy > 0 ? height - y : -y) / dy
  );
  const distance = Math.max(8, edge) * (.76 + index * .045);
  const bend = Math.min(28, distance * .18) * turn;
  const rotation = turn * (12 + index * 7);
  const step = (t, curve, spin, scale) =>
    'translate('+(dx * distance * t - dy * curve)+'px,'+(dy * distance * t + dx * curve)+'px) rotate('+spin+'deg) scale('+scale+')';
  return [
    {transform:step(0,0,0,1), opacity:1},
    {offset:.42, transform:step(.45,bend,rotation * .48,.94), opacity:.95},
    {offset:.75, transform:step(.78,bend * .67,rotation * .82,.82), opacity:.58},
    {transform:step(1,0,rotation,.68), opacity:0}
  ];
}

// Measure the real destination with its responsive sizing. Both layout reads and
// the rollback happen in one task, before the browser paints another frame.
function classicBackdrop(card, stack) {
  const start = card.getBoundingClientRect();
  card.setAttribute('data-photo-view-open', '');
  stack.hidden = false;
  const destination = stack.getBoundingClientRect();
  const endHeight = card.getBoundingClientRect().height;
  stack.hidden = true;
  card.removeAttribute('data-photo-view-open');

  const backdrop = document.createElement('div');
  backdrop.className = 'gallery-photo-stack classic-photo-underlay';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.inert = true;
  Object.assign(backdrop.style, {
    top: (destination.top - start.top - card.clientTop) + 'px',
    left: (destination.left - start.left - card.clientLeft) + 'px',
    width: destination.width + 'px'
  });
  for (const image of stack.querySelectorAll('img')) {
    const tile = document.createElement('div');
    tile.className = 'gallery-stack-photo';
    tile.append(image.cloneNode(false));
    backdrop.append(tile);
  }
  card.prepend(backdrop);
  return {backdrop, startHeight:start.height, endHeight};
}

// The caller owns the gallery's final state and idle timer. Cancel rolls back this
// visual transition synchronously, including when it is running inside a preview.
export function animatePhotoReveal(card, targets, {mode='scatter', photoStack, onFinish}={}) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const scatter = mode === 'scatter' && !motion.matches;
  const classic = mode === 'classic' && !motion.matches;
  const duration = motion.matches ? 110 : scatter ? 600 : 360;
  const layer = document.createElement('span');
  layer.setAttribute('aria-hidden','true');
  layer.setAttribute('data-photo-reveal-layer','');
  layer.inert = true;
  Object.assign(layer.style, {
    position:'absolute', inset:'0', overflow:'hidden', display:'block', zIndex:'9', pointerEvents:'none'
  });

  const animations = [];
  let backdrop;
  let active = true;
  function cancel() {
    if (!active) return;
    active = false;
    for (const animation of animations) animation.cancel();
    backdrop?.remove();
    layer.remove();
  }
  function finish() {
    if (!active) return;
    cancel();
    onFinish?.();
  }
  if (!card.animate) {
    queueMicrotask(finish);
    return cancel;
  }

  const box = card.getBoundingClientRect();
  const radius = Math.max(1,Math.hypot(box.width,box.height) / 2);
  const travel = 270;
  const hit = (x,y) => travel * Math.min(1, Math.hypot(x - box.width / 2,y - box.height / 2) / radius);
  // Read sizes and computed artwork together, before inserting animated content.
  const effects = [];
  const icons = new Set();
  for (const target of new Set(targets)) {
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height || (!classic && (rect.bottom < 0 || rect.top > innerHeight))) continue;
    const {x,y} = position(rect,box);
    const opacity = getComputedStyle(target).opacity;
    effects.push([target,[{opacity},{opacity:0}], {
      delay:scatter ? hit(x,y) + 22 : 0, duration:scatter ? 150 : duration, easing:classic ? 'ease-in-out' : 'ease-in', fill:'forwards'
    }]);
    if (!scatter) continue;
    if (target.matches(iconSelector)) icons.add(target);
    for (const icon of target.querySelectorAll(iconSelector)) icons.add(icon);
  }

  if (classic && photoStack) {
    const bridge = classicBackdrop(card, photoStack);
    backdrop = bridge.backdrop;
    // The destination is opaque before the old layout is removed. The real
    // buttons and gallery never move into this inert, visual-only layer.
    effects.push([backdrop,[{opacity:0},{offset:.78,opacity:1},{opacity:1}],
      {duration,easing:'ease-out',fill:'both'}]);
    effects.push([card,[{height:bridge.startHeight+'px'},{height:bridge.endHeight+'px'}],
      {duration,easing:'ease-in-out',fill:'both'}]);
  }

  if (scatter) {
    const ring = document.createElement('span');
    Object.assign(ring.style, {
      position:'absolute', left:'50%', top:'50%', display:'block', width:2 * radius+'px', height:2 * radius+'px',
      marginLeft:-radius+'px', marginTop:-radius+'px', border:'1px solid rgba(230,238,247,.36)',
      borderRadius:'50%', boxSizing:'border-box', opacity:'0', pointerEvents:'none'
    });
    layer.append(ring);
    effects.push([ring,[
      {transform:'scale(0.005)',opacity:0},
      {offset:.15,transform:'scale(.15)',opacity:.53},
      {offset:.7,transform:'scale(.7)',opacity:.46},
      {transform:'scale(1)',opacity:0}
    ],{duration:travel}]);
    let sequence = 0;
    for (const icon of icons) {
      const rect = icon.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) continue;
      const {x,y} = position(rect,box);
      const delay = hit(x,y);
      const face = snapshotIcon(icon);
      // Hold the original face until the same instant its pieces start moving.
      effects.push([icon,[{opacity:0},{opacity:0}],{delay,duration:duration-delay,fill:'forwards'}]);
      shards.forEach((polygon,index) => {
        const piece = document.createElement('span');
        Object.assign(piece.style, {
          position:'absolute', display:'block', left:(rect.left - box.left)+'px', top:(rect.top - box.top)+'px',
          width:rect.width+'px', height:rect.height+'px', clipPath:polygon, opacity:'0', pointerEvents:'none'
        });
        piece.append(face.cloneNode(true));
        layer.append(piece);
        const turn = (sequence + index) % 2 ? -1 : 1;
        effects.push([piece,particlePath(x,y,box.width,box.height,index,turn),
          {delay,duration:duration-delay,easing:'cubic-bezier(.16,.48,.42,1)'}]);
      });
      sequence++;
    }
  }

  card.append(layer);
  for (const [node,frames,timing] of effects) animations.push(node.animate(frames,timing));
  // One timeline for every visual subeffect, independent of frame rate.
  const timing = layer.animate([{opacity:1},{opacity:1}],{duration});
  animations.push(timing);
  timing.onfinish = finish;
  return cancel;
}
