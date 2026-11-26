import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {autoProfile, exampleSvg, orbitSvg, outlineSvg, profiles, steps} from '../public/smart-camera-guides.js';

test('shooting plan uses the vehicle’s own right and left and separates exterior shots from details', () => {
  assert.deepEqual(steps.slice(0,8).map(s => s.angle), [315,0,45,90,135,180,225,270]);
  assert.equal(new Set(steps.map(s => s.id)).size,18);
  assert.ok(steps.slice(8).every(s => s.angle === null && s.distance === null));
  assert.ok(steps.every(s => s.label.length === 2 && s.hint.length === 2));
  assert.equal(autoProfile('car','raised_wagon'), 'wagon');
  assert.equal(autoProfile('car','roadster'), 'cabrio');
  assert.equal(autoProfile('car','van'), 'van');
  assert.equal(autoProfile('van','panel'), 'delivery');
  assert.equal(autoProfile('scooter','moped'), 'motorcycle');
  assert.equal(autoProfile('garden','garden_mower'), null);
  assert.equal(outlineSvg(null,0), '');
  assert.equal(outlineSvg('sedan',null), '');
});

test('each body has distinct, finite, periodic perspective paths throughout the orbit', () => {
  assert.equal(Object.keys(profiles).length,15);
  const oblique = new Set();
  for (const p of Object.keys(profiles)) {
    assert.equal(outlineSvg(p,315), outlineSvg(p,-45));
    assert.equal(outlineSvg(p,0), outlineSvg(p,360));
    const views = new Set();
    for (let a=0; a<360; a+=5) {
      const art = outlineSvg(p,a);
      assert.match(art, /stroke="currentColor"/);
      assert.doesNotMatch(art, /NaN|Infinity|<image/);
      views.add(art);
    }
    assert.equal(views.size,72, p);
    oblique.add(outlineSvg(p,45));
  }
  assert.equal(oblique.size,15);
});

test('ring exposes every position to the keyboard and wraps its next incomplete position', () => {
  const angles = Array.from({length:36},(_,i)=>i*10);
  const map = orbitSvg({angles, angle:350, completed:[350,0], lang:'pl'});
  assert.equal(map.match(/tabindex="0" role="button"/g).length,36);
  assert.match(map, /aria-pressed="true" aria-label="350°, wybrano, wykonano"/);
  assert.match(map, /aria-label="10°, brakuje zdjęcia, następne"/);
  assert.match(orbitSvg({angles,angle:90,lang:'en'}), /90°, selected, missing/);
});

test('framing examples use the available Revuelto photos, with a tighter crop for the bad example', async () => {
  for (const a of [315,90,180]) {
    const good = exampleSvg('supercar',a,true), bad = exampleSvg('supercar',a,false);
    const path = good.match(/href="([^"]+)"/)[1];
    await access(new URL('../public'+path, import.meta.url));
    assert.ok(bad.includes(path));
    assert.notEqual(good,bad);
  }
});
