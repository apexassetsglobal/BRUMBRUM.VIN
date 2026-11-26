// All azimuths locate the photographer. Zero is the nose; 90° is the vehicle's right.
export const profiles = {
  supercar: ['Supercar', 'Supercar'], coupe: ['Coupé', 'Coupé'], cabrio: ['Kabriolet', 'Convertible'],
  sedan: ['Sedan', 'Saloon'], wagon: ['Kombi', 'Estate'], hatchback: ['Hatchback', 'Hatchback'],
  suv: ['SUV', 'SUV'], crossover: ['Crossover', 'Crossover'], pickup: ['Pickup', 'Pickup'],
  van: ['Van osobowy', 'Passenger van'], delivery: ['Samochód dostawczy', 'Delivery van'],
  camper: ['Kamper', 'Motorhome'], truck: ['Ciężarówka', 'Truck'],
  motorcycle: ['Motocykl', 'Motorcycle'], quad: ['Quad', 'Quad']
};

export function autoProfile(type, body) {
  const categories = {motorcycle: 'motorcycle', scooter: 'motorcycle', quad: 'quad', truck: 'truck', camper: 'camper', van: 'delivery'};
  if (Object.hasOwn(categories,type)) return categories[type];
  if (type && type !== 'car') return null;
  const aliases = {
    suv_coupe: 'suv', offroad: 'suv', raised_wagon: 'wagon', shooting_brake: 'wagon',
    minivan: 'van', liftback: 'hatchback', fastback: 'coupe', convertible: 'cabrio',
    roadster: 'cabrio', targa: 'cabrio', panel: 'delivery'
  };
  if (Object.hasOwn(profiles,body)) return body;
  return Object.hasOwn(aliases,body) ? aliases[body] : 'sedan';
}

const shot = (id, angle, label, hint, distance = null) => ({id, angle, label, hint, distance});
export const steps = [
  shot('front_left', 315, ['Przód lewy', 'Front left'], ['Stań przed lewym narożnikiem. Pokaż przód i lewy bok razem. To zalecane zdjęcie główne.', 'Stand ahead of the left corner and include the nose and left side. Use this as your cover photo.'], '4–6 m'),
  shot('front', 0, ['Przód', 'Front'], ['Stań na wprost środka pojazdu. Ułóż reflektory na jednej wysokości.', 'Stand directly in front of the vehicle’s centre and keep the headlights level.'], '4–5 m'),
  shot('front_right', 45, ['Przód prawy', 'Front right'], ['Odejdź od przodu w stronę prawego narożnika, aż zobaczysz oba koła prawego boku.', 'Move from the front towards the right corner until both right wheels are visible.'], '4–6 m'),
  shot('right', 90, ['Prawy bok', 'Right side'], ['Stań przy środku prawego boku. Ustaw aparat równolegle do drzwi i zmieść oba zderzaki.', 'Stand opposite the middle of the right side. Keep the camera parallel to the doors and include both bumpers.'], '4–6 m'),
  shot('rear_right', 135, ['Tył prawy', 'Rear right'], ['Pokaż tył i prawy bok w jednym ujęciu. Zachowaj wysokość z poprzedniego zdjęcia.', 'Include the rear and right side in one frame. Match the camera height of the previous shot.'], '4–6 m'),
  shot('rear', 180, ['Tył', 'Rear'], ['Wyceluj w środek tylnej klapy i zostaw tyle samo miejsca po obu stronach.', 'Aim at the centre of the rear and leave an equal margin on either side.'], '4–5 m'),
  shot('rear_left', 225, ['Tył lewy', 'Rear left'], ['Ustaw się za lewym tylnym narożnikiem. Pokaż lampy i linię lewego boku.', 'Stand behind the left rear corner. Include the tail lights and the left flank.'], '4–6 m'),
  shot('left', 270, ['Lewy bok', 'Left side'], ['Stań przy środku lewego boku. Zostaw miejsce przed i za pojazdem.', 'Stand opposite the middle of the left side. Leave space at both ends.'], '4–6 m'),
  shot('cockpit', null, ['Kokpit', 'Cockpit'], ['Obejmij całą deskę rozdzielczą z wysokości oczu osoby siedzącej z tyłu.', 'Frame the complete dashboard at eye level from the back seat.']),
  shot('instruments', null, ['Kierownica i zegary', 'Steering wheel and instruments'], ['Wyprostuj kierownicę i ustaw ostrość na czytelnych zegarach.', 'Straighten the steering wheel and focus on the instrument cluster.']),
  shot('odometer', null, ['Aktualny przebieg', 'Current mileage'], ['Wypełnij kadr licznikiem. Sprawdź, czy wartość i jednostka przebiegu są czytelne.', 'Fill the frame with the odometer. Keep the reading and its unit legible.']),
  shot('front_seats', null, ['Fotele przednie', 'Front seats'], ['Z otwartych drzwi pokaż oba siedziska, oparcia i stan tapicerki.', 'Photograph both front seats through an open door, including seat backs and upholstery.']),
  shot('rear_seats', null, ['Fotele tylne', 'Rear seats'], ['Pokaż całą kanapę i widoczne miejsca pasażerów.', 'Show the whole rear bench and all visible passenger positions.']),
  shot('trunk', null, ['Bagażnik', 'Boot'], ['Otwórz klapę i pokaż przestrzeń od progu do oparć.', 'Open the boot and show the space from the sill to the seat backs.']),
  shot('engine_bay', null, ['Komora silnika', 'Engine bay'], ['Po otwarciu maski obejmij całą komorę silnika.', 'With the bonnet open, frame the whole engine bay.']),
  shot('wheels', null, ['Felgi i opony', 'Wheels and tyres'], ['Ustaw aparat na wysokości piasty i zmieść całą felgę z oponą.', 'Hold the camera at hub height and include the entire wheel and tyre.']),
  shot('equipment', null, ['Wyposażenie dodatkowe', 'Optional equipment'], ['Wypełnij kadr wybranym elementem wyposażenia i pokaż jego stan.', 'Fill the frame with the accessory and show its condition.']),
  shot('damage', null, ['Uszkodzenia i ślady eksploatacji', 'Damage and wear'], ['Pokaż uszkodzenie razem z fragmentem nadwozia lub wnętrza, aby było widać jego położenie.', 'Include some surrounding bodywork or interior trim so the location of the damage is clear.'])
];

export const guideTips = [
  ['Wysokość aparatu: zwykle 1–1,3 m, przy niskim aucie sportowym 0,7–0,9 m.', 'Camera height: usually 1–1.3 m, or 0.7–0.9 m for a low sports car.'],
  ['Kadruj poziomo. Zostaw około 10% wolnego miejsca wokół całego pojazdu.', 'Shoot in landscape. Leave about 10% clear space around the whole vehicle.'],
  ['Wybierz obiektyw 1×. Obiektyw ultraszerokokątny zniekształca proporcje.', 'Choose the main 1× lens. An ultrawide lens distorts proportions.'],
  ['Wybierz czyste, neutralne tło i miękkie światło dzienne. Ustaw się tak, aby słońce nie świeciło w obiektyw.', 'Choose a clean, neutral background and soft daylight. Keep direct sunlight out of the lens.'],
  ['Dobierz odległość do wielkości pojazdu. Podczas obchodu utrzymuj stałą wysokość i odległość od środka.', 'Adjust your distance to the vehicle size. Keep the same height and radius as you walk around it.'],
  ['Lewa i prawa strona są określone zgodnie z kierunkiem jazdy. Kąt wskazuje miejsce, z którego robisz zdjęcie.', 'Left and right follow the direction of travel. Each angle marks where the photographer stands.']
];

// Length, width, height, wheel radius, and body belt height in metres, followed by
// windscreen / front roof / rear roof / rear glass positions as fractions of body length.
const shapes = {
  supercar: [4.90, 2.03, 1.17, .35, .77, .26, .045, -.19, -.38],
  coupe: [4.52, 1.87, 1.33, .34, .85, .22, .065, -.16, -.38],
  cabrio: [4.27, 1.83, 1.28, .32, .81, .18, .07, -.13, -.26],
  sedan: [4.68, 1.83, 1.46, .33, .90, .21, .08, -.18, -.36],
  wagon: [4.79, 1.85, 1.52, .33, .91, .22, .08, -.39, -.465],
  hatchback: [4.05, 1.76, 1.49, .30, .90, .25, .085, -.33, -.46],
  suv: [4.83, 1.98, 1.81, .39, 1.06, .235, .11, -.37, -.46],
  crossover: [4.34, 1.83, 1.62, .35, .99, .25, .095, -.27, -.45],
  pickup: [5.32, 1.93, 1.83, .39, 1.11, .254, .15, -.105, -.13],
  van: [4.83, 1.92, 1.86, .34, 1.01, .36, .21, -.43, -.48],
  delivery: [5.30, 2.03, 2.43, .36, 1.13, .40, .26, -.45, -.48],
  camper: [6.10, 2.28, 2.87, .38, 1.18, .43, .30, -.46, -.48],
  truck: [7.30, 2.45, 3.29, .53, 1.46, .48, .47, .18, .17],
  motorcycle: [2.14, .77, 1.18, .315],
  quad: [2.15, 1.24, 1.20, .295]
};
const rad = deg => deg * Math.PI / 180;
const normalAngle = angle => ((Number(angle) || 0) % 360 + 360) % 360;
const fixed = value => Number(value.toFixed(1));
const pathData = points => points.map(([x, y], i) => (i ? 'L' : 'M') + fixed(x) + ' ' + fixed(y)).join('');
const svg = (viewBox, content, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${attrs}>${content}</svg>`;

function buildOutline(profile, angle) {
  const [length, width, height, radius, belt, screen, roofFront, roofRear, back] = shapes[profile];
  const yaw = rad(normalAngle(angle)), sin = Math.sin(yaw), cos = Math.cos(yaw);
  const eye = rad(7), side = sin < 0 ? -1 : 1, end = cos < 0 ? -1 : 1;
  const scale = Math.min(340 / Math.hypot(length, width * .65), 171 / height);
  const distance = length * 2.5;
  const project = ([x,y,z]) => {
    const depth = x * sin + z * cos, up = y - height / 2;
    const perspective = distance / (distance - depth * Math.cos(eye) - up * Math.sin(eye));
    return [210 + (-x * cos + z * sin) * perspective * scale, 122 - (up * Math.cos(eye) - depth * Math.sin(eye)) * perspective * scale];
  };
  const paths = [];
  const line = (points, close = false) => paths.push(pathData(points.map(project)) + (close ? 'Z' : ''));
  // Lateral and longitudinal coordinates below are fractions of half-width and full length.
  const point = (x, y, z) => [x * width / 2, y, z * length];
  const segment = (points, close = false) => line(points.map(v => point(...v)), close);
  const wheelPos = profile === 'motorcycle' ? .345 : profile === 'truck' ? .335 : .31;
  const wheel = (x, z, wide, rim) => {
    const outerX = width * x / 2, innerX = outerX - Math.sign(x) * wide;
    if (Math.abs(sin) <= .065) {
      // From either end the tread has width; the sidewall is almost edge-on.
      const top = profile === 'motorcycle' || profile === 'quad' ? 1.85 : .72;
      const strip = (at, h) => {
        const crown = 1 - .23*Math.abs(h-1)**5;
        return [(outerX+innerX)/2 + (at-(outerX+innerX)/2)*crown, radius*h, z*length + end*radius*Math.sqrt(1-(h-1)**2)];
      };
      const levels = [top, .5, .16, .035, 0];
      line([...levels.map(h=>strip(outerX,h)), ...levels.slice().reverse().map(h=>strip(innerX,h))], true);
      return;
    }
    const circle = (at, r, start = 0, sweep = 360, count = 28) => Array.from({length: count + 1}, (_,i) => {
      const a = rad(start + sweep * i / count);
      return [at, radius + r * Math.sin(a), z * length + r * Math.cos(a)];
    });
    if (Math.abs(sin) > .06) {
      line(circle(outerX, radius));
      line(circle(outerX, radius * rim));
      line(circle(outerX, radius * rim * .20, 0, 360, 12));
      if (Math.abs(sin) > .25) for (const a of [15,87,159,231,303]) {
        line([circle(outerX,radius*rim*.22,a,0,1)[0],circle(outerX,radius*rim,a+10,0,1)[0]]);
      }
    }
    // The tread is visible below the bumper, even in a head-on photograph.
    line(circle(innerX, radius, 212, 116, 10));
    for (const a of [212, 270, 328]) {
      line([circle(outerX, radius, a, 0, 1)[0], circle(innerX, radius, a, 0, 1)[0]]);
    }
  };
  const nearSide = Math.abs(sin) > .065, nearEnd = Math.abs(cos) > .06;
  if (profile === 'motorcycle' || profile === 'quad') {
    const bike = profile === 'motorcycle';
    const wheelX = bike ? .17 : 1;
    for (const s of (nearSide || bike ? [side] : [-1,1])) {
      for (const z of (nearSide ? [-wheelPos, wheelPos] : [end * wheelPos])) wheel(s * wheelX, z, bike ? .13 : .21, bike ? .72 : .53);
    }
    if (bike) {
      segment([[side*.17,.315,.34],[side*.3,.84,.18],[0,1.02,.09],[-.8,1.03,.105],[.8,1.03,.105]]);
      segment([[side*.22,.315,-.34],[side*.52,.42,-.04],[side*.43,.73,.14],[side*.28,.69,-.15],[side*.22,.315,-.34]]);
      segment([[-.53,.72,-.28],[.53,.72,-.28],[.57,.69,-.08],[.68,.87,.03],[.55,.84,.13],[0,.68,.16],[-.55,.84,.13],[-.68,.87,.03],[-.57,.69,-.08]],true);
      segment([[-.40,.87,.20],[-.36,1.10,.16],[.36,1.10,.16],[.40,.87,.20]],true);
      for (const s of (nearSide ? [side] : [-1,1])) {
        // Fork, tank shoulder and crankcase form separate alignment references.
        segment([[s*.26,.315,.345],[s*.36,.76,.224],[s*.28,.91,.174]]);
        segment([[s*.3,.74,.16],[s*.54,.83,.126],[s*.6,.82,.045],[s*.61,.74,-.036],[s*.43,.67,-.05]]);
        segment([[s*.4,.62,.099],[s*.47,.65,.058],[s*.51,.56,-.043],[s*.42,.43,-.083],[s*.36,.39,.023],[s*.34,.47,.109]],true);
        for (const y of [.52,.55,.58]) segment([[s*.50,y,.067],[s*.50,y,-.012]]);
        segment([[s*.28,.40,-.29],[s*.56,.43,-.15],[s*.56,.48,-.18],[s*.35,.47,-.31]],true);
        const arc=Array.from({length:13},(_,i)=>{const a=rad(48+i*9);return [s*.28,radius+Math.sin(a)*radius*1.09,wheelPos+Math.cos(a)*radius*1.09/length]});
        segment(arc);
      }
      segment([[-.36,.84,.208],[-.31,.78,.227],[0,.75,.234],[.31,.78,.227],[.36,.84,.208]],true);
      segment([[-.44,.73,-.27],[-.4,.68,-.32],[.4,.68,-.32],[.44,.73,-.27]]);
    } else {
      for (const s of [-1,1]) segment([[s*.85,.51,-.48],[s*.91,.71,-.37],[s*.8,.67,-.18],[s*.5,.48,-.10],[s*.52,.47,.08],[s*.87,.72,.22],[s*.93,.72,.39],[s*.87,.46,.48]]);
      for (const z of [-.37,.39]) segment([[-.9,.71,z],[.9,.71,z]]);
      segment([[-.49,.7,-.24],[.49,.7,-.24],[.43,.75,.01],[0,.81,.10],[-.43,.75,.01]],true);
      segment([[-.72,1.05,.115],[-.22,.97,.135],[0,.78,.18],[.22,.97,.135],[.72,1.05,.115]]);
      segment([[-.72,.44,.48],[.72,.44,.48],[.65,.59,.49],[-.65,.59,.49]],true);
    }
  } else {
    const box = ['delivery','camper','truck'].includes(profile), open = profile === 'cabrio';
    const roofWidth = box ? .94 : profile === 'supercar' ? .72 : .81;
    const bumper = radius * .68, nose = belt * (box ? .97 : profile === 'supercar' ? .71 : .81);
    const tail = belt * .92;
    const accent = (s, y, z) => [s * .97, y, z];
    for (const s of [-1,1]) {
      const far = s !== side;
      // The opposite sill is occluded, but its roof edge silhouettes against the sky.
      if (!far || !nearSide || !open) {
        if (!open) segment([[s*roofWidth,height*.97,roofFront],[s*roofWidth,height,(roofFront+roofRear)/2],[s*roofWidth,height*.985,roofRear]]);
      }
      if (!far || !nearSide || end === 1) segment([[s*.90,nose,.48],[s*.97,belt*.96,screen],[s*roofWidth,height*.97,roofFront]]);
      if (!open && (!far || !nearSide || end === -1)) segment([[s*roofWidth,height*.985,roofRear],[s*.97,belt,back],[s*.92,tail,-.48]]);
      // Mirrors project beyond the body and remain visible in both end views.
      if (!far || !nearSide) {
        const mirror = screen-.024, y = belt*1.06;
        segment([[s*.97,y,mirror],[s*1.08,y*1.055,mirror-.009],[s*1.115,y*1.07,mirror+.006],[s*1.11,y*1.14,mirror+.02],[s*1.02,y*1.16,mirror+.024],[s*.99,y*1.09,mirror+.01]],true);
      }
      if (!nearSide) {
        // The body itself hides the arch openings and the wheels on the opposite axle.
        segment([[s*.86,bumper*.88,end*.497],[s*.981,bumper*1.16,end*.47],[s*.983,end===1?nose:tail,end*.465],[s*.97,belt,end===1?screen:back]]);
        wheel(s,end*wheelPos,width*.105,.65);
        continue;
      }
      if (far) continue;
      const sideOutline = [accent(s,bumper,-.475), accent(s,tail,-.485), accent(s,belt,back)];
      if (open) sideOutline.push(accent(s,belt*.91,-.02));
      sideOutline.push(accent(s,belt,screen), accent(s,nose,.475), accent(s,bumper,.49));
      for (const z of [wheelPos,-wheelPos]) {
        for (let j=0; j<=12; j++) {
          const a = j * Math.PI/12;
          sideOutline.push([s,bumper + Math.sin(a) * (radius * 2.08 - bumper),z + Math.cos(a) * radius * 1.08/length]);
        }
      }
      segment(sideOutline, true);
      if (!open && nearSide) {
        const rearWindow = box ? Math.max(roofRear+.025,roofFront-.18) : roofRear+.012;
        const lowerRear = box ? rearWindow-.002 : back+.028;
        segment([[s*.958,belt*1.045,screen-.017],[s*(roofWidth+.012),height*.937,roofFront-.008],[s*(roofWidth+.012),height*.949,rearWindow],[s*.958,belt*1.047,lowerRear]],true);
        if (!box && profile !== 'supercar' && profile !== 'coupe') {
          const post=(roofFront+roofRear)/2;
          segment([[s*roofWidth,height*.95,post],[s*.95,belt*1.04,post-.015]]);
        }
        if (profile === 'camper') segment([[s*.953,height*.80,-.04],[s*.953,height*.80,-.30],[s*.96,height*.58,-.30],[s*.96,height*.58,-.04]],true);
      }
      if (nearSide) {
        const doorRear = box || profile==='pickup' ? roofFront-.17 : Math.max(roofRear-.03,-.24);
        segment([[s*.964,belt*.988,screen-.015],[s*.993,belt*.88,screen-.035],[s*.988,bumper*1.33,Math.min(screen-.06,.20)],[s*.989,bumper*1.28,Math.max(doorRear,-.18)],[s*.985,belt*.77,doorRear-.01],[s*.973,belt,doorRear]]);
        segment([[s*.99,belt*.91,doorRear+.018],[s*.99,belt*.91,doorRear+.049]]);
      }
      for (const z of (nearSide ? [-wheelPos,wheelPos] : [end*wheelPos])) wheel(s, z, width*.105, .65);
    }
    segment([[-.97,belt*.96,screen],[.97,belt*.96,screen]]);
    segment([[-roofWidth,height*.97,roofFront],[roofWidth,height*.97,roofFront]]);
    if (!open) segment([[-roofWidth,height*.985,roofRear],[roofWidth,height*.985,roofRear]]);
    if ((profile === 'pickup' || open) && end === -1) segment([[-.96,belt,back],[.96,belt,back]]);
    if (nearEnd) {
      const y = end === 1 ? nose : tail;
      segment([[-.97,bumper,end*.478],[-.87,bumper*.88,end*.497],[.87,bumper*.88,end*.497],[.97,bumper,end*.478]]);
      segment([[-.92,y,end*.48],[-.64,y*.985,end*.5],[.64,y*.985,end*.5],[.92,y,end*.48]]);
      for (const s of [-1,1]) segment([[s*.89,y*.91,end*.482],[s*.52,y*.90,end*.502],[s*.59,y*.83,end*.504],[s*.88,y*.84,end*.485]],true);
      segment([[-.22,y*.72,end*.504],[.22,y*.72,end*.504],[.22,y*.55,end*.504],[-.22,y*.55,end*.504]],true);
      if (end === 1) for (const s of [-1,1]) segment([[s*.57,y*1.012,.478],[s*.65,belt*.978,screen+.014]]);
      if (end === 1) segment([[-.49,bumper*1.36,.502],[.49,bumper*1.36,.502],[.39,bumper*.99,.503],[-.39,bumper*.99,.503]],true);
      if (end === -1 && !open) segment([[-.97,belt,back],[.97,belt,back]]);
    }
    if (profile === 'truck' || profile === 'pickup') {
      const top = profile === 'truck' ? height*.99 : belt*1.035;
      for (const s of [-1,1]) segment([[s*.95,belt,.15],[s*.95,top,.15],[s*.95,top,-.46],[s*.95,belt,-.46]]);
      for (const z of [.15,-.46]) segment([[-.95,top,z],[.95,top,z]]);
    }
  }
  return `<path d="${paths.join('')}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function outlineSvg(profile, angle) {
  if (!Object.hasOwn(shapes,profile) || angle == null || !Number.isFinite(Number(angle))) return '';
  return svg('0 0 420 244', buildOutline(profile,angle), 'aria-hidden="true" focusable="false"');
}

function overhead(profile) {
  if (profile === 'motorcycle' || profile === 'quad') {
    const track = profile === 'quad' ? [148,172] : [160];
    return `<g stroke="#a8b5c3" stroke-width="1.6" fill="#252c34">${track.flatMap(x => [119,169].map(y => `<rect x="${x-4}" y="${y-8}" width="8" height="16" rx="3"/>`)).join('')}<path d="M153 121Q160 107 167 121L169 133 165 146 166 161 161 170 154 165 155 149 150 134Z" fill="#b46c36"/><path d="M148 129L160 134 172 129M157 146L163 146 163 159 157 159Z" fill="#222b33"/></g>`;
  }
  // A low, wedge-shaped reference with split headlamps, glazed canopy and mid-engine deck.
  if (profile === 'supercar') return `<g stroke-linejoin="round">
    <path d="M160 89Q180 91 184 100L186 117 182 136 186 162 184 184Q177 191 160 192Q143 191 136 184L134 162 138 136 134 117 136 100Q140 91 160 89Z" fill="#c97637" stroke="#f4bf85" stroke-width="1.6"/>
    <path d="M138 103L146 108 151 107M146 108L142 115M182 103L174 108 169 107M174 108L178 115" fill="none" stroke="#fff0ca" stroke-width="1.6"/>
    <path d="M144 113Q160 108 176 113L171 130 149 130ZM148 134L143 128 142 148 149 157ZM172 134L177 128 178 148 171 157ZM148 158L172 158 176 177 144 177Z" fill="#25313a" stroke="#edab6d"/>
    <path d="M151 162H169M149 167H171M148 172H172M140 182L147 185H173L180 182" fill="none" stroke="#e4ae80" stroke-width="1.2"/></g>`;
  const isBox = ['van','delivery','camper','truck'].includes(profile);
  const hasBed = profile === 'pickup' || profile === 'truck';
  const rx = isBox ? 7 : 16, front = isBox ? 109 : 116;
  const back = hasBed ? 146 : profile === 'coupe' || profile === 'cabrio' ? 156 : 169;
  return `<g stroke-linejoin="round" stroke="#e6ae7d" stroke-width="1.5">
    <rect x="137" y="91" width="46" height="99" rx="${rx}" fill="#ab6938"/>
    <path d="M141 ${front}Q160 ${front-9} 179 ${front}L174 ${front+13}H146ZM146 ${back}H174L178 ${back+12}Q160 ${back+16} 142 ${back+12}Z" fill="#27343c"/>
    ${hasBed ? '<rect x="143" y="159" width="34" height="23" rx="2" fill="#614735"/>' : ''}
    <path d="M141 101L148 103M179 101L172 103M141 182H148M172 182H179" stroke="#ffedc7"/></g>`;
}

// Hit areas are annular sectors, so nearby points never steal each other's actions.
const mapPoint = (angle, radius) => [fixed(160 + Math.sin(rad(angle))*radius), fixed(141 - Math.cos(rad(angle))*radius)];
function sector(start, stop) {
  const p = (a,r) => mapPoint(a,r).join(' ');
  const large = stop-start > 180 ? 1 : 0;
  return `M${p(start,83)}L${p(start,134)}A134 134 0 ${large} 1 ${p(stop,134)}L${p(stop,83)}A83 83 0 ${large} 0 ${p(start,83)}Z`;
}

export function orbitSvg({angles = [], angle = 0, completed = [], profile = 'supercar', lang = 'pl'} = {}) {
  const validAngles = [...new Set(angles.filter(a => Number.isFinite(a)).map(normalAngle))].sort((a,b) => a-b);
  if (!validAngles.length) return '';
  const active = normalAngle(angle), done = new Set(Array.from(completed || [],normalAngle));
  const en = lang === 'en' || lang === 1;
  const next = [...validAngles.filter(a=>a>active), ...validAngles.filter(a=>a<active)].find(a=>!done.has(a));
  const bearing = mapPoint(active, 97);
  const gaze = mapPoint(active, 60);
  const ray = `<path d="M${bearing.join(' ')}L${gaze.join(' ')}" stroke="#6ac4ff" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  const controls = validAngles.map((a,i) => {
    const selected = a === active, complete = done.has(a), upcoming = a === next;
    const previous = validAngles[i-1] ?? validAngles[validAngles.length-1]-360;
    const following = validAngles[i+1] ?? validAngles[0]+360;
    const [x,y] = mapPoint(a,106), [lx,ly] = mapPoint(a,127);
    const radius = selected ? 8 : validAngles.length > 12 ? 4 : 5.5;
    const colour = selected ? '#72c8ff' : complete ? '#65cba1' : upcoming ? '#e8af71' : '#a3b3c4';
    const label = [a+'°',selected ? (en?'selected':'wybrano') : '',complete ? (en?'complete':'wykonano') : (en?'missing':'brakuje zdjęcia'),upcoming ? (en?'next':'następne') : ''].filter(Boolean).join(', ');
    const numbers = validAngles.length <= 12 || a%90 === 0;
    let mark = `<circle cx="${x}" cy="${y}" r="${radius}" fill="${selected || complete ? colour : '#16222b'}" stroke="${colour}" stroke-width="1.6"/>`;
    if (complete) mark += `<path d="M${x-2.7} ${y}l1.9 2 3.6-4.2" fill="none" stroke="#15232b" stroke-width="1.5"/>`;
    if (upcoming) mark += `<circle cx="${x}" cy="${y}" r="${radius+3}" fill="none" stroke="${colour}" stroke-width="1"/>`;
    return `<g tabindex="0" role="button" aria-pressed="${selected}" aria-label="${label}" data-camera-angle="${a}" style="cursor:pointer"><title>${label}</title><path d="${sector((a+previous)/2,(a+following)/2)}" fill="transparent"/>${mark}${numbers ? `<text x="${lx}" y="${ly+4}" text-anchor="middle" font-size="10" fill="${colour}">${a}°</text>` : ''}</g>`;
  }).join('');
  const clockwise = '<path d="M205 76Q220 86 229 102m-1-8 1 8-8-4" stroke="#e8af71" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  return svg('0 0 320 282', `<circle cx="160" cy="141" r="106" fill="none" stroke="#536476" stroke-width="1" stroke-dasharray="2 4"/>${ray}${clockwise}${overhead(profile)}${controls}`, `role="group" aria-label="${en?'Photographer positions around the vehicle':'Pozycje fotografa wokół pojazdu'}"`);
}

export const referenceViews={front:'/assets/showcase/27-front.webp',rear:'/assets/showcase/27-rear.webp',side:'/assets/showcase/27-side.webp'};

export function exampleSvg(profile, angle, good = true) {
  const a = normalAngle(angle);
  const aspect = a >= 135 && a <= 225 ? 'rear' : a === 90 || a === 270 ? 'side' : 'front';
  // The two plates illustrate framing; the angle-specific contour is shown separately.
  // The bundled Revuelto photos are illustrative and do not depict the seller's vehicle.
  const x = good ? 0 : -90, y = good ? 0 : -23, w = good ? 320 : 480;
  const ticks = 'M13 37V14H37M283 14H307V37M307 143V166H283M37 166H13V143';
  return svg('0 0 320 180', `<image href="${referenceViews[aspect]}" x="${x}" y="${y}" width="${w}" height="${w*9/16}" preserveAspectRatio="xMidYMid slice"/><path d="${ticks}" stroke="${good ? '#8be4b5' : '#ff9a88'}" stroke-width="2" fill="none"/>`, 'aria-hidden="true" focusable="false" style="overflow:hidden"');
}
